/* renderer.js — main draw() function */
import { State } from '../state.js';
import { CHARACTERS } from '../characters.js';
import { ARENA } from '../maps.js';
import { walls } from '../engine/physics.js';
import { particles, floaters, shakeMag } from '../engine/particles.js';
import { input } from '../input.js';
import { drawPlayerShape } from './draw-player.js';
import { drawPowerup, drawHpItem } from './draw-powerup.js';
import { drawMiniMap, drawKillFeed } from './draw-hud.js';
import { renderKeyHints } from '../input.js';

export let cam = { x: 0, y: 0 };

export function draw(
    ctx,
    W,
    H,
    now,
    playerMap,
    bullets,
    powerups,
    hpItems,
    firePads,
    turrets,
    killFeed,
) {
    const me = playerMap[State.myId];
    if (me) {
        cam.x += (me.x - cam.x) * 0.12;
        cam.y += (me.y - cam.y) * 0.12;
    }

    const localShake = shakeMag; // read before tick
    const sx = (Math.random() - 0.5) * localShake;
    const sy = (Math.random() - 0.5) * localShake;

    ctx.save();
    // CRT phosphor dark background
    ctx.fillStyle = '#0a110d';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(-cam.x + W / 2 + sx, -cam.y + H / 2 + sy);

    // Grid
    const gs = 48;
    ctx.strokeStyle = '#1a241d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x0 = Math.floor((cam.x - W / 2) / gs) * gs;
    const y0 = Math.floor((cam.y - H / 2) / gs) * gs;
    for (let x = x0; x < cam.x + W / 2; x += gs) {
        ctx.moveTo(x, cam.y - H / 2);
        ctx.lineTo(x, cam.y + H / 2);
    }
    for (let y = y0; y < cam.y + H / 2; y += gs) {
        ctx.moveTo(cam.x - W / 2, y);
        ctx.lineTo(cam.x + W / 2, y);
    }
    ctx.stroke();

    // Arena border
    ctx.strokeStyle = '#2a3a2e';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, ARENA.w, ARENA.h);

    // Walls — chassis dark palette
    walls.forEach((w) => {
        ctx.fillStyle = '#1a1815';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#6a6863';
        ctx.fillRect(w.x, w.y, w.w, 3);
        ctx.fillStyle = '#0e0d0c';
        ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
    });

    // Fire pads
    firePads.forEach((fp) => {
        const alpha = Math.min(1, (fp.until - now) / 500) * 0.6;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#e85540';
        ctx.beginPath();
        ctx.arc(fp.x, fp.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffc04a';
        const flicker = Math.sin(now / 80 + fp.x) * 4;
        ctx.fillRect(fp.x - 4 + flicker, fp.y - 8, 8, 10);
    });

    // Turrets
    turrets.forEach((t) => {
        ctx.fillStyle = t.color;
        ctx.fillRect(t.x - 10, t.y - 10, 20, 20);
        ctx.fillStyle = '#0a0908';
        ctx.fillRect(t.x - 5, t.y - 5, 10, 10);
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(t.x - 12, t.y - 12, 24, 24);
    });

    // HP items
    hpItems.forEach((h) => drawHpItem(ctx, now, h));

    // Powerups
    powerups.forEach((pu) => {
        const pulse = 1 + Math.sin(now / 200) * 0.1;
        ctx.save();
        ctx.translate(pu.x, pu.y);
        ctx.scale(pulse, pulse);
        drawPowerup(ctx, pu.kind);
        ctx.restore();
    });

    // Players
    Object.values(playerMap).forEach((p) => {
        const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
        // Cloaked opponents are invisible
        if (
            p.ultActive &&
            ch.id === 3 &&
            now < p.ultUntil &&
            p.id !== State.myId
        )
            return;
        if (!p.alive) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            drawPlayerShape(ctx, p, now);
            ctx.restore();
        } else {
            drawPlayerShape(ctx, p, now);
        }
    });

    // Bullets
    bullets.forEach((b) => {
        const sz = b.size || 4;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x - sz / 2, b.y - sz / 2, sz, sz);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
    });

    // Particles
    particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    // Floaters
    floaters.forEach((f) => {
        ctx.fillStyle = f.color;
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.font = "bold 18px 'VT323', 'Courier New', monospace";
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    // Vignette
    const grad = ctx.createRadialGradient(
        W / 2,
        H / 2,
        H * 0.4,
        W / 2,
        H / 2,
        H * 0.8,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawMiniMap(ctx, W, H, now, walls, hpItems, powerups);
    drawKillFeed(ctx, killFeed, now);

    // Arrow key aim indicator
    if (input.usingKeyAim && me) {
        const scx = W / 2,
            scy = H / 2,
            r = 38;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(scx, scy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        const ax = scx + Math.cos(input.aimAngle) * r;
        const ay = scy + Math.sin(input.aimAngle) * r;
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    renderKeyHints(ctx, W, H, now);
}
