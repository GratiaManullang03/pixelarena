/* snapshot.js — snapshot build/apply + client interpolation ring buffer */
import { State } from '../state.js';
import { walls, setWalls } from './physics.js';

// Ring buffer: [older, newer]
const snapBuffer = [null, null];

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
    snapBuffer[0] = snapBuffer[1];
    snapBuffer[1] = { ...snap, receivedAt };
}

export function getInterpolated(renderTime) {
    const prev = snapBuffer[0];
    const next = snapBuffer[1];
    if (!next) return null;
    if (!prev) return next;

    const span = next.receivedAt - prev.receivedAt;
    const alpha = span > 0 ? clamp01((renderTime - prev.receivedAt) / span) : 1;

    // Build interpolated player map keyed by id
    const result = {};
    for (const sp of next.players) {
        const pp = prev.players
            ? prev.players.find((p) => p.id === sp.id)
            : null;
        if (!pp) {
            result[sp.id] = sp;
            continue;
        }
        result[sp.id] = {
            ...sp,
            x: pp.x + (sp.x - pp.x) * alpha,
            y: pp.y + (sp.y - pp.y) * alpha,
            aim: lerpAngle(pp.aim, sp.aim, alpha),
        };
    }
    return result;
}

export function buildSnapshot(
    now,
    bullets,
    powerups,
    hpItems,
    firePads,
    currentMapIndex,
) {
    return {
        t: now,
        endAt: State.matchEnd,
        mapIndex: currentMapIndex,
        players: Object.values(State.players).map((p) => ({
            id: p.id,
            x: Math.round(p.x),
            y: Math.round(p.y),
            aim: +p.aim.toFixed(3),
            hp: p.hp,
            maxHp: p.maxHp || 100,
            mp: +(p.mp || 0).toFixed(1),
            maxMp: p.maxMp || 100,
            alive: p.alive,
            kills: p.kills || 0,
            color: p.color,
            avatar: p.avatar,
            name: p.name,
            charIdx: p.charIdx || 0,
            powerup: p.powerup && now < p.powerupUntil ? p.powerup : null,
            powerupUntil: p.powerupUntil || 0,
            streak: p.streak || 0,
            bounty: !!p.bounty,
            ultActive: !!p.ultActive,
            ultUntil: p.ultUntil || 0,
            critShots: p.critShots || 0,
        })),
        bullets: bullets.map((b) => ({
            id: b.id,
            x: Math.round(b.x),
            y: Math.round(b.y),
            vx: Math.round(b.vx),
            vy: Math.round(b.vy),
            color: b.color,
        })),
        powerups: powerups.map((pu) => ({
            id: pu.id,
            kind: pu.kind,
            x: pu.x,
            y: pu.y,
        })),
        hpItems: hpItems.map((h) => ({ id: h.id, x: h.x, y: h.y })),
        firePads: firePads.map((fp) => ({
            x: fp.x,
            y: fp.y,
            until: fp.until,
            color: fp.color,
        })),
        turrets: Object.values(State.players)
            .filter(
                (p) =>
                    p.ultState &&
                    p.ultState.turret &&
                    now < p.ultState.turret.until,
            )
            .map((p) => ({
                x: p.ultState.turret.x,
                y: p.ultState.turret.y,
                color: p.color,
            })),
        walls,
    };
}

export function applySnap(
    s,
    outBullets,
    outPowerups,
    outHpItems,
    outFirePads,
    outTurrets,
) {
    setWalls(s.walls);
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

    State.matchEnd = s.endAt;
    s.players.forEach((sp) => {
        State.players[sp.id] = Object.assign(State.players[sp.id] || {}, sp);
    });
    const ids = new Set(s.players.map((p) => p.id));
    Object.keys(State.players).forEach((id) => {
        if (!ids.has(id) && id !== State.myId) delete State.players[id];
    });

    pushSnapshot(s, performance.now());
}
