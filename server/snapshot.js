/* server/snapshot.js — buildSnapshot only (no interpolation, no browser APIs) */

function buildSnapshot(state, now) {
    const { players, bullets, powerups, hpItems, firePads, currentMapIndex } = state;
    return {
        t: now,
        endAt: state.matchEnd,
        mapIndex: currentMapIndex,
        players: Object.values(players).map((p) => ({
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
            livesLeft: p.livesLeft !== undefined ? p.livesLeft : 3,
            isSpectator: !!p.isSpectator,
        })),
        bullets: bullets.map((b) => ({
            id: b.id,
            x: Math.round(b.x),
            y: Math.round(b.y),
            vx: Math.round(b.vx),
            vy: Math.round(b.vy),
            color: b.color,
        })),
        powerups: powerups.map((pu) => ({ id: pu.id, kind: pu.kind, x: pu.x, y: pu.y })),
        hpItems: hpItems.map((h) => ({ id: h.id, x: h.x, y: h.y })),
        firePads: firePads.map((fp) => ({ x: fp.x, y: fp.y, until: fp.until, color: fp.color })),
        turrets: Object.values(players)
            .filter((p) => p.ultState && p.ultState.turret && now < p.ultState.turret.until)
            .map((p) => ({ x: p.ultState.turret.x, y: p.ultState.turret.y, color: p.color })),
    };
}

module.exports = { buildSnapshot };
