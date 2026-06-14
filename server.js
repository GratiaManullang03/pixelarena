const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CHARACTERS } = require('./server/characters.js');
const { createRoomState, resetRoom, hostTick } = require('./server/game-engine.js');

const PORT = process.env.PORT || 3001;

// --- HTTP server to serve static files ---
const ERROR_DIR = path.join(__dirname, 'error-pages');
const ERROR_FILES = { 400: '400.html', 403: '403.html', 404: '404.html', 500: '500.html' };

// Serve a themed error page (falls back to plain text if the file is missing).
function sendError(res, code) {
    const file = path.join(ERROR_DIR, ERROR_FILES[code] || '500.html');
    fs.readFile(file, (err, body) => {
        if (err) { res.writeHead(code, { 'Content-Type': 'text/plain' }); res.end(String(code)); return; }
        res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(body);
    });
}

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    let urlPath;
    try {
        urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
        return sendError(res, 400); // malformed percent-encoding
    }
    if (urlPath === '/') urlPath = '/index.html';

    // Confine resolved path within the project dir — block path traversal (e.g. /../).
    const filePath = path.normalize(path.join(__dirname, urlPath));
    if (filePath !== __dirname && !filePath.startsWith(__dirname + path.sep)) {
        return sendError(res, 403);
    }

    const ext = path.extname(filePath);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            return sendError(res, (err.code === 'ENOENT' || err.code === 'EISDIR') ? 404 : 500);
        }
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(data);
    });
});

// --- Per-room state ---
// rooms: Map<roomCode, { clients: Set<WebSocket>, state: roomState }>
const rooms = new Map();

function getOrCreateRoom(code) {
    if (!rooms.has(code)) rooms.set(code, { clients: new Set(), state: createRoomState() });
    return rooms.get(code);
}

// All server-originated messages include room + from:'__server__' so net.js filters correctly
function broadcastAll(roomCode, room, type, payload) {
    const msg = JSON.stringify({ room: roomCode, from: '__server__', type, payload });
    for (const ws of room.clients) {
        if (ws.readyState === 1) ws.send(msg);
    }
}

function broadcastExcept(roomCode, room, type, payload, excludeWs) {
    const msg = JSON.stringify({ room: roomCode, from: '__server__', type, payload });
    for (const ws of room.clients) {
        if (ws !== excludeWs && ws.readyState === 1) ws.send(msg);
    }
}

function buildRanks(state) {
    return Object.values(state.players)
        .map((p) => ({ id: p.id, name: p.name, color: p.color, kills: p.kills || 0, charIdx: p.charIdx || 0 }))
        .sort((a, b) => b.kills - a.kills);
}

function endMatch(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    const { state } = room;
    if (state.intervalId) { clearInterval(state.intervalId); state.intervalId = null; }
    state.running = false;
    broadcastAll(roomCode, room, 'end', { ranks: buildRanks(state) });
}

function startRoomLoop(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    const { state } = room;
    if (state.intervalId) clearInterval(state.intervalId);
    state.lastTick = Date.now();
    state.intervalId = setInterval(() => {
        const now = Date.now();
        const dt = Math.min(0.05, (now - state.lastTick) / 1000);
        state.lastTick = now;
        if (!state.running) return;
        hostTick(
            state, dt, now,
            (type, payload) => broadcastAll(roomCode, room, type, payload),
            () => endMatch(roomCode),
        );
    }, 33);
}

// --- WebSocket server ---
// permessage-deflate: snapshot JSON is highly repetitive, compresses ~60-80%.
// threshold avoids spending CPU on tiny control messages.
const wss = new WebSocketServer({
    server,
    path: '/ws',
    perMessageDeflate: {
        threshold: 256,
        zlibDeflateOptions: { level: 6, memLevel: 8 },
        concurrencyLimit: 10,
        serverNoContextTakeover: false,
        clientNoContextTakeover: false,
    },
});

wss.on('connection', (ws) => {
    let currentRoomCode = null;
    let myId = null;

    const keepalive = setInterval(() => {
        if (ws.readyState === ws.OPEN) ws.ping();
    }, 20000);
    ws.on('pong', () => {});

    // Direct message to this client only (for roster on join)
    function sendDirect(roomCode, type, payload) {
        if (ws.readyState === 1)
            ws.send(JSON.stringify({ room: roomCode, from: '__server__', type, payload }));
    }

    function leaveRoom() {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (room) {
            room.clients.delete(ws);
            if (myId && room.state.players[myId]) delete room.state.players[myId];
            if (room.clients.size === 0) {
                if (room.state.intervalId) clearInterval(room.state.intervalId);
                rooms.delete(currentRoomCode);
            }
        }
        currentRoomCode = null;
        myId = null;
    }

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        const { room: roomCode, from, type, payload } = msg;
        if (!roomCode || !from) return;

        // Switch rooms if needed
        if (currentRoomCode !== roomCode) {
            leaveRoom();
            currentRoomCode = roomCode;
            myId = from;
            getOrCreateRoom(roomCode).clients.add(ws);
        }

        const room = rooms.get(roomCode);
        if (!room) return;
        const { state } = room;

        switch (type) {
            case 'hello':
                sendDirect(roomCode, 'roster', {
                    roster: Object.values(state.players).map((p) => ({
                        id: p.id, name: p.name, avatar: p.avatar, color: p.color,
                        ready: !!p.ready, charIdx: p.charIdx || 0,
                    })),
                });
                // Send walls immediately if a match is already running
                if (state.running && state.walls.length > 0)
                    sendDirect(roomCode, 'walls', { walls: state.walls });
                // Tell existing peers a new player connected
                broadcastExcept(roomCode, room, 'hello', {}, ws);
                break;

            case 'me': {
                const p = payload;
                if (!p?.id || p.id !== from) return;
                const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
                const existing = state.players[p.id] || {
                    x: 0, y: 0, vx: 0, vy: 0, hp: ch.baseHp, maxHp: ch.baseHp,
                    mp: 0, maxMp: ch.ultCost, alive: true, kills: 0, aim: 0,
                    powerup: null, powerupUntil: 0, lastShot: 0, respawnAt: 0,
                    streak: 0, bounty: false, ultActive: false, ultUntil: 0,
                    ultState: null, critShots: 0, lastUlt: 0,
                    _lastFire: 0, _pyroLastPassive: 0,
                    livesLeft: 3, isSpectator: false, inputBuf: null,
                };
                state.players[p.id] = Object.assign(existing, {
                    id: p.id, name: p.name, avatar: p.avatar,
                    color: p.color || ch.color, ready: !!p.ready,
                    charIdx: p.charIdx !== undefined ? p.charIdx : 0,
                });
                // Relay to all peers so lobby stays in sync
                broadcastExcept(roomCode, room, 'me', { ...state.players[p.id] }, ws);
                break;
            }

            case 'input':
                if (state.players[from]) state.players[from].inputBuf = payload;
                break;

            case 'start': {
                const seed = payload?.seed ?? Math.floor(Math.random() * 1e9);
                const mode = payload?.mode || 'classic';
                state.gameMode = mode;
                resetRoom(state, seed);
                const now = Date.now();
                const duration = mode === 'survival' ? 30 * 60 * 1000 : 3 * 60 * 1000;
                state.matchStart = now;
                state.matchEnd = now + duration;
                state.running = false;
                // Broadcast start to ALL clients (including sender) — countdown fires for everyone
                broadcastAll(roomCode, room, 'start', { seed, mode });
                // Walls are static for the whole match — send once here instead of in every snapshot
                broadcastAll(roomCode, room, 'walls', { walls: state.walls });
                // running=true after 3s to match client countdown
                setTimeout(() => {
                    if (rooms.has(roomCode)) rooms.get(roomCode).state.running = true;
                }, 3000);
                startRoomLoop(roomCode);
                break;
            }

            default:
                // Relay anything else (sfx, spectator, etc.) to peers
                broadcastExcept(roomCode, room, type, payload, ws);
                break;
        }
    });

    ws.on('close', () => { clearInterval(keepalive); leaveRoom(); });
    ws.on('error', () => { clearInterval(keepalive); leaveRoom(); });
});

// --- Print local IP addresses ---
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) ips.push({ name, address: iface.address });
        }
    }
    return ips;
}

server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log('\n=== PIXEL ARENA SERVER (server-authoritative) ===');
    console.log(`\nServer berjalan di port ${PORT}`);
    if (process.env.PORT) {
        console.log('\nRunning on Railway. Share the Railway URL with friends.\n');
    } else {
        console.log('\nBagikan salah satu URL ini ke teman satu jaringan:');
        if (ips.length === 0) {
            console.log(`  http://localhost:${PORT}`);
        } else {
            ips.forEach((ip) => console.log(`  [${ip.name}] http://${ip.address}:${PORT}`));
        }
        console.log('\nTeman harus terhubung ke WiFi/hotspot yang sama.\n');
    }
});
