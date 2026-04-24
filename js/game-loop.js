/* game-loop.js — game loop, startMatch, endMatch, buildRanks */
import { State } from './state.js';
import { CHARACTERS } from './characters.js';
import { setMatchStartTime } from './input.js';
import * as Net from './net.js';
import * as Audio from './audio.js';
import {
    reset, hostTick, bullets, powerups, hpItems, firePads, turrets,
    killFeed, pushKillFeed,
} from './engine/game-engine.js';
import { applySnap, getInterpolated } from './engine/snapshot.js';
import { snapshotInput } from './engine/physics.js';
import { spawnMuzzle, spawnHit, spawnPickupFx, shake, tickParticles, clearFx } from './engine/particles.js';
import { draw, cam } from './renderer/renderer.js';
import { updateHUD } from './renderer/draw-hud.js';
import { startCountdown } from './countdown.js';

let _ui = {};
let _show = null;
let _W = 0;
let _H = 0;

export function initGameLoop(ui, show, canvas) {
    _ui = ui;
    _show = show;
    _W = canvas.width;
    _H = canvas.height;
}

function escape(s) {
    return String(s).replace(
        /[<>&"]/g,
        (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c],
    );
}

export function startMatch(seed) {
    _show('game');
    _ui.end.style.display = 'none';
    clearFx();
    reset(seed);
    State.matchStart = performance.now();
    State.matchEnd = State.matchStart + 3 * 60 * 1000;
    State.running = false;
    startCountdown(() => {
        State.running = true;
        setMatchStartTime(performance.now());
    });
}

export function endMatch(ranks) {
    State.running = false;
    const top = ranks[0];
    const tied = ranks.filter((r) => r.kills === top.kills);
    if (top.kills === 0) {
        _ui.winnerLine.textContent = 'NO KILLS — DRAW';
    } else if (tied.length > 1) {
        _ui.winnerLine.textContent = `DRAW — ${tied.map((r) => r.name).join(' & ')}`;
    } else {
        _ui.winnerLine.textContent = `${top.name} WINS!`;
    }
    _ui.rankList.innerHTML = ranks.map((r, i) => {
        const ch = CHARACTERS[r.charIdx] || CHARACTERS[0];
        return `<div class="rank-row">
      <div class="pos">#${i + 1}</div>
      <div style="color:${r.color};font-weight:700">${escape(r.name)} <span style="opacity:.6;font-size:10px">${ch.name}</span></div>
      <div class="sc">${r.kills} KILLS</div>
    </div>`;
    }).join('');
    _ui.end.style.display = 'flex';
}

function buildRanks() {
    return Object.values(State.players)
        .map((p) => ({ id: p.id, name: p.name, color: p.color, kills: p.kills || 0, charIdx: p.charIdx || 0 }))
        .sort((a, b) => b.kills - a.kills);
}

export function setupNetGameHandlers() {
    Net.on((msg) => {
        switch (msg.type) {
            case 'input':
                if (State.isHost) {
                    const p = State.players[msg.from];
                    if (p) p.inputBuf = msg.payload;
                }
                break;
            case 'snapshot':
                if (!State.isHost && State.running)
                    applySnap(msg.payload, bullets, powerups, hpItems, firePads, turrets);
                break;
            case 'shot':
                spawnMuzzle(msg.payload.x, msg.payload.y, msg.payload.color);
                Audio.shoot();
                break;
            case 'hit':
                spawnHit(msg.payload.x, msg.payload.y, msg.payload.dmg, msg.payload.color);
                Audio.hit();
                if (msg.payload.killed) Audio.boom();
                shake(6);
                break;
            case 'pickup':
                Audio.pickup();
                spawnPickupFx(msg.payload.x, msg.payload.y);
                break;
            case 'killfeed':
                pushKillFeed(msg.payload);
                break;
            case 'end':
                endMatch(msg.payload.ranks);
                break;
        }
    });
}

export function startGameLoop(ctx) {
    let last = performance.now();

    function loop(now) {
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!State.running) return;

        if (State.isHost) {
            const me = State.players[State.myId];
            if (me) me.inputBuf = snapshotInput(me, cam, _W, _H);
            hostTick(dt, now, () => {
                const ranks = buildRanks();
                Net.send('end', { ranks });
                endMatch(ranks);
            });
            tickParticles(dt);
            draw(ctx, _W, _H, now, State.players, bullets, powerups, hpItems, firePads, turrets, killFeed);
        } else {
            if (!loop._lastInput || now - loop._lastInput > 50) {
                loop._lastInput = now;
                const me = State.players[State.myId];
                const inp = snapshotInput(me, cam, _W, _H);
                if (inp) Net.send('input', inp);
            }
            bullets.forEach((b) => { b.x += b.vx * dt; b.y += b.vy * dt; });
            tickParticles(dt);
            const playerMap = getInterpolated(now - 100) || State.players;
            draw(ctx, _W, _H, now, playerMap, bullets, powerups, hpItems, firePads, turrets, killFeed);
        }

        updateHUD(_ui, now, powerups);
    }

    requestAnimationFrame(loop);
}
