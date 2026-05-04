/* snapshot.js — client-side snapshot apply + interpolation ring buffer */
import { State } from '../state.js';
import { setWalls } from './physics.js';

// Ring buffer: 4 frames for smoother interpolation under packet loss
const SNAP_BUF = 4;
const snapBuffer = [];
let _interpDelay = 50; // adaptive interpolation delay in ms
let _wallsReceived = false;

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
}

export function pushSnapshot(snap, receivedAt) {
    snapBuffer.push({ ...snap, receivedAt });
    if (snapBuffer.length > SNAP_BUF) snapBuffer.shift();

    if (snapBuffer.length >= 2) {
        const intervals = [];
        for (let i = 1; i < snapBuffer.length; i++)
            intervals.push(snapBuffer[i].receivedAt - snapBuffer[i - 1].receivedAt);
        const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
        _interpDelay = Math.max(33, Math.min(80, avg * 1.2));
    }
}

export function getInterpDelay() { return _interpDelay; }
export function resetWallsReceived() { _wallsReceived = false; snapBuffer.length = 0; }
export function wallsReceived() { return _wallsReceived; }

export function getInterpolated(renderTime) {
    if (snapBuffer.length === 0) return null;

    let prev = null, next = null;
    for (let i = snapBuffer.length - 1; i >= 0; i--) {
        const s = snapBuffer[i];
        if (s.receivedAt <= renderTime) { prev = s; break; }
        next = s;
    }

    if (!prev) return _buildMap(snapBuffer[0].players, null, 0);
    if (!next) return _buildMap(prev.players, null, 1);

    const span = next.receivedAt - prev.receivedAt;
    const alpha = span > 0 ? clamp01((renderTime - prev.receivedAt) / span) : 1;
    return _buildMap(next.players, prev.players, alpha);
}

function _buildMap(nextPlayers, prevPlayers, alpha) {
    const result = {};
    for (const sp of nextPlayers) {
        const pp = prevPlayers ? prevPlayers.find((p) => p.id === sp.id) : null;
        if (!pp) { result[sp.id] = sp; continue; }
        result[sp.id] = {
            ...sp,
            x: pp.x + (sp.x - pp.x) * alpha,
            y: pp.y + (sp.y - pp.y) * alpha,
            aim: lerpAngle(pp.aim, sp.aim, alpha),
        };
    }
    return result;
}

export function applySnap(s, outBullets, outPowerups, outHpItems, outFirePads, outTurrets) {
    if (s.walls) { setWalls(s.walls); _wallsReceived = true; }
    outPowerups.length = 0;
    s.powerups.forEach((x) => outPowerups.push(x));
    outHpItems.length = 0;
    (s.hpItems || []).forEach((x) => outHpItems.push(x));
    outFirePads.length = 0;
    (s.firePads || []).forEach((x) => outFirePads.push(x));
    outTurrets.length = 0;
    (s.turrets || []).forEach((x) => outTurrets.push(x));

    outBullets.length = 0;
    s.bullets.forEach((b) => outBullets.push({ ...b, life: 1 }));

    // Server sends endAt as absolute Date.now() — convert to performance.now() scale
    if (s.endAt) {
        const serverOffset = s.endAt - Date.now();
        State.matchEnd = performance.now() + serverOffset;
    }

    s.players.forEach((sp) => {
        State.players[sp.id] = Object.assign(State.players[sp.id] || {}, sp);
    });
    const ids = new Set(s.players.map((p) => p.id));
    Object.keys(State.players).forEach((id) => {
        if (!ids.has(id) && id !== State.myId) delete State.players[id];
    });

    pushSnapshot(s, performance.now());
}
