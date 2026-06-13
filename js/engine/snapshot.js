/* snapshot.js — client-side snapshot apply + time-based interpolation ring buffer */
import { State } from '../state.js';
import { setWalls } from './physics.js';
import * as Prediction from './prediction.js';

// Buffer is keyed by the SERVER timestamp (snap.t), not local arrival time, so
// network jitter doesn't translate into jerky remote-player motion.
const SNAP_BUF = 16;
const snapBuffer = []; // { t, players, receivedAt } sorted by t ascending
let _clockOffset = null; // smoothed (localNow - serverT)
let _avgInterval = 33; // smoothed server snapshot interval (ms)
let _interpDelay = 80; // render this far behind newest server time (ms)
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
    const t = snap.t;
    // Track the offset between the local clock and the server clock so we can
    // express a render time in server-time units.
    const sample = receivedAt - t;
    if (_clockOffset === null) _clockOffset = sample;
    else _clockOffset += (sample - _clockOffset) * 0.05;

    if (snapBuffer.length) {
        const dt = t - snapBuffer[snapBuffer.length - 1].t;
        if (dt > 0 && dt < 1000) _avgInterval += (dt - _avgInterval) * 0.1;
    }
    snapBuffer.push({ t, players: snap.players, receivedAt });
    if (snapBuffer.length > SNAP_BUF) snapBuffer.shift();

    // Stay ~2 snapshots behind so there are always two frames to interpolate
    // between, even under jitter. Local player is predicted, so this delay only
    // affects how far in the past remote players are rendered.
    _interpDelay = Math.max(60, Math.min(120, _avgInterval * 2));
}

export function getInterpDelay() {
    return _interpDelay;
}
export function resetWallsReceived() {
    _wallsReceived = false;
    snapBuffer.length = 0;
    _clockOffset = null;
    _avgInterval = 33;
}
export function wallsReceived() {
    return _wallsReceived;
}

// localNow is performance.now(); returns a map of interpolated remote players.
export function getInterpolated(localNow) {
    if (snapBuffer.length === 0 || _clockOffset === null) return null;
    const renderT = localNow - _clockOffset - _interpDelay; // server-time

    let prev = null;
    let next = null;
    for (let i = snapBuffer.length - 1; i >= 0; i--) {
        if (snapBuffer[i].t <= renderT) {
            prev = snapBuffer[i];
            next = snapBuffer[i + 1] || null;
            break;
        }
    }

    if (!prev) return _buildMap(snapBuffer[0].players, null, 0);
    if (!next) return _buildMap(prev.players, null, 1);

    const span = next.t - prev.t;
    const alpha = span > 0 ? clamp01((renderT - prev.t) / span) : 1;
    return _buildMap(next.players, prev.players, alpha);
}

function _buildMap(nextPlayers, prevPlayers, alpha) {
    const result = {};
    for (const sp of nextPlayers) {
        // Merge static lobby data (color/name/charIdx/maxHp…) so rendering has
        // every field even if the snapshot only carries dynamic state.
        const base = State.players[sp.id] || {};
        const pp = prevPlayers ? prevPlayers.find((p) => p.id === sp.id) : null;
        if (!pp) {
            result[sp.id] = { ...base, ...sp };
            continue;
        }
        result[sp.id] = {
            ...base,
            ...sp,
            x: pp.x + (sp.x - pp.x) * alpha,
            y: pp.y + (sp.y - pp.y) * alpha,
            aim: lerpAngle(pp.aim, sp.aim, alpha),
        };
    }
    return result;
}

export function applySnap(s, outBullets, outPowerups, outHpItems, outFirePads, outTurrets) {
    if (s.walls) {
        setWalls(s.walls);
        _wallsReceived = true;
    }
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

    // Reconcile local prediction against the raw authoritative position.
    const mine = s.players.find((p) => p.id === State.myId);
    if (mine) Prediction.reconcile(mine, mine.aSeq || 0);

    pushSnapshot(s, performance.now());
}
