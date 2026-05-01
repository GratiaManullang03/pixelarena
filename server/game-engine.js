/* server/game-engine.js — server-authoritative hostTick and reset */
const { CHARACTERS } = require('./characters.js');
const { ARENA, MAPS, mulberry32, rectHit } = require('./maps.js');
const { moveWithWalls, findSpawn } = require('./physics.js');
const { spawnPowerup, spawnHpItem } = require('./spawner.js');
const { buildSnapshot } = require('./snapshot.js');
const { activateUlt, onKill } = require('./ult-engine.js');

function createRoomState() {
    return {
        players: {},
        bullets: [],
        powerups: [],
        hpItems: [],
        firePads: [],
        killFeed: [],
        walls: [],
        gameMode: 'classic',
        running: false,
        matchStart: 0,
        matchEnd: 0,
        currentMapIndex: 0,
        rng: mulberry32(1),
        nextBulletId: 1,
        nextPupId: 1,
        lastSpawn: 0,
        lastHpSpawn: 0,
        lastSnap: 0,
        _earlySnapCount: 0,
        intervalId: null,
    };
}

function resetRoom(state, seed) {
    state.rng = mulberry32(seed >>> 0 || 1);
    state.bullets.length = 0;
    state.powerups.length = 0;
    state.hpItems.length = 0;
    state.firePads.length = 0;
    state.killFeed.length = 0;
    state.nextBulletId = 1;
    state.nextPupId = 1;
    state._earlySnapCount = 0;

    state.currentMapIndex = (seed >>> 0) % MAPS.length;
    const map = MAPS[state.currentMapIndex];
    const bth = 24;
    const newWalls = [
        { x: 0, y: 0, w: ARENA.w, h: bth },
        { x: 0, y: ARENA.h - bth, w: ARENA.w, h: bth },
        { x: 0, y: 0, w: bth, h: ARENA.h },
        { x: ARENA.w - bth, y: 0, w: bth, h: ARENA.h },
    ];
    map.obs.forEach((o) => newWalls.push({ x: o[0], y: o[1], w: o[2], h: o[3] }));
    state.walls = newWalls;

    const spots = [];
    for (let i = 0; i < 200 && spots.length < 16; i++) {
        const x = 60 + state.rng() * (ARENA.w - 120);
        const y = 60 + state.rng() * (ARENA.h - 120);
        if (!newWalls.some((w) => rectHit(x - 20, y - 20, 40, 40, w.x, w.y, w.w, w.h)))
            spots.push({ x, y });
    }

    const now = Date.now();
    Object.values(state.players).forEach((p, i) => {
        const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
        const s = spots[i % spots.length] || { x: ARENA.w / 2, y: ARENA.h / 2 };
        Object.assign(p, {
            x: s.x, y: s.y, vx: 0, vy: 0,
            hp: ch.baseHp, maxHp: ch.baseHp,
            mp: 0, maxMp: ch.ultCost,
            alive: true, kills: 0, aim: 0,
            powerup: null, powerupUntil: 0,
            lastShot: 0, respawnAt: 0,
            streak: 0, bounty: false,
            ultActive: false, ultUntil: 0, ultState: null,
            critShots: 0, lastUlt: 0,
            _lastFire: 0, _pyroLastPassive: 0,
            livesLeft: 3, isSpectator: false,
        });
    });

    state.lastSpawn = now;
    state.lastHpSpawn = now;
}

function pushKillFeed(state, data) {
    state.killFeed.unshift({ ...data, ts: Date.now() });
    if (state.killFeed.length > 5) state.killFeed.length = 5;
}

function _killPlayer(state, victim, killer, now, broadcast) {
    if (state.gameMode === 'survival') {
        victim.livesLeft = Math.max(0, (victim.livesLeft ?? 3) - 1);
        if (victim.livesLeft <= 0) {
            victim.isSpectator = true;
            victim.alive = false;
            victim.respawnAt = Infinity;
            broadcast('spectator', { id: victim.id });
        } else {
            victim.alive = false;
            victim.respawnAt = now + 3000;
        }
    } else {
        victim.alive = false;
        victim.respawnAt = now + 3000;
    }
    if (killer) pushKillFeed(state, onKill(state, killer, victim, now, broadcast));
    broadcast('sfx', { sfx: 'boom' });
}

function hostTick(state, dt, now, broadcast, endMatchCallback) {
    const ps = Object.values(state.players);

    if (state.gameMode === 'survival') {
        const alive = ps.filter((p) => !p.isSpectator);
        if (alive.length <= 1 && ps.length > 1) { endMatchCallback(); return; }
    } else {
        if (ps.length === 1 && state.running) { endMatchCallback(); return; }
    }

    // Mana regen
    ps.forEach((p) => { if (p.alive) p.mp = Math.min(p.maxMp, (p.mp || 0) + 8 * dt); });

    ps.forEach((p) => _processPlayer(state, p, dt, now, broadcast));
    _tickBullets(state, dt, now, broadcast);
    _tickFirePads(state, dt, now, broadcast);
    _tickPickups(state, now, broadcast);

    if (now - state.lastSnap > 33) {
        state.lastSnap = now;
        const snap = buildSnapshot(state, now);
        // Include walls in first 5 snapshots as fallback for packet loss
        if (state._earlySnapCount < 5) { snap.walls = state.walls; state._earlySnapCount++; }
        broadcast('snapshot', snap);
    }

    if (now >= state.matchEnd) endMatchCallback();
}

function _processPlayer(state, p, dt, now, broadcast) {
    const ip = p.inputBuf;
    if (!ip) return;
    p.aim = ip.aim;

    if (!p.alive) {
        if (p.isSpectator) return;
        if (now >= p.respawnAt) {
            const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
            const s = findSpawn(state.walls);
            Object.assign(p, { alive: true, hp: ch.baseHp, mp: 0, streak: 0, x: s.x, y: s.y, vx: 0, vy: 0 });
        }
        return;
    }

    const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
    _movePlayer(state, p, ch, ip, dt, now);
    _charPassives(state, p, ch, ip, dt, now, broadcast);
    _processShooting(state, p, ch, ip, now, broadcast);
    _processUlt(state, p, ch, ip, now, broadcast);
}

function _movePlayer(state, p, ch, ip, dt, now) {
    const phasing = p.ultActive && ch.id === 8 && now < p.ultUntil;
    const speed = ch.baseSpeed * (p.powerup === 'speed' && now < p.powerupUntil ? 1.7 : 1);
    let ax = (ip.right ? 1 : 0) - (ip.left ? 1 : 0);
    let ay = (ip.down ? 1 : 0) - (ip.up ? 1 : 0);
    const len = Math.hypot(ax, ay) || 1;
    p.vx = p.vx * 0.6 + (ax / len) * speed * 0.4;
    p.vy = p.vy * 0.6 + (ay / len) * speed * 0.4;
    if (phasing) {
        p.x = Math.max(20, Math.min(ARENA.w - 20, p.x + p.vx * dt));
        p.y = Math.max(20, Math.min(ARENA.h - 20, p.y + p.vy * dt));
    } else {
        moveWithWalls(p, dt, state.walls);
    }
}

function _charPassives(state, p, ch, ip, dt, now, broadcast) {
    // Pyro passive fire trail
    if (ch.id === 9 && (ip.up || ip.down || ip.left || ip.right)) {
        const inferno = p.ultActive && p._pyroInferno && now < p.ultUntil;
        if (now - (p._pyroLastPassive || 0) > (inferno ? 200 : 400)) {
            p._pyroLastPassive = now;
            state.firePads.push({ x: p.x, y: p.y, until: now + 800, owner: p.id, color: p.color, dmg: inferno ? 12 : 4 });
        }
    }
    // Tank Fortify HP regen
    if (p.ultActive && ch.id === 0 && now < p.ultUntil)
        p.hp = Math.min(p.maxHp, p.hp + 30 * dt);
    // Reaper Soul Drain
    if (p.ultActive && ch.id === 11 && now < p.ultUntil)
        _reaperDrain(state, p, dt, now, broadcast);
    // Warden turret
    if (p.ultState?.turret) _wardenTurret(state, p, now, broadcast);
}

function _reaperDrain(state, p, dt, now, broadcast) {
    Object.values(state.players).forEach((enemy) => {
        if (!enemy.alive || enemy.id === p.id) return;
        if (Math.hypot(p.x - enemy.x, p.y - enemy.y) >= 120) return;
        const drain = 15 * dt;
        enemy.hp -= drain;
        p.hp = Math.min(p.maxHp, p.hp + drain * 0.5);
        if (enemy.hp > 0) return;
        _killPlayer(state, enemy, p, now, broadcast);
    });
}

function _wardenTurret(state, p, now, broadcast) {
    const t = p.ultState.turret;
    if (now > t.until) { p.ultState = null; p.ultActive = false; return; }
    if (now - (t.lastShot || 0) < 400) return;
    let target = null, minDist = 400;
    Object.values(state.players).forEach((enemy) => {
        if (!enemy.alive || enemy.id === p.id) return;
        const d = Math.hypot(t.x - enemy.x, t.y - enemy.y);
        if (d < minDist) { minDist = d; target = enemy; }
    });
    if (!target) return;
    t.lastShot = now;
    const ang = Math.atan2(target.y - t.y, target.x - t.x);
    state.bullets.push({ id: state.nextBulletId++, owner: p.id, x: t.x, y: t.y, vx: Math.cos(ang) * 600, vy: Math.sin(ang) * 600, life: 1.2, dmg: 12, color: p.color, size: 4 });
}

function _processShooting(state, p, ch, ip, now, broadcast) {
    const rapidActive = (p.powerup === 'rapid' && now < p.powerupUntil) || (p.ultActive && ch.id === 7 && now < p.ultUntil);
    const fireRate = rapidActive ? Math.round((ch.fireRateMs || 220) * 0.38) : ch.fireRateMs || 220;
    if (!ip.shoot || now - (p.lastShot || 0) < fireRate) return;
    p.lastShot = now;

    if (ch.attackType === 'melee') { _meleeSweep(state, p, ch, now, broadcast); return; }

    let baseDmg = ch.bulletDmg;
    if (p.powerup === 'double' && now < p.powerupUntil) baseDmg *= 2;
    if (p.ultActive && ch.id === 1 && p.critShots > 0) {
        baseDmg = Math.round(baseDmg * 3);
        if (--p.critShots <= 0) p.ultActive = false;
    }

    const mkBullet = (aim) => {
        const b = {
            id: state.nextBulletId++,
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
        state.bullets.push(b);
    };

    if (ch.attackType === 'spread') {
        mkBullet(p.aim); mkBullet(p.aim + 0.262); mkBullet(p.aim - 0.262);
    } else {
        mkBullet(p.aim);
    }
    broadcast('shot', { x: p.x + Math.cos(p.aim) * 22, y: p.y + Math.sin(p.aim) * 22, color: p.color });
}

function _meleeSweep(state, p, ch, now, broadcast) {
    const half = (140 * Math.PI) / 360;
    Object.values(state.players).forEach((enemy) => {
        if (!enemy.alive || enemy.id === p.id) return;
        const dx = enemy.x - p.x, dy = enemy.y - p.y;
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
        broadcast('hit', { x: enemy.x, y: enemy.y, dmg, color: enemy.color, killed: enemy.hp <= 0 });
        if (enemy.hp <= 0) _killPlayer(state, enemy, p, now, broadcast);
    });
    broadcast('shot', { x: p.x, y: p.y, color: p.color });
}

function _processUlt(state, p, ch, ip, now, broadcast) {
    if (ip.ult && !ip._ultUsed && (p.mp || 0) >= p.maxMp && now - (p.lastUlt || 0) > 500) {
        ip._ultUsed = true;
        p.lastUlt = now;
        activateUlt(state, p, ch, now, broadcast);
    }
    if (!ip.ult) ip._ultUsed = false;
}

function _tickBullets(state, dt, now, broadcast) {
    const walls = state.walls;
    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) { state.bullets.splice(i, 1); continue; }
        if (!b.phaseWall && walls.some((w) => rectHit(b.x - 3, b.y - 3, 6, 6, w.x, w.y, w.w, w.h))) {
            state.bullets.splice(i, 1); continue;
        }
        if (_bulletHitPlayers(state, b, now, broadcast)) state.bullets.splice(i, 1);
    }
}

function _bulletHitPlayers(state, b, now, broadcast) {
    for (const p of Object.values(state.players)) {
        if (!p.alive || p.id === b.owner) continue;
        const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
        if (p.ultActive && ch.id === 3 && now < p.ultUntil) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) >= 18 + (b.size || 4)) continue;

        const shielded = (p.powerup === 'shield' && now < p.powerupUntil) || (p.ultActive && ch.id === 0 && now < p.ultUntil);
        const dmg = shielded ? Math.floor(b.dmg * 0.25) : b.dmg;
        const ownerCh = CHARACTERS[state.players[b.owner]?.charIdx] || CHARACTERS[0];

        if (ownerCh.attackType === 'knockback') {
            const ang = Math.atan2(p.y - b.y, p.x - b.x);
            p.vx = (p.vx || 0) + Math.cos(ang) * 300;
            p.vy = (p.vy || 0) + Math.sin(ang) * 300;
        }
        p.hp -= dmg;
        if (ownerCh.attackType === 'lifesteal') {
            const owner = state.players[b.owner];
            if (owner) owner.hp = Math.min(owner.maxHp, owner.hp + dmg * 0.2);
        }
        if (ownerCh.attackType === 'lifesteal-lite') {
            const owner = state.players[b.owner];
            if (owner) owner.hp = Math.min(owner.maxHp, owner.hp + 5);
        }
        broadcast('hit', { x: p.x, y: p.y, dmg, color: p.color, killed: p.hp <= 0 });
        if (p.hp <= 0) {
            const killer = state.players[b.owner];
            _killPlayer(state, p, killer, now, broadcast);
        }
        if (b.pierceLeft !== undefined) { b.pierceLeft--; return b.pierceLeft < 0; }
        if (b.ghostPierceLeft !== undefined) { b.ghostPierceLeft--; return b.ghostPierceLeft < 0; }
        return true;
    }
    return false;
}

function _tickFirePads(state, dt, now, broadcast) {
    for (let i = state.firePads.length - 1; i >= 0; i--) {
        const fp = state.firePads[i];
        if (now > fp.until) { state.firePads.splice(i, 1); continue; }
        Object.values(state.players).forEach((p) => {
            if (!p.alive || p.id === fp.owner) return;
            if (Math.hypot(p.x - fp.x, p.y - fp.y) >= 20) return;
            p.hp -= (fp.dmg || 4) * dt;
            if (p.hp > 0) return;
            p.alive = false;
            p.respawnAt = now + 3000;
            const killer = state.players[fp.owner];
            if (killer) pushKillFeed(state, onKill(state, killer, p, now, broadcast));
        });
    }
}

function _tickPickups(state, now, broadcast) {
    if (now - state.lastSpawn > 6000 && state.powerups.length < 4) {
        state.lastSpawn = now;
        spawnPowerup(state.rng, state.walls, state.powerups, () => state.nextPupId++);
    }
    if (now - state.lastHpSpawn > 10000 && state.hpItems.length < 3) {
        state.lastHpSpawn = now;
        spawnHpItem(state.rng, state.walls, state.hpItems, () => state.nextPupId++);
    }
    for (let i = state.powerups.length - 1; i >= 0; i--) {
        const pu = state.powerups[i];
        for (const p of Object.values(state.players)) {
            if (!p.alive || Math.hypot(p.x - pu.x, p.y - pu.y) >= 24) continue;
            p.powerup = pu.kind;
            p.powerupUntil = now + 7000;
            broadcast('pickup', { x: pu.x, y: pu.y });
            broadcast('sfx', { sfx: 'pickup' });
            state.powerups.splice(i, 1);
            break;
        }
    }
    for (let i = state.hpItems.length - 1; i >= 0; i--) {
        const hi = state.hpItems[i];
        for (const p of Object.values(state.players)) {
            if (!p.alive || Math.hypot(p.x - hi.x, p.y - hi.y) >= 22) continue;
            p.hp = Math.min(p.maxHp, p.hp + 30);
            broadcast('pickup', { x: hi.x, y: hi.y });
            broadcast('sfx', { sfx: 'pickup' });
            state.hpItems.splice(i, 1);
            break;
        }
    }
}

module.exports = { createRoomState, resetRoom, hostTick };
