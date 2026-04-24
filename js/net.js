/* net.js — WebSocket client with disconnect detection */
const listeners = new Set();
const lastSeen = new Map();
let ws = null,
    room = null,
    me = null;
let reconnectTries = 0;
let onStatus = () => {};

function rid() {
    return Math.random().toString(36).slice(2, 10);
}

function tryConnect() {
    const wsUrl = `ws://${location.host}/ws`;
    onStatus('wait', 'Connecting…');
    try {
        ws = new WebSocket(wsUrl);
    } catch {
        onStatus('err', 'WebSocket error');
        return;
    }

    ws.onopen = () => {
        reconnectTries = 0;
        onStatus('ok', 'Connected · LAN');
        send('hello', {});
    };
    ws.onmessage = (ev) => {
        let msg;
        try {
            msg = JSON.parse(ev.data);
        } catch {
            return;
        }
        if (!msg || msg.room !== room) return;
        if (msg.from === me) return;
        lastSeen.set(msg.from, performance.now());
        listeners.forEach((fn) => fn(msg));
    };
    ws.onerror = () => {};
    ws.onclose = () => {
        onStatus('err', 'Disconnected');
        if (reconnectTries < 5) {
            reconnectTries++;
            setTimeout(tryConnect, 1000);
        }
    };
}

export function connect(roomCode, statusCb) {
    room = roomCode;
    onStatus = statusCb || (() => {});
    me = rid();
    tryConnect();
}

export function send(type, payload) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ room, from: me, type, payload }));
}

export function on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
export function close() {
    try {
        ws && ws.close();
    } catch {}
    ws = null;
}
export function id() {
    return me;
}
export function getLastSeen(peerId) {
    return lastSeen.get(peerId) || 0;
}
