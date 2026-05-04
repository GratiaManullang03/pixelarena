/* game-loop.js — game loop, startMatch, endMatch, buildRanks */
import { State } from './state.js';
import { CHARACTERS } from './characters.js';
import { setMatchStartTime } from './input.js';
import * as Net from './net.js';
import * as Audio from './audio.js';
import { bullets, powerups, hpItems, firePads, turrets, killFeed, pushKillFeed } from './engine/game-engine.js';
import { applySnap, getInterpolated, getInterpDelay, resetWallsReceived } from './engine/snapshot.js';
import { snapshotInput, setWalls } from './engine/physics.js';
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

export function startMatch(seed, mode) {
    _show('game');
    _ui.end.style.display = 'none';
    State.gameMode = mode || 'classic';
    State.spectating = null;
    const spectateEl = document.getElementById('spectateOverlay');
    if (spectateEl) spectateEl.classList.remove('active');
    clearFx();
    resetWallsReceived();
    // Survival: prepare livesLeft client-side (server will authoritative set, but prepping for display)
    if (State.gameMode === 'survival') {
        Object.values(State.players).forEach((p) => {
            p.livesLeft = 3;
            p.isSpectator = false;
        });
    }
    State.matchStart = performance.now();
    State.matchEnd = State.gameMode === 'survival'
        ? State.matchStart + 30 * 60 * 1000
        : State.matchStart + 3 * 60 * 1000;
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

function _initSpectateControls() {
    function _nextSpectateTarget(dir) {
        const alive = Object.values(State.players).filter(
            (p) => !p.isSpectator && p.id !== State.myId,
        );
        if (!alive.length) return;
        const idx = alive.findIndex((p) => p.id === State.spectating);
        const next = alive[(idx + dir + alive.length) % alive.length];
        State.spectating = next.id;
        const nameEl = document.getElementById('spectateName');
        if (nameEl) nameEl.textContent = next.name || next.id.slice(0, 6);
    }
    document.getElementById('spectatePrev')?.addEventListener('click', () => _nextSpectateTarget(-1));
    document.getElementById('spectateNext')?.addEventListener('click', () => _nextSpectateTarget(1));
}

function _activateSpectate(playerId) {
    const me = State.players[playerId];
    if (!me) return;
    me.isSpectator = true;
    me.alive = false;
    if (playerId !== State.myId) return;
    const el = document.getElementById('spectateOverlay');
    if (el) el.classList.add('active');
    const alive = Object.values(State.players).filter(
        (p) => !p.isSpectator && p.id !== State.myId,
    );
    if (alive.length) {
        State.spectating = alive[0].id;
        const nameEl = document.getElementById('spectateName');
        if (nameEl) nameEl.textContent = alive[0].name || alive[0].id.slice(0, 6);
    }
}

export function setupNetGameHandlers() {
    _initSpectateControls();
    Net.on((msg) => {
        switch (msg.type) {
            case 'walls':
                setWalls(msg.payload.walls);
                break;
            case 'snapshot':
                if (msg.payload.walls) setWalls(msg.payload.walls);
                if (State.running)
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
            case 'sfx':
                if (msg.payload.sfx === 'boom') Audio.boom();
                else if (msg.payload.sfx === 'pickup') Audio.pickup();
                else if (msg.payload.sfx === 'ult') Audio.ult();
                break;
            case 'killfeed':
                pushKillFeed(msg.payload);
                break;
            case 'spectator':
                _activateSpectate(msg.payload.id);
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

        // Send input to server every 33ms
        if (!loop._lastInput || now - loop._lastInput > 33) {
            loop._lastInput = now;
            const me = State.players[State.myId];
            const inp = snapshotInput(me, cam, _W, _H);
            if (inp) Net.send('input', inp);
        }

        // Extrapolate bullets locally for smooth visuals between snapshots
        bullets.forEach((b) => { b.x += b.vx * dt; b.y += b.vy * dt; });
        tickParticles(dt);

        const playerMap = getInterpolated(now - getInterpDelay()) || State.players;
        draw(ctx, _W, _H, now, playerMap, bullets, powerups, hpItems, firePads, turrets, killFeed);
        updateHUD(_ui, now, powerups);
    }

    requestAnimationFrame(loop);
}
