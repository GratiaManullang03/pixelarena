/* lobby-net.js — network message handler, broadcast helpers, enterLobby, disconnect detection */
import { State } from './state.js';
import { CHARACTERS } from './characters.js';
import * as Net from './net.js';

let _ui = {};
let _renderAvatars, _renderPlayerList, _setNet;

export function initLobbyNet(ui, renderAvatars, renderPlayerList, setNet) {
    _ui = ui;
    _renderAvatars = renderAvatars;
    _renderPlayerList = renderPlayerList;
    _setNet = setNet;
}

export function broadcastMe() {
    const me = State.players[State.myId];
    if (!me) return;
    Net.send('me', {
        id: me.id,
        name: me.name,
        avatar: me.avatar,
        color: me.color,
        ready: me.ready,
        charIdx: me.charIdx !== undefined ? me.charIdx : State.myCharIdx,
    });
}

export function enterLobby(show) {
    show('lobby');
    _renderAvatars();
    _ui.myName.value = State.myName || _randomName();
    State.myName = _ui.myName.value;
    _renderPlayerList();

    Net.connect(State.room, _setNet);
    State.myId = Net.id();

    const ch = CHARACTERS[State.myCharIdx];
    State.players[State.myId] = {
        id: State.myId,
        name: State.myName,
        avatar: State.myAvatar,
        color: ch.color,
        ready: false,
        charIdx: State.myCharIdx,
        hp: ch.baseHp,
        maxHp: ch.baseHp,
        mp: 0,
        maxMp: ch.ultCost,
        x: 0, y: 0, vx: 0, vy: 0,
        aim: 0, kills: 0, alive: true,
        powerup: null, powerupUntil: 0,
        lastShot: 0, streak: 0, bounty: false,
        ultActive: false, ultUntil: 0, ultState: null, critShots: 0,
    };
    _renderPlayerList();
    Net.on((msg) => onNetMsg(msg, show));

    setInterval(() => { if (State.screen === 'lobby') broadcastMe(); }, 1200);
    setTimeout(broadcastMe, 400);
    setInterval(() => _checkDisconnects(), 2000);
}

function _checkDisconnects() {
    if (State.screen !== 'lobby') return;
    const now = performance.now();
    let changed = false;
    Object.keys(State.players).forEach((id) => {
        if (id === State.myId) return;
        const last = Net.getLastSeen(id);
        if (last > 0 && now - last > 10000) {
            delete State.players[id];
            changed = true;
            _showToast(`${id.slice(0, 6)} disconnected`);
        }
    });
    if (changed) _renderPlayerList();
}

function _showToast(msg) {
    let t = document.getElementById('disconnectToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'disconnectToast';
        t.style.cssText = `position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
      background:#1a1815;border:1px solid #6a6863;color:#9a9079;
      font-family:'Barlow Condensed',monospace;font-size:12px;letter-spacing:.18em;
      text-transform:uppercase;padding:8px 16px;border-radius:3px;z-index:20;
      transition:opacity .4s;`;
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

function _makePlayerSlot(data) {
    const ch = CHARACTERS[data.charIdx] || CHARACTERS[0];
    return {
        id: data.id,
        name: data.name,
        avatar: data.avatar,
        color: data.color || ch.color,
        ready: !!data.ready,
        charIdx: data.charIdx !== undefined ? data.charIdx : 0,
        hp: ch.baseHp, maxHp: ch.baseHp,
        mp: 0, maxMp: ch.ultCost,
        x: 0, y: 0, vx: 0, vy: 0,
        aim: 0, kills: 0, alive: true,
        powerup: null, powerupUntil: 0,
        lastShot: 0, streak: 0, bounty: false,
        ultActive: false, ultUntil: 0, ultState: null, critShots: 0,
    };
}

function onNetMsg(msg, show) {
    switch (msg.type) {
        case 'hello':
            if (State.screen !== 'lobby') return;
            broadcastMe();
            break;

        case 'me': {
            const p = msg.payload;
            if (!p?.id || p.id === State.myId) return;
            const existing = State.players[p.id] || _makePlayerSlot(p);
            State.players[p.id] = Object.assign(existing, {
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                color: p.color || existing.color,
                ready: !!p.ready,
                charIdx: p.charIdx !== undefined ? p.charIdx : 0,
            });
            if (State.screen === 'lobby') _renderPlayerList();
            break;
        }

        case 'roster': {
            const r = msg.payload.roster || [];
            const keepIds = new Set(r.map((x) => x.id));
            r.forEach((p) => {
                if (p.id === State.myId) return;
                const existing = State.players[p.id] || _makePlayerSlot(p);
                State.players[p.id] = Object.assign(existing, {
                    id: p.id,
                    name: p.name,
                    avatar: p.avatar,
                    color: p.color,
                    ready: p.ready,
                    charIdx: p.charIdx !== undefined ? p.charIdx : 0,
                });
            });
            Object.keys(State.players).forEach((id) => {
                if (!keepIds.has(id) && id !== State.myId) delete State.players[id];
            });
            if (State.screen === 'lobby') _renderPlayerList();
            break;
        }

        case 'start':
            if (State.screen === 'lobby' && msg.payload?.seed !== undefined) {
                if (msg.payload.mode) State.gameMode = msg.payload.mode;
                window._pendingStart(msg.payload.seed, msg.payload.mode || 'classic');
            }
            break;
    }
}

function _randomName() {
    const A = ['Neon', 'Pixel', 'Turbo', 'Glitch', 'Retro', 'Byte', 'Hex', 'Zap', 'Volt', 'Crypt', 'Void', 'Nova'];
    const B = ['Fox', 'Wolf', 'Cat', 'Owl', 'Rat', 'Bee', 'Ram', 'Fly', 'Cub', 'Ace', 'Jet', 'Orb'];
    return A[(Math.random() * A.length) | 0] + B[(Math.random() * B.length) | 0];
}
