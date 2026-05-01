/* server/physics.js — wall collision, spawn (no browser APIs, no input/mobile) */
const { ARENA, rectHit } = require('./maps.js');

function moveWithWalls(p, dt, walls) {
    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;
    if (!walls.some((w) => rectHit(nx - 16, p.y - 16, 32, 32, w.x, w.y, w.w, w.h)))
        p.x = nx;
    else
        p.vx = 0;
    if (!walls.some((w) => rectHit(p.x - 16, ny - 16, 32, 32, w.x, w.y, w.w, w.h)))
        p.y = ny;
    else
        p.vy = 0;
    p.x = Math.max(20, Math.min(ARENA.w - 20, p.x));
    p.y = Math.max(20, Math.min(ARENA.h - 20, p.y));
}

function findSpawn(walls) {
    for (let i = 0; i < 80; i++) {
        const x = 60 + Math.random() * (ARENA.w - 120);
        const y = 60 + Math.random() * (ARENA.h - 120);
        if (!walls.some((w) => rectHit(x - 20, y - 20, 40, 40, w.x, w.y, w.w, w.h)))
            return { x, y };
    }
    return { x: ARENA.w / 2, y: ARENA.h / 2 };
}

module.exports = { moveWithWalls, findSpawn };
