/* game-engine.js — client-side render arrays only (all logic runs on server) */

export let bullets = [];
export let powerups = [];
export let hpItems = [];
export let firePads = [];
export let turrets = [];
export let killFeed = [];

export function pushKillFeed(data) {
    killFeed.unshift({ ...data, ts: performance.now() });
    if (killFeed.length > 5) killFeed.length = 5;
}
