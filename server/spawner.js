/* server/spawner.js — powerup and HP item spawning (no browser APIs) */
const { ARENA, rectHit } = require('./maps.js');

const POWERUP_KINDS = ['rapid', 'shield', 'double', 'speed'];

function spawnPowerup(rng, walls, powerups, nextId) {
    if (typeof walls === 'function') walls = walls();
    let x, y, tries = 0;
    do {
        x = 60 + rng() * (ARENA.w - 120);
        y = 60 + rng() * (ARENA.h - 120);
        tries++;
    } while (tries < 40 && walls.some((w) => rectHit(x - 14, y - 14, 28, 28, w.x, w.y, w.w, w.h)));
    powerups.push({ id: nextId(), kind: POWERUP_KINDS[Math.floor(rng() * POWERUP_KINDS.length)], x, y });
}

function spawnHpItem(rng, walls, hpItems, nextId) {
    if (typeof walls === 'function') walls = walls();
    let x, y, tries = 0;
    do {
        x = 60 + rng() * (ARENA.w - 120);
        y = 60 + rng() * (ARENA.h - 120);
        tries++;
    } while (tries < 40 && walls.some((w) => rectHit(x - 14, y - 14, 28, 28, w.x, w.y, w.w, w.h)));
    hpItems.push({ id: nextId(), x, y });
}

module.exports = { spawnPowerup, spawnHpItem };
