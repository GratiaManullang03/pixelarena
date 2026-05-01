/* server/ult-engine.js — activateUlt, onKill (no Audio, no browser APIs) */
const { ARENA } = require('./maps.js');

function activateUlt(state, p, ch, now, broadcast) {
    p.mp = 0;
    p.ultActive = true;

    switch (ch.id) {
        case 0: // Tank — Fortify: shield + regen
            p.ultUntil = now + 4000;
            break;
        case 1: // Sniper — Overcharge: next shot 3x
            p.critShots = 1;
            p.ultUntil = now + 8000;
            break;
        case 2: // Blitz — Dash: teleport forward
            p.x += Math.cos(p.aim) * 160;
            p.y += Math.sin(p.aim) * 160;
            p.x = Math.max(20, Math.min(ARENA.w - 20, p.x));
            p.y = Math.max(20, Math.min(ARENA.h - 20, p.y));
            p.ultActive = false;
            break;
        case 3: // Phantom — Cloak: invisible 3s
            p.ultUntil = now + 3000;
            break;
        case 4: // Bomber — Nova: 8 radial bullets
            for (let a = 0; a < 8; a++) {
                const ang = (a / 8) * Math.PI * 2;
                state.bullets.push({
                    id: state.nextBulletId++,
                    owner: p.id,
                    x: p.x + Math.cos(ang) * 20,
                    y: p.y + Math.sin(ang) * 20,
                    vx: Math.cos(ang) * 600,
                    vy: Math.sin(ang) * 600,
                    life: 1.0,
                    dmg: 22,
                    color: p.color,
                    size: 4,
                });
            }
            p.ultActive = false;
            break;
        case 5: // Medic — Heal Pulse: +40 HP
            p.hp = Math.min(p.maxHp, p.hp + 40);
            p.ultActive = false;
            break;
        case 6: // Assassin — Death Mark: next 3 shots crit
            p.critShots = 3;
            p.ultUntil = now + 10000;
            break;
        case 7: // Brute — Rampage: rapid fire 4s
            p.ultUntil = now + 4000;
            break;
        case 8: // Ghost — Phase: walk through walls 2s
            p.ultUntil = now + 2000;
            break;
        case 9: // Pyro — Inferno: fire trail 3s
            p.ultUntil = now + 3000;
            p._lastFire = 0;
            p._pyroInferno = true;
            break;
        case 10: // Warden — Turret: auto turret 5s
            p.ultState = { turret: { x: p.x, y: p.y, until: now + 5000, lastShot: 0 } };
            p.ultUntil = now + 5000;
            break;
        case 11: // Reaper — Soul Drain: drain 3s
            p.ultUntil = now + 3000;
            break;
    }

    broadcast('sfx', { sfx: 'ult' });
}

function onKill(state, killer, victim, now, broadcast) {
    killer.kills = (killer.kills || 0) + 1;
    killer.streak = (killer.streak || 0) + 1;
    victim.streak = 0;

    const wasBounty = !!victim.bounty;
    victim.bounty = false;
    if (wasBounty) killer.kills++;
    if (killer.streak >= 3) killer.bounty = true;

    const feedData = {
        killerName: killer.name,
        killerColor: killer.color,
        victimName: victim.name,
        victimColor: victim.color,
        wasBounty,
        killerStreak: killer.streak,
        reward: wasBounty ? 1 : 0,
    };
    broadcast('killfeed', feedData);
    return feedData;
}

module.exports = { activateUlt, onKill };
