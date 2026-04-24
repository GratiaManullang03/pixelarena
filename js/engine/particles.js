/* particles.js — visual effects: particles, floaters, screen shake */
export let particles = [];
export let floaters = [];
export let shakeMag = 0;

export function spawnMuzzle(x, y, color) {
    for (let i = 0; i < 6; i++)
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 180,
            vy: (Math.random() - 0.5) * 180,
            life: 0.25,
            color,
        });
}

export function spawnHit(x, y, dmg, color) {
    for (let i = 0; i < 12; i++)
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 260,
            vy: (Math.random() - 0.5) * 260,
            life: 0.45,
            color,
        });
    floaters.push({ x, y, text: '-' + dmg, life: 1, color: '#ff4d4d' });
}

export function spawnPickupFx(x, y) {
    for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({
            x,
            y,
            vx: Math.cos(a) * 160,
            vy: Math.sin(a) * 160,
            life: 0.6,
            color: '#ffd23b',
        });
    }
}

export function spawnSlashFx(x, y, color) {
    for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({
            x,
            y,
            vx: Math.cos(a) * 200,
            vy: Math.sin(a) * 200,
            life: 0.3,
            color,
        });
    }
}

export function shake(n) {
    shakeMag = Math.min(14, shakeMag + n);
}

export function tickParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 1.25;
        p.vx *= 0.88;
        p.vy *= 0.88;
        if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.y -= 0.7;
        f.life -= 0.016;
        if (f.life <= 0) floaters.splice(i, 1);
    }
    shakeMag *= 0.85;
}

export function clearFx() {
    particles.length = 0;
    floaters.length = 0;
    shakeMag = 0;
}
