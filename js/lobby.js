/* lobby.js — lobby UI: renderAvatars, renderPlayerList, setNet, initLobby */
import { State } from './state.js';
import { CHARACTERS } from './characters.js';
import * as Net from './net.js';
import {
    initLobbyNet,
    broadcastMe,
    broadcastRoster,
    enterLobby,
} from './lobby-net.js';

let ui = {};

function escape(s) {
    return String(s).replace(
        /[<>&"]/g,
        (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c],
    );
}

export function setNet(kind, label) {
    const led = document.getElementById('netLed');
    ui.netPill.classList.remove('ok', 'err', 'wait');
    if (led) {
        led.className = 'led';
        if (kind === 'ok') led.classList.add('on-green');
        if (kind === 'err') led.classList.add('on-red', 'blink');
        if (kind === 'wait') led.classList.add('on-amber', 'blink');
    } else if (kind) {
        ui.netPill.classList.add(kind);
    }
    ui.netLabel.textContent = label;
}

export function renderAvatars() {
    ui.avatarGrid.innerHTML = '';
    CHARACTERS.forEach((ch, i) => {
        const b = document.createElement('button');
        b.className = 'avatar-btn' + (i === State.myCharIdx ? ' sel' : '');
        b.title = `${ch.name}: ${ch.desc}`;
        b.textContent = ch.icon;
        b.onclick = () => {
            State.myCharIdx = i;
            State.myAvatar = ch.icon;
            renderAvatars();
            broadcastMe();
        };
        ui.avatarGrid.appendChild(b);
    });
    const desc = document.getElementById('charDesc');
    if (desc) {
        const ch = CHARACTERS[State.myCharIdx];
        desc.innerHTML = `<b style="color:${ch.color}">${ch.name}</b> — ${ch.desc}<br>
      <span class="small">ULT [Q]: <b style="color:${ch.color}">${ch.ultName}</b></span>`;
    }
}

export function renderPlayerList() {
    const ps = Object.values(State.players);
    ui.playerList.innerHTML = '';
    ps.forEach((p) => {
        const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
        const row = document.createElement('div');
        row.className = 'player' + (p.ready ? ' ready' : '');
        row.innerHTML = `
      <div class="avatar" style="color:${p.color}">${escape(p.avatar || '◉')}</div>
      <div>
        <div class="name">${escape(p.name || 'Player')}</div>
        <div style="font-size:10px;color:${p.color};letter-spacing:.1em">${ch.name}</div>
        ${p.host ? '<div class="host-tag">Host</div>' : ''}
      </div>
      <div class="ready">${p.ready ? 'Ready' : 'Not ready'}</div>
    `;
        ui.playerList.appendChild(row);
    });

    const enough = ps.length >= 2;
    const allReady = enough && ps.every((p) => p.ready);
    ui.btnStart.disabled = !(State.isHost && enough && allReady);
    ui.startHint.textContent = !enough
        ? 'Need ≥2 duelists.'
        : !allReady
          ? 'Waiting for everyone to be Ready.'
          : 'Ready to start!';
}

function makeRoomCode() {
    const L = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += L[Math.floor(Math.random() * L.length)];
    return s;
}

export function initLobby(uiRefs, showFn, startMatchFn) {
    ui = uiRefs;
    initLobbyNet(ui, renderAvatars, renderPlayerList, setNet);

    ui.btnHost.onclick = () => {
        State.isHost = true;
        State.room = makeRoomCode();
        ui.roomCodeBig.textContent = State.room;
        const codeRow = document.getElementById('hostOnlyCode');
        if (codeRow) codeRow.classList.remove('hide');
        const hostWrap = document.getElementById('hostStartWrap');
        if (hostWrap) hostWrap.style.display = '';
        enterLobby(showFn);
    };

    ui.btnJoin.onclick = () => {
        showFn('join');
        ui.joinCode.focus();
    };
    ui.btnJoinBack.onclick = () => showFn('start');

    ui.btnDoJoin.onclick = () => {
        const code = ui.joinCode.value.trim().toUpperCase();
        if (!/^[A-Z0-9]{4,6}$/.test(code)) {
            ui.joinErr.textContent = 'Enter a 5-letter code';
            return;
        }
        State.isHost = false;
        State.room = code;
        const codeRow = document.getElementById('hostOnlyCode');
        if (codeRow) codeRow.classList.add('hide');
        const hostWrap = document.getElementById('hostStartWrap');
        if (hostWrap) hostWrap.style.display = 'none';
        enterLobby(showFn);
    };

    ui.btnLeave.onclick = () => {
        Net.close();
        State.players = {};
        State.isHost = false;
        showFn('start');
    };

    ui.myName.addEventListener('input', () => {
        State.myName = ui.myName.value.slice(0, 14);
        if (State.players[State.myId])
            State.players[State.myId].name = State.myName;
        renderPlayerList();
        broadcastMe();
    });

    ui.btnReady.onclick = () => {
        const me = State.players[State.myId];
        if (!me) return;
        me.ready = !me.ready;
        ui.btnReady.textContent = me.ready ? 'Not Ready' : "I'm Ready";
        renderPlayerList();
        broadcastMe();
    };

    ui.btnStart.onclick = () => {
        if (!State.isHost) return;
        const ps = Object.values(State.players);
        if (ps.length < 2 || !ps.every((p) => p.ready)) return;
        const seed = Math.floor(Math.random() * 1e9);
        Net.send('start', { seed });
        startMatchFn(seed);
    };

    ui.btnBackLobby.onclick = () => {
        ui.end.style.display = 'none';
        Object.values(State.players).forEach((p) => {
            const ch = CHARACTERS[p.charIdx] || CHARACTERS[0];
            p.ready = false;
            p.hp = ch.baseHp;
            p.kills = 0;
            p.streak = 0;
            p.bounty = false;
        });
        ui.btnReady.textContent = "I'm Ready";
        showFn('lobby');
        if (State.isHost) broadcastRoster();
    };

    window._pendingStart = startMatchFn;
}
