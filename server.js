const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3001;

// --- HTTP server to serve static files ---
const server = http.createServer((req, res) => {
    const urlPath = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(__dirname, urlPath);
    const ext = path.extname(filePath);
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
    };

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(data);
    });
});

// --- WebSocket relay server ---
// Messages: { room, from, type, payload }
// Server relays each message to all OTHER clients in the same room.
const wss = new WebSocketServer({ server, path: '/ws' });

// rooms: Map<roomCode, Set<WebSocket>>
const rooms = new Map();

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }

        const { room, from, type, payload } = msg;
        if (!room || !from) return;

        // Join room on first message
        if (currentRoom !== room) {
            // Leave old room
            if (currentRoom && rooms.has(currentRoom)) {
                rooms.get(currentRoom).delete(ws);
                if (rooms.get(currentRoom).size === 0)
                    rooms.delete(currentRoom);
            }
            currentRoom = room;
            if (!rooms.has(room)) rooms.set(room, new Set());
            rooms.get(room).add(ws);
        }

        // Relay to everyone else in the same room
        const peers = rooms.get(room);
        if (!peers) return;
        const data = JSON.stringify(msg);
        for (const peer of peers) {
            if (peer !== ws && peer.readyState === 1) {
                peer.send(data);
            }
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(ws);
            if (rooms.get(currentRoom).size === 0) rooms.delete(currentRoom);
        }
    });
});

// --- Print local IP addresses ---
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({ name, address: iface.address });
            }
        }
    }
    return ips;
}

server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log('\n=== PIXEL ARENA SERVER ===');
    console.log(`\nServer berjalan di port ${PORT}`);
    console.log('\nBagikan salah satu URL ini ke teman satu jaringan:');
    if (ips.length === 0) {
        console.log(`  http://localhost:${PORT}`);
    } else {
        ips.forEach((ip) => {
            console.log(`  [${ip.name}] http://${ip.address}:${PORT}`);
        });
    }
    console.log('\nTeman harus terhubung ke WiFi/hotspot yang sama.\n');
});
