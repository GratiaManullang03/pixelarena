/* prediction.js — client-side prediction + server reconciliation for the LOCAL player.
 *
 * The server is authoritative, but waiting a full round-trip to see your own
 * movement feels laggy over the internet. So we simulate the local player
 * immediately on input, then reconcile against each authoritative snapshot by
 * replaying the inputs the server hasn't acknowledged yet.
 *
 * The movement model here MUST mirror server/game-engine.js `_movePlayer`.
 */
import { State } from '../state.js';
import { CHARACTERS } from '../characters.js';
import { moveWithWalls } from './physics.js';
import { ARENA } from '../maps.js';

let seq = 0;
const pending = []; // unacked commands: { seq, input, dt }
let predicted = null; // { x, y, vx, vy }
let lastAim = 0;

function charFor(p) {
    return CHARACTERS[p?.charIdx] || CHARACTERS[0];
}

// Mirror of server `_movePlayer`. Moves `s` ({x,y,vx,vy}) using the local
// player's character + active powerup/ult timers (which use server Date.now()).
function step(s, input, dt) {
    const me = State.players[State.myId];
    if (!me) return;
    const ch = charFor(me);
    const nowMs = Date.now();
    const phasing = me.ultActive && ch.id === 8 && nowMs < me.ultUntil;
    const speed = ch.baseSpeed * (me.powerup === 'speed' && nowMs < me.powerupUntil ? 1.7 : 1);
    const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(ax, ay) || 1;
    s.vx = s.vx * 0.6 + (ax / len) * speed * 0.4;
    s.vy = s.vy * 0.6 + (ay / len) * speed * 0.4;
    if (phasing) {
        s.x = Math.max(20, Math.min(ARENA.w - 20, s.x + s.vx * dt));
        s.y = Math.max(20, Math.min(ARENA.h - 20, s.y + s.vy * dt));
    } else {
        moveWithWalls(s, dt);
    }
}

// Called once per input frame (~33ms). Tags a seq, advances the local
// prediction, and returns the seq to attach to the outgoing input message.
export function advance(input, dt) {
    lastAim = input.aim;
    const me = State.players[State.myId];
    // Don't predict movement while dead/spectating — the server controls
    // respawn position. Still bump seq so acks stay monotonic.
    if (!me || !me.alive) return ++seq;
    if (!predicted) {
        // Wait for a real position (first snapshot) before predicting.
        if (!Number.isFinite(me.x) || !Number.isFinite(me.y)) return ++seq;
        predicted = { x: me.x, y: me.y, vx: me.vx || 0, vy: me.vy || 0 };
    }
    const s = ++seq;
    pending.push({ seq: s, input, dt });
    if (pending.length > 300) pending.shift();
    step(predicted, input, dt);
    return s;
}

// Called on every raw authoritative snapshot for the local player. Snaps to the
// server position, then replays inputs the server hasn't processed yet.
export function reconcile(serverP, ackSeq) {
    const me = State.players[State.myId];
    if (!me) return;
    if (!predicted) predicted = { x: serverP.x, y: serverP.y, vx: 0, vy: 0 };
    while (pending.length && pending[0].seq <= ackSeq) pending.shift();
    predicted.x = serverP.x;
    predicted.y = serverP.y;
    for (const cmd of pending) step(predicted, cmd.input, cmd.dt);
}

export function get() {
    return predicted;
}
export function getAim() {
    return lastAim;
}
export function reset() {
    seq = 0;
    pending.length = 0;
    predicted = null;
    lastAim = 0;
}
