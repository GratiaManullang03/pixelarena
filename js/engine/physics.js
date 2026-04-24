/* physics.js — movement, wall collision, spawn, input snapshot */
import { ARENA, rectHit } from '../maps.js';
import { input } from '../input.js';
import { isMobile, getMobileInput } from '../mobile.js';

export let walls = [];

export function setWalls(w) {
    walls = w;
}

export function moveWithWalls(p, dt) {
    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;
    if (
        !walls.some((w) =>
            rectHit(nx - 16, p.y - 16, 32, 32, w.x, w.y, w.w, w.h),
        )
    )
        p.x = nx;
    else p.vx = 0;
    if (
        !walls.some((w) =>
            rectHit(p.x - 16, ny - 16, 32, 32, w.x, w.y, w.w, w.h),
        )
    )
        p.y = ny;
    else p.vy = 0;
    p.x = Math.max(20, Math.min(ARENA.w - 20, p.x));
    p.y = Math.max(20, Math.min(ARENA.h - 20, p.y));
}

export function findSpawn() {
    for (let i = 0; i < 80; i++) {
        const x = 60 + Math.random() * (ARENA.w - 120);
        const y = 60 + Math.random() * (ARENA.h - 120);
        if (
            !walls.some((w) =>
                rectHit(x - 20, y - 20, 40, 40, w.x, w.y, w.w, w.h),
            )
        )
            return { x, y };
    }
    return { x: ARENA.w / 2, y: ARENA.h / 2 };
}

export function snapshotInput(myPlayer, cam, W, H) {
    if (!myPlayer) return null;

    let merged = { ...input };
    if (isMobile()) {
        const mob = getMobileInput();
        merged.up = merged.up || mob.up;
        merged.down = merged.down || mob.down;
        merged.left = merged.left || mob.left;
        merged.right = merged.right || mob.right;
        merged.shoot = merged.shoot || mob.shoot;
        merged.ult = merged.ult || mob.ult;
        if (mob.hasAim) {
            merged.usingKeyAim = false;
            merged._mobAim = mob.aim;
        }
    }

    let aim;
    if (merged.usingKeyAim) {
        let ax = 0,
            ay = 0;
        if (merged.aimUp) ay -= 1;
        if (merged.aimDown) ay += 1;
        if (merged.aimLeft) ax -= 1;
        if (merged.aimRight) ax += 1;
        if (ax !== 0 || ay !== 0) input.aimAngle = Math.atan2(ay, ax);
        aim = input.aimAngle;
    } else if (merged._mobAim !== undefined) {
        aim = merged._mobAim;
    } else {
        const wx = merged.mx + cam.x - W / 2;
        const wy = merged.my + cam.y - H / 2;
        aim = Math.atan2(wy - myPlayer.y, wx - myPlayer.x);
    }

    return {
        up: merged.up,
        down: merged.down,
        left: merged.left,
        right: merged.right,
        shoot: merged.shoot,
        ult: merged.ult,
        aim,
    };
}
