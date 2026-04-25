/* draw-hud.js — HUD DOM updates, minimap, kill feed */
import { State } from '../state.js';
import { CHARACTERS } from '../characters.js';
import { ARENA } from '../maps.js';

function escape(s) {
    return String(s).replace(
        /[<>&"]/g,
        (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c],
    );
}

export function updateHUD(ui, now, powerups) {
    const me = State.players[State.myId];
    const remain = Math.max(0, State.matchEnd - now);
    const mm = Math.floor(remain / 60000);
    const ss = Math.floor((remain % 60000) / 1000)
        .toString()
        .padStart(2, '0');
    ui.timer.textContent = `${mm}:${ss}`;

    if (me) {
        const ch = CHARACTERS[me.charIdx] || CHARACTERS[0];
        const parts = [
            `HP ${Math.max(0, me.hp | 0)}/${me.maxHp}`,
            `KILLS ${me.kills || 0}`,
        ];
        if (me.streak >= 3) parts.push(`${me.streak}x STREAK`);
        if (me.bounty) parts.push('BOUNTY');
        if (me.powerup && now < me.powerupUntil)
            parts.push(
                `${me.powerup.toUpperCase()} ${Math.ceil((me.powerupUntil - now) / 1000)}s`,
            );
        if (!me.alive && !me.isSpectator)
            parts.push(
                `RESPAWN ${Math.max(0, Math.ceil((me.respawnAt - now) / 1000))}s`,
            );
        if (me.isSpectator) parts.push('SPECTATING');
        ui.myStatus.textContent = parts.join(' · ');

        // Lives display (survival mode)
        const livesEl = document.getElementById('livesDisplay');
        if (livesEl) {
            if (State.gameMode === 'survival') {
                const total = 3;
                const left = me.livesLeft ?? 3;
                let s = '';
                for (let i = 0; i < total; i++)
                    s += i < left ? '♥' : '💀';
                livesEl.textContent = s;
                livesEl.style.display = 'block';
            } else {
                livesEl.style.display = 'none';
            }
        }

        const ultEl = document.getElementById('ultBar');
        if (ultEl) {
            const mpPct = Math.min(1, (me.mp || 0) / (me.maxMp || 100));
            const ready = mpPct >= 1;
            ultEl.style.width = mpPct * 100 + '%';
            ultEl.style.background = ready ? '#a78bff' : '#4a2a80';
            const ultLabel = document.getElementById('ultLabel');
            if (ultLabel) {
                ultLabel.textContent = ready
                    ? `[Q] ${ch.ultName} READY`
                    : `[Q] ${ch.ultName} ${Math.floor(mpPct * 100)}%`;
                ultLabel.style.color = ready ? '#a78bff' : '#9a9079';
            }
        }
    }

    const ranked = Object.values(State.players).sort(
        (a, b) => (b.kills || 0) - (a.kills || 0),
    );
    ui.scoreBoard.innerHTML = ranked
        .map(
            (p) =>
                `<div class="score-row">
      <div class="swatch" style="background:${p.color}"></div>
      ${p.bounty ? '<span style="color:#ffc04a;font-size:9px">☆</span>' : ''}
      ${escape(p.name || 'Player')} · <b style="color:${p.color}">${p.kills || 0}</b>
    </div>`,
        )
        .join('');

    const legendEl = document.getElementById('powerupLegend');
    if (legendEl && me) {
        const puInfo = [
            {
                kind: 'rapid',
                color: '#ff3b7f',
                icon: '⚡',
                desc: 'Fire rate 2.4x',
            },
            {
                kind: 'shield',
                color: '#3bffd1',
                icon: '🛡',
                desc: 'Damage -75%',
            },
            { kind: 'double', color: '#a78bff', icon: '✦', desc: 'Damage x2' },
            { kind: 'speed', color: '#6ec8ff', icon: '▶', desc: 'Speed 1.7x' },
        ];
        legendEl.innerHTML = puInfo
            .map((pu) => {
                const onMap = powerups.some((p) => p.kind === pu.kind);
                const myActive =
                    me.powerup === pu.kind && now < (me.powerupUntil || 0);
                return `<div class="pup-row${myActive ? ' pup-active' : ''}${!onMap && !myActive ? ' pup-dim' : ''}">
        <span class="pup-icon" style="color:${pu.color}">${pu.icon}</span>
        <div>
          <div class="pup-name" style="color:${pu.color}">${pu.kind.toUpperCase()}</div>
          <div class="pup-desc">${pu.desc}</div>
        </div>
        ${onMap ? `<span class="pup-dot" style="background:${pu.color}"></span>` : ''}
        ${myActive ? `<span class="pup-timer">${Math.ceil((me.powerupUntil - now) / 1000)}s</span>` : ''}
      </div>`;
            })
            .join('');
    }
}

export function drawMiniMap(ctx, W, H, now, walls, hpItems, powerups) {
    const MM_W = 160,
        MM_H = 107,
        MM_PAD = 10;
    const MM_X = W - MM_W - MM_PAD,
        MM_Y = H - MM_H - MM_PAD;
    const scaleX = MM_W / ARENA.w,
        scaleY = MM_H / ARENA.h;

    ctx.fillStyle = 'rgba(10,17,13,0.82)';
    ctx.fillRect(MM_X - 1, MM_Y - 1, MM_W + 2, MM_H + 2);
    ctx.strokeStyle = '#1a2418';
    ctx.lineWidth = 1;
    ctx.strokeRect(MM_X - 1, MM_Y - 1, MM_W + 2, MM_H + 2);

    ctx.fillStyle = '#1a1815';
    walls.forEach((w) => {
        ctx.fillRect(
            MM_X + w.x * scaleX,
            MM_Y + w.y * scaleY,
            Math.max(1, w.w * scaleX),
            Math.max(1, w.h * scaleY),
        );
    });

    hpItems.forEach((h) => {
        ctx.fillStyle = '#9ee04a';
        ctx.fillRect(MM_X + h.x * scaleX - 2, MM_Y + h.y * scaleY - 2, 4, 4);
    });

    const PUP_COLORS = {
        shield: '#3bffd1',
        rapid: '#ff3b7f',
        double: '#a78bff',
        speed: '#6ec8ff',
    };
    powerups.forEach((pu) => {
        ctx.fillStyle = PUP_COLORS[pu.kind] || '#ffd23b';
        ctx.fillRect(MM_X + pu.x * scaleX - 2, MM_Y + pu.y * scaleY - 2, 4, 4);
    });

    Object.values(State.players).forEach((p) => {
        if (!p.alive) return;
        const px = MM_X + p.x * scaleX,
            py = MM_Y + p.y * scaleY;
        if (p.bounty) {
            ctx.fillStyle = '#ffc04a';
            ctx.globalAlpha = Math.sin(now / 200) * 0.4 + 0.6;
            ctx.fillRect(px - 4, py - 4, 8, 8);
            ctx.globalAlpha = 1;
        } else if (p.id === State.myId) {
            ctx.fillStyle = '#efe6d1';
            ctx.fillRect(px - 3, py - 3, 6, 6);
        } else {
            ctx.fillStyle = p.color;
            ctx.fillRect(px - 2, py - 2, 4, 4);
        }
    });
}

export function drawKillFeed(ctx, killFeed, now) {
    const x = 12,
        startY = 80;
    const maxAge = 5000;
    for (let i = killFeed.length - 1; i >= 0; i--) {
        const entry = killFeed[i];
        const age = now - entry.ts;
        if (age > maxAge) {
            killFeed.splice(i, 1);
            continue;
        }
        const alpha = Math.min(1, Math.min(age / 200, (maxAge - age) / 500));
        const y = startY + (killFeed.length - 1 - i) * 22;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(10,17,13,0.75)';
        ctx.fillRect(x - 4, y - 14, 360, 18);

        ctx.font = "bold 11px 'VT323', 'Courier New', monospace";
        ctx.textAlign = 'left';
        ctx.fillStyle = entry.killerColor;
        ctx.fillText(entry.killerName, x, y);
        const kw = ctx.measureText(entry.killerName).width;

        ctx.fillStyle = '#efe6d1';
        ctx.fillText(' x ', x + kw, y);
        const xw = ctx.measureText(' x ').width;

        ctx.fillStyle = entry.victimColor;
        ctx.fillText(entry.victimName, x + kw + xw, y);

        if (entry.wasBounty || entry.killerStreak >= 3) {
            const vw = ctx.measureText(entry.victimName).width;
            ctx.fillStyle = '#ffc04a';
            const txt = entry.wasBounty
                ? ' +BOUNTY'
                : ` ${entry.killerStreak}x`;
            ctx.fillText(txt, x + kw + xw + vw, y);
        }
        ctx.globalAlpha = 1;
    }
}
