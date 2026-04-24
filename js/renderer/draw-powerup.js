/* draw-powerup.js — powerup and HP item drawing */
const PUP_COLORS = {
    shield: '#3bffd1',
    rapid: '#ff3b7f',
    double: '#a78bff',
    speed: '#6ec8ff',
};

export function drawPowerup(ctx, kind) {
    ctx.fillStyle = 'rgba(255,210,59,.18)';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(18, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();

    const c = PUP_COLORS[kind] || '#ffd23b';
    ctx.fillStyle = c;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#0a0c1c';
    if (kind === 'rapid') {
        ctx.fillRect(-3, -4, 2, 8);
        ctx.fillRect(1, -4, 2, 8);
    }
    if (kind === 'shield') {
        ctx.fillRect(-3, -4, 6, 8);
        ctx.fillStyle = c;
        ctx.fillRect(-1, -2, 2, 4);
    }
    if (kind === 'double') {
        ctx.fillRect(-4, -2, 3, 3);
        ctx.fillRect(1, -2, 3, 3);
        ctx.fillRect(-4, 1, 3, 3);
        ctx.fillRect(1, 1, 3, 3);
    }
    if (kind === 'speed') {
        ctx.beginPath();
        ctx.moveTo(-4, -4);
        ctx.lineTo(2, 0);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fill();
    }
}

export function drawHpItem(ctx, now, h) {
    const pulse = 1 + Math.sin(now / 300) * 0.12;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(85,255,161,0.2)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#55ffa1';
    ctx.fillRect(-3, -8, 6, 16);
    ctx.fillRect(-8, -3, 16, 6);
    ctx.restore();
}
