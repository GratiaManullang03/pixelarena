/* spawner.js — spawnPowerup, spawnHpItem */
import { ARENA, rectHit } from '../maps.js';
import { walls } from './physics.js';

const POWERUP_KINDS = ['rapid', 'shield', 'double', 'speed'];

export function spawnPowerup(rng, powerups, nextId) {
    let x,
        y,
        tries = 0;
    do {
        x = 60 + rng() * (ARENA.w - 120);
        y = 60 + rng() * (ARENA.h - 120);
        tries++;
    } while (
        tries < 40 &&
        walls.some((w) => rectHit(x - 14, y - 14, 28, 28, w.x, w.y, w.w, w.h))
    );
    powerups.push({
        id: nextId(),
        kind: POWERUP_KINDS[Math.floor(rng() * POWERUP_KINDS.length)],
        x,
        y,
    });
}

export function spawnHpItem(rng, hpItems, nextId) {
    let x,
        y,
        tries = 0;
    do {
        x = 60 + rng() * (ARENA.w - 120);
        y = 60 + rng() * (ARENA.h - 120);
        tries++;
    } while (
        tries < 40 &&
        walls.some((w) => rectHit(x - 14, y - 14, 28, 28, w.x, w.y, w.w, w.h))
    );
    hpItems.push({ id: nextId(), x, y });
}
