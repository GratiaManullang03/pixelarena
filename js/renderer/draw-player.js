/* draw-player.js — drawPlayerShape + drawCharBody for all 12 chars */
import { CHARACTERS } from '../characters.js';
import { State } from '../state.js';

export function drawPlayerShape(ctx, p, now) {
    const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
    ctx.save();
    ctx.translate(p.x, p.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shield glow
    if (
        (p.powerup === 'shield' && now < p.powerupUntil) ||
        (p.ultActive && ch.id === 0 && now < p.ultUntil)
    ) {
        ctx.strokeStyle = '#3bffd1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22 + Math.sin(now / 120) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Phase glow (Ghost ult)
    if (p.ultActive && ch.id === 8 && now < p.ultUntil) {
        ctx.globalAlpha = 0.5 + Math.sin(now / 100) * 0.2;
        ctx.strokeStyle = '#b6ff3b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Soul drain radius ring (Reaper)
    if (p.ultActive && ch.id === 11 && now < p.ultUntil) {
        ctx.strokeStyle = '#3bffb6';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, 120, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Bounty glow
    if (p.bounty) {
        const glow = Math.sin(now / 150) * 0.5 + 0.5;
        ctx.shadowColor = '#ffd23b';
        ctx.shadowBlur = 8 + glow * 12;
    }

    drawCharBody(ctx, ch, p.color, p.aim || 0, now);

    ctx.shadowBlur = 0;
    ctx.restore();

    // Name + HP/MP bars
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.textAlign = 'center';
    if (p.bounty) {
        ctx.fillStyle = '#ffd23b';
        ctx.font = "bold 10px 'VT323', 'Courier New', monospace";
        ctx.fillText('☆ BOUNTY ☆', 0, -42);
    }
    ctx.font = "bold 11px 'VT323', 'Courier New', monospace";
    ctx.fillStyle = p.bounty ? '#ffd23b' : '#efe6d1';
    ctx.fillText(p.name || 'Player', 0, -28);

    const hp = Math.max(0, p.hp) / (p.maxHp || 1);
    ctx.fillStyle = '#1a1815';
    ctx.fillRect(-20, -42, 40, 4);
    ctx.fillStyle = hp > 0.5 ? '#9ee04a' : hp > 0.25 ? '#ffc04a' : '#e85540';
    ctx.fillRect(-20, -42, 40 * hp, 4);

    const mp = Math.max(0, p.mp || 0) / (p.maxMp || 100);
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(-20, -37, 40, 3);
    ctx.fillStyle = '#a78bff';
    ctx.fillRect(-20, -37, 40 * mp, 3);

    ctx.restore();
}

function drawCharBody(ctx, ch, color, aim, now) {
    switch (ch.id) {
        case 0: // TANK — wide square
            ctx.fillStyle = color;
            ctx.fillRect(-17, -17, 34, 34);
            ctx.fillStyle = 'rgba(255,255,255,.25)';
            ctx.fillRect(-17, -17, 34, 5);
            ctx.fillStyle = 'rgba(0,0,0,.3)';
            ctx.fillRect(-17, 12, 34, 5);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-10, -5, 5, 5);
            ctx.fillRect(5, -5, 5, 5);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(12, -4, 16, 8);
            ctx.fillStyle = color;
            ctx.fillRect(26, -3, 5, 6);
            break;

        case 1: // SNIPER — thin tall rectangle
            ctx.fillStyle = color;
            ctx.fillRect(-8, -18, 16, 36);
            ctx.fillStyle = 'rgba(255,255,255,.2)';
            ctx.fillRect(-8, -18, 16, 4);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-4, -5, 3, 4);
            ctx.fillRect(1, -5, 3, 4);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(8, -2, 22, 4);
            ctx.fillStyle = color;
            ctx.fillRect(28, -1, 3, 2);
            break;

        case 2: // BLITZ — diamond
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -18);
            ctx.lineTo(14, 0);
            ctx.lineTo(0, 18);
            ctx.lineTo(-14, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.2)';
            ctx.fillRect(-6, -8, 12, 4);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-4, -3, 3, 3);
            ctx.fillRect(1, -3, 3, 3);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(10, -2, 12, 4);
            break;

        case 3: // PHANTOM — triangle
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(16, 14);
            ctx.lineTo(-16, 14);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.15)';
            ctx.fillRect(-8, -6, 16, 3);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-5, 2, 4, 4);
            ctx.fillRect(1, 2, 4, 4);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(10, -2, 13, 4);
            break;

        case 4: // BOMBER — hexagon
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
                i === 0
                    ? ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16)
                    : ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-5, -5, 4, 4);
            ctx.fillRect(1, -5, 4, 4);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(12, -3, 12, 6);
            break;

        case 5: // MEDIC — cross shape
            ctx.fillStyle = color;
            ctx.fillRect(-6, -16, 12, 32);
            ctx.fillRect(-16, -6, 32, 12);
            ctx.fillStyle = 'rgba(255,255,255,.25)';
            ctx.fillRect(-6, -16, 12, 4);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-4, -3, 3, 3);
            ctx.fillRect(1, -3, 3, 3);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(12, -2, 12, 4);
            break;

        case 6: // ASSASSIN — thin body
            ctx.fillStyle = color;
            ctx.fillRect(-10, -16, 20, 32);
            ctx.fillStyle = 'rgba(0,0,0,.3)';
            ctx.fillRect(-10, -16, 4, 32);
            ctx.fillStyle = 'rgba(255,255,255,.2)';
            ctx.fillRect(-6, -16, 14, 4);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-5, -4, 3, 4);
            ctx.fillRect(2, -4, 3, 4);
            // Dagger instead of barrel
            ctx.rotate(aim);
            ctx.fillStyle = '#d89b2a';
            ctx.fillRect(8, -2, 20, 4);
            ctx.fillStyle = '#ffc04a';
            ctx.fillRect(26, -1, 3, 2);
            break;

        case 7: // BRUTE — big rounded square
            ctx.fillStyle = color;
            ctx.fillRect(-18, -15, 36, 30);
            ctx.fillStyle = 'rgba(255,255,255,.2)';
            ctx.fillRect(-18, -15, 36, 5);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-10, -4, 5, 5);
            ctx.fillRect(5, -4, 5, 5);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(12, -5, 14, 10);
            ctx.fillStyle = color;
            ctx.fillRect(24, -4, 6, 8);
            break;

        case 8: // GHOST — circle
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.2)';
            ctx.beginPath();
            ctx.arc(-4, -5, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-5, -3, 3, 3);
            ctx.fillRect(2, -3, 3, 3);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(11, -2, 12, 4);
            break;

        case 9: // PYRO — trapezoid
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(-10, -16);
            ctx.lineTo(10, -16);
            ctx.lineTo(16, 16);
            ctx.lineTo(-16, 16);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.2)';
            ctx.fillRect(-8, -16, 16, 4);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-6, -3, 4, 4);
            ctx.fillRect(2, -3, 4, 4);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(10, -3, 14, 6);
            break;

        case 10: // WARDEN — pentagon
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
                i === 0
                    ? ctx.moveTo(Math.cos(a) * 17, Math.sin(a) * 17)
                    : ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-5, -4, 4, 4);
            ctx.fillRect(1, -4, 4, 4);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(12, -3, 13, 6);
            break;

        case 11: // REAPER — skull-like
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, -4, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = color;
            ctx.fillRect(-8, 8, 16, 10);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-6, 10, 4, 6);
            ctx.fillRect(2, 10, 4, 6);
            ctx.fillRect(-5, -8, 4, 5);
            ctx.fillRect(1, -8, 4, 5);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(12, -2, 13, 4);
            break;

        default:
            ctx.fillStyle = color;
            ctx.fillRect(-14, -14, 28, 28);
            ctx.fillStyle = 'rgba(255,255,255,.22)';
            ctx.fillRect(-14, -14, 28, 4);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(-8, -4, 4, 4);
            ctx.fillRect(4, -4, 4, 4);
            ctx.rotate(aim);
            ctx.fillStyle = '#0a0908';
            ctx.fillRect(10, -3, 14, 6);
            ctx.fillStyle = color;
            ctx.fillRect(22, -2, 4, 4);
    }
}
