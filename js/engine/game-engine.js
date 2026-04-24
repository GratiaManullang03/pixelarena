/* game-engine.js — exports, reset, pushKillFeed, hostTick */
import { State } from '../state.js';
import { CHARACTERS } from '../characters.js';
import { ARENA, MAPS, mulberry32, rectHit } from '../maps.js';
import { walls, setWalls, moveWithWalls, findSpawn } from './physics.js';
import { buildSnapshot } from './snapshot.js';
import { activateUlt, onKill, setBulletsRef } from './ult-engine.js';
import { spawnHit, spawnPickupFx, floaters, shake } from './particles.js';
import { spawnPowerup, spawnHpItem } from './spawner.js';
import * as Net from '../net.js';
import * as Audio from '../audio.js';

export let bullets = [];
export let powerups = [];
export let hpItems = [];
export let firePads = [];
export let turrets = [];
export let killFeed = [];

let rng = mulberry32(1);
let nextBulletId = 1;
let nextPupId = 1;
let lastSpawn = 0;
let lastHpSpawn = 0;
let currentMapIndex = 0;

setBulletsRef(bullets, () => nextBulletId++);

export function getCurrentMapName() {
    return MAPS[currentMapIndex] ? MAPS[currentMapIndex].name : '';
}

export function pushKillFeed(data) {
    killFeed.unshift({ ...data, ts: performance.now() });
    if (killFeed.length > 5) killFeed.length = 5;
}

export function reset(seed) {
    rng = mulberry32(seed >>> 0 || 1);
    bullets.length = 0;
    powerups.length = 0;
    hpItems.length = 0;
    firePads.length = 0;
    turrets.length = 0;
    killFeed.length = 0;

    currentMapIndex = (seed >>> 0) % MAPS.length;
    const map = MAPS[currentMapIndex];
    const bth = 24;
    const newWalls = [
        { x: 0, y: 0, w: ARENA.w, h: bth },
        { x: 0, y: ARENA.h - bth, w: ARENA.w, h: bth },
        { x: 0, y: 0, w: bth, h: ARENA.h },
        { x: ARENA.w - bth, y: 0, w: bth, h: ARENA.h },
    ];
    map.obs.forEach((o) =>
        newWalls.push({ x: o[0], y: o[1], w: o[2], h: o[3] }),
    );
    setWalls(newWalls);

    const spots = [];
    for (let i = 0; i < 200 && spots.length < 16; i++) {
        const x = 60 + rng() * (ARENA.w - 120);
        const y = 60 + rng() * (ARENA.h - 120);
        if (
            !newWalls.some((w) =>
                rectHit(x - 20, y - 20, 40, 40, w.x, w.y, w.w, w.h),
            )
        )
            spots.push({ x, y });
    }

    Object.values(State.players).forEach((p, i) => {
        const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
        const s = spots[i % spots.length];
        Object.assign(p, {
            x: s.x,
            y: s.y,
            vx: 0,
            vy: 0,
            hp: ch.baseHp,
            maxHp: ch.baseHp,
            mp: 0,
            maxMp: ch.ultCost,
            alive: true,
            kills: 0,
            aim: 0,
            powerup: null,
            powerupUntil: 0,
            lastShot: 0,
            respawnAt: 0,
            streak: 0,
            bounty: false,
            ultActive: false,
            ultUntil: 0,
            ultState: null,
            critShots: 0,
            lastUlt: 0,
            _lastFire: 0,
            _pyroLastPassive: 0,
        });
    });

    lastSpawn = performance.now();
    lastHpSpawn = performance.now();
}

export function hostTick(dt, now, endMatchCallback) {
    if (Object.keys(State.players).length === 1 && State.running) {
        endMatchCallback();
        return;
    }

    // Mana regen
    Object.values(State.players).forEach((p) => {
        if (p.alive) p.mp = Math.min(p.maxMp, (p.mp || 0) + 8 * dt);
    });

    Object.values(State.players).forEach((p) => _processPlayer(p, dt, now));
    _tickBullets(dt, now);
    _tickFirePads(dt, now);
    _tickPickups(now);

    if (!hostTick._lastSnap || now - hostTick._lastSnap > 60) {
        hostTick._lastSnap = now;
        Net.send(
            'snapshot',
            buildSnapshot(
                now,
                bullets,
                powerups,
                hpItems,
                firePads,
                currentMapIndex,
            ),
        );
    }

    if (now >= State.matchEnd) endMatchCallback();
}

function _processPlayer(p, dt, now) {
    const ip = p.inputBuf;
    if (!ip) return;
    p.aim = ip.aim;

    if (!p.alive) {
        if (now >= p.respawnAt) {
            const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
            const s = findSpawn();
            Object.assign(p, {
                alive: true,
                hp: ch.baseHp,
                mp: 0,
                streak: 0,
                x: s.x,
                y: s.y,
                vx: 0,
                vy: 0,
            });
        }
        return;
    }

    const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
    _movePlayer(p, ch, ip, dt, now);
    _charPassives(p, ch, ip, dt, now);
    _processShooting(p, ch, ip, now);
    _processUlt(p, ch, ip, now);
}

function _movePlayer(p, ch, ip, dt, now) {
    const phasing = p.ultActive && ch.id === 8 && now < p.ultUntil;
    const speed =
        ch.baseSpeed *
        (p.powerup === 'speed' && now < p.powerupUntil ? 1.7 : 1);
    let ax = (ip.right ? 1 : 0) - (ip.left ? 1 : 0);
    let ay = (ip.down ? 1 : 0) - (ip.up ? 1 : 0);
    const len = Math.hypot(ax, ay) || 1;
    p.vx = p.vx * 0.6 + (ax / len) * speed * 0.4;
    p.vy = p.vy * 0.6 + (ay / len) * speed * 0.4;
    if (phasing) {
        p.x = Math.max(20, Math.min(ARENA.w - 20, p.x + p.vx * dt));
        p.y = Math.max(20, Math.min(ARENA.h - 20, p.y + p.vy * dt));
    } else {
        moveWithWalls(p, dt);
    }
}

function _charPassives(p, ch, ip, dt, now) {
    // Pyro passive fire trail
    if (ch.id === 9 && (ip.up || ip.down || ip.left || ip.right)) {
        const inferno = p.ultActive && p._pyroInferno && now < p.ultUntil;
        if (now - (p._pyroLastPassive || 0) > (inferno ? 200 : 400)) {
            p._pyroLastPassive = now;
            firePads.push({
                x: p.x,
                y: p.y,
                until: now + 800,
                owner: p.id,
                color: p.color,
                dmg: inferno ? 12 : 4,
            });
        }
    }
    // Tank Fortify HP regen
    if (p.ultActive && ch.id === 0 && now < p.ultUntil)
        p.hp = Math.min(p.maxHp, p.hp + 30 * dt);
    // Reaper Soul Drain
    if (p.ultActive && ch.id === 11 && now < p.ultUntil)
        _reaperDrain(p, dt, now);
    // Warden turret
    if (p.ultState?.turret) _wardenTurret(p, now);
}

function _reaperDrain(p, dt, now) {
    Object.values(State.players).forEach((enemy) => {
        if (!enemy.alive || enemy.id === p.id) return;
        if (Math.hypot(p.x - enemy.x, p.y - enemy.y) >= 120) return;
        const drain = 15 * dt;
        enemy.hp -= drain;
        p.hp = Math.min(p.maxHp, p.hp + drain * 0.5);
        if (enemy.hp > 0) return;
        enemy.alive = false;
        enemy.respawnAt = now + 3000;
        pushKillFeed(onKill(p, enemy, now));
        Audio.boom();
    });
}

function _wardenTurret(p, now) {
    const t = p.ultState.turret;
    if (now > t.until) {
        p.ultState = null;
        p.ultActive = false;
        return;
    }
    if (now - (t.lastShot || 0) < 400) return;
    let target = null,
        minDist = 400;
    Object.values(State.players).forEach((enemy) => {
        if (!enemy.alive || enemy.id === p.id) return;
        const d = Math.hypot(t.x - enemy.x, t.y - enemy.y);
        if (d < minDist) {
            minDist = d;
            target = enemy;
        }
    });
    if (!target) return;
    t.lastShot = now;
    const ang = Math.atan2(target.y - t.y, target.x - t.x);
    bullets.push({
        id: nextBulletId++,
        owner: p.id,
        x: t.x,
        y: t.y,
        vx: Math.cos(ang) * 600,
        vy: Math.sin(ang) * 600,
        life: 1.2,
        dmg: 12,
        color: p.color,
        size: 4,
    });
}

function _processShooting(p, ch, ip, now) {
    const rapidActive =
        (p.powerup === 'rapid' && now < p.powerupUntil) ||
        (p.ultActive && ch.id === 7 && now < p.ultUntil);
    const fireRate = rapidActive
        ? Math.round((ch.fireRateMs || 220) * 0.38)
        : ch.fireRateMs || 220;
    if (!ip.shoot || now - (p.lastShot || 0) < fireRate) return;
    p.lastShot = now;

    if (ch.attackType === 'melee') {
        _meleeSweep(p, ch, now);
        return;
    }

    let baseDmg = ch.bulletDmg;
    if (p.powerup === 'double' && now < p.powerupUntil) baseDmg *= 2;
    if (p.ultActive && ch.id === 1 && p.critShots > 0) {
        baseDmg = Math.round(baseDmg * 3);
        if (--p.critShots <= 0) p.ultActive = false;
    }

    const mkBullet = (aim) => {
        const b = {
            id: nextBulletId++,
            owner: p.id,
            x: p.x + Math.cos(aim) * 22,
            y: p.y + Math.sin(aim) * 22,
            vx: Math.cos(aim) * (ch.bulletSpeed || 700),
            vy: Math.sin(aim) * (ch.bulletSpeed || 700),
            life: ch.bulletLife || 1.1,
            dmg: baseDmg,
            color: p.color,
            size: ch.bulletSize || 4,
        };
        if (ch.attackType === 'pierce') b.pierceLeft = 1;
        if (ch.attackType === 'phase-bullet') b.phaseWall = true;
        if (ch.attackType === 'ghost') b.ghostPierceLeft = 1;
        bullets.push(b);
    };

    if (ch.attackType === 'spread') {
        mkBullet(p.aim);
        mkBullet(p.aim + 0.262);
        mkBullet(p.aim - 0.262);
    } else {
        mkBullet(p.aim);
    }
    Net.send('shot', {
        x: p.x + Math.cos(p.aim) * 22,
        y: p.y + Math.sin(p.aim) * 22,
        color: p.color,
    });
    if (p.id === State.myId) Audio.shoot();
}

function _meleeSweep(p, ch, now) {
    const half = (140 * Math.PI) / 360;
    Object.values(State.players).forEach((enemy) => {
        if (!enemy.alive || enemy.id === p.id) return;
        const dx = enemy.x - p.x,
            dy = enemy.y - p.y;
        if (Math.hypot(dx, dy) > 80) return;
        let diff = Math.atan2(dy, dx) - p.aim;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > half) return;
        let dmg = ch.bulletDmg;
        if (p.ultActive && ch.id === 6 && p.critShots > 0) {
            dmg = Math.round(dmg * 2.5);
            if (--p.critShots <= 0) p.ultActive = false;
        }
        enemy.hp -= dmg;
        Net.send('hit', {
            x: enemy.x,
            y: enemy.y,
            dmg,
            color: enemy.color,
            killed: enemy.hp <= 0,
        });
        spawnHit(enemy.x, enemy.y, dmg, enemy.color);
        shake(5);
        if (enemy.hp > 0) return;
        enemy.alive = false;
        enemy.respawnAt = now + 3000;
        pushKillFeed(onKill(p, enemy, now));
        Audio.boom();
    });
    Net.send('shot', { x: p.x, y: p.y, color: p.color });
    if (p.id === State.myId) Audio.shoot();
}

function _processUlt(p, ch, ip, now) {
    if (
        ip.ult &&
        !ip._ultUsed &&
        (p.mp || 0) >= p.maxMp &&
        now - (p.lastUlt || 0) > 500
    ) {
        ip._ultUsed = true;
        p.lastUlt = now;
        activateUlt(p, ch, now);
    }
    if (!ip.ult) ip._ultUsed = false;
}

function _tickBullets(dt, now) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) {
            bullets.splice(i, 1);
            continue;
        }
        if (
            !b.phaseWall &&
            walls.some((w) =>
                rectHit(b.x - 3, b.y - 3, 6, 6, w.x, w.y, w.w, w.h),
            )
        ) {
            bullets.splice(i, 1);
            continue;
        }
        if (_bulletHitPlayers(b, now)) bullets.splice(i, 1);
    }
}

function _bulletHitPlayers(b, now) {
    for (const p of Object.values(State.players)) {
        if (!p.alive || p.id === b.owner) continue;
        const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
        if (p.ultActive && ch.id === 3 && now < p.ultUntil) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) >= 18 + (b.size || 4)) continue;

        const shielded =
            (p.powerup === 'shield' && now < p.powerupUntil) ||
            (p.ultActive && ch.id === 0 && now < p.ultUntil);
        const dmg = shielded ? Math.floor(b.dmg * 0.25) : b.dmg;
        const ownerCh =
            CHARACTERS[State.players[b.owner]?.charIdx] || CHARACTERS[0];

        if (ownerCh.attackType === 'knockback') {
            const ang = Math.atan2(p.y - b.y, p.x - b.x);
            p.vx = (p.vx || 0) + Math.cos(ang) * 300;
            p.vy = (p.vy || 0) + Math.sin(ang) * 300;
        }
        p.hp -= dmg;
        if (ownerCh.attackType === 'lifesteal') {
            const owner = State.players[b.owner];
            if (owner) owner.hp = Math.min(owner.maxHp, owner.hp + dmg * 0.2);
        }
        if (ownerCh.attackType === 'lifesteal-lite') {
            const owner = State.players[b.owner];
            if (owner) owner.hp = Math.min(owner.maxHp, owner.hp + 5);
        }
        Net.send('hit', {
            x: p.x,
            y: p.y,
            dmg,
            color: p.color,
            killed: p.hp <= 0,
        });
        spawnHit(p.x, p.y, dmg, p.color);
        shake(5);
        if (p.hp <= 0) {
            p.alive = false;
            p.respawnAt = now + 3000;
            const killer = State.players[b.owner];
            if (killer) pushKillFeed(onKill(killer, p, now));
            Audio.boom();
        }
        if (b.pierceLeft !== undefined) {
            b.pierceLeft--;
            return b.pierceLeft < 0;
        }
        if (b.ghostPierceLeft !== undefined) {
            b.ghostPierceLeft--;
            return b.ghostPierceLeft < 0;
        }
        return true;
    }
    return false;
}

function _tickFirePads(dt, now) {
    for (let i = firePads.length - 1; i >= 0; i--) {
        const fp = firePads[i];
        if (now > fp.until) {
            firePads.splice(i, 1);
            continue;
        }
        Object.values(State.players).forEach((p) => {
            if (!p.alive || p.id === fp.owner) return;
            if (Math.hypot(p.x - fp.x, p.y - fp.y) >= 20) return;
            p.hp -= (fp.dmg || 4) * dt;
            if (p.hp > 0) return;
            p.alive = false;
            p.respawnAt = now + 3000;
            const killer = State.players[fp.owner];
            if (killer) pushKillFeed(onKill(killer, p, now));
        });
    }
}

function _tickPickups(now) {
    if (now - lastSpawn > 6000 && powerups.length < 4) {
        lastSpawn = now;
        spawnPowerup(rng, powerups, () => nextPupId++);
    }
    if (now - lastHpSpawn > 10000 && hpItems.length < 3) {
        lastHpSpawn = now;
        spawnHpItem(rng, hpItems, () => nextPupId++);
    }
    for (let i = powerups.length - 1; i >= 0; i--) {
        const pu = powerups[i];
        for (const p of Object.values(State.players)) {
            if (!p.alive || Math.hypot(p.x - pu.x, p.y - pu.y) >= 24) continue;
            p.powerup = pu.kind;
            p.powerupUntil = now + 7000;
            Net.send('pickup', { x: pu.x, y: pu.y });
            spawnPickupFx(pu.x, pu.y);
            Audio.pickup();
            powerups.splice(i, 1);
            break;
        }
    }
    for (let i = hpItems.length - 1; i >= 0; i--) {
        const hi = hpItems[i];
        for (const p of Object.values(State.players)) {
            if (!p.alive || Math.hypot(p.x - hi.x, p.y - hi.y) >= 22) continue;
            p.hp = Math.min(p.maxHp, p.hp + 30);
            floaters.push({
                x: hi.x,
                y: hi.y,
                text: '+30HP',
                life: 1.2,
                color: '#55ffa1',
            });
            Net.send('pickup', { x: hi.x, y: hi.y });
            spawnPickupFx(hi.x, hi.y);
            Audio.pickup();
            hpItems.splice(i, 1);
            break;
        }
    }
}
