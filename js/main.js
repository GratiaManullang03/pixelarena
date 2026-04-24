/* main.js — bootstrap: UI refs, screen manager, init */
import { State } from './state.js';
import { initInput } from './input.js';
import { setupMobile } from './mobile.js';
import { initGameLoop, startMatch, setupNetGameHandlers, startGameLoop } from './game-loop.js';
import { initLobby } from './lobby.js';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ui = {
    start:        document.getElementById('startScreen'),
    join:         document.getElementById('joinScreen'),
    lobby:        document.getElementById('lobbyScreen'),
    gameWrap:     document.getElementById('gameWrap'),
    hud:          document.getElementById('hud'),
    end:          document.getElementById('endScreen'),
    btnHost:      document.getElementById('btnHost'),
    btnJoin:      document.getElementById('btnJoin'),
    btnDoJoin:    document.getElementById('btnDoJoin'),
    btnJoinBack:  document.getElementById('btnJoinBack'),
    btnReady:     document.getElementById('btnReady'),
    btnLeave:     document.getElementById('btnLeave'),
    btnStart:     document.getElementById('btnStart'),
    btnBackLobby: document.getElementById('btnBackLobby'),
    joinCode:     document.getElementById('joinCode'),
    joinErr:      document.getElementById('joinErr'),
    myName:       document.getElementById('myName'),
    roomCodeBig:  document.getElementById('roomCodeBig'),
    avatarGrid:   document.getElementById('avatarGrid'),
    playerList:   document.getElementById('playerList'),
    startHint:    document.getElementById('startHint'),
    netPill:      document.getElementById('netPill'),
    netLabel:     document.getElementById('netLabel'),
    myStatus:     document.getElementById('myStatus'),
    timer:        document.getElementById('timer'),
    scoreBoard:   document.getElementById('scoreBoard'),
    winnerLine:   document.getElementById('winnerLine'),
    rankList:     document.getElementById('rankList'),
};

function show(which) {
    ['start', 'join', 'lobby'].forEach(
        (s) => ui[s] && ui[s].classList.toggle('hide', s !== which),
    );
    const gw = document.getElementById('gameWrap');
    const app = document.getElementById('app');
    if (which === 'game') {
        if (app) app.style.display = 'none';
        if (gw) gw.classList.remove('hide');
        ui.hud && ui.hud.classList.remove('hide');
        const panel = document.getElementById('powerupPanel');
        if (panel) panel.classList.remove('hide');
    } else {
        if (app) app.style.display = '';
        if (gw) gw.classList.add('hide');
        ui.hud && ui.hud.classList.add('hide');
        const panel = document.getElementById('powerupPanel');
        if (panel) panel.classList.add('hide');
    }
    State.screen = which;
}

show('start');
initInput(cv, () => State.screen);
setupMobile(cv);

initGameLoop(ui, show, cv);
setupNetGameHandlers();
startGameLoop(ctx);
initLobby(ui, show, startMatch);

// Arc panel buttons (v2 cabinet)
document.querySelectorAll('.arc-btn').forEach((btn) => {
    const action = btn.dataset.panelAction;
    if (!action) return;
    btn.addEventListener('click', () => {
        if (action === 'host') ui.btnHost?.click();
        if (action === 'join') ui.btnJoin?.click();
        if (action === 'ready') ui.btnReady?.click();
        if (action === 'back') {
            if (State.screen === 'join') ui.btnJoinBack?.click();
            else if (State.screen === 'lobby') ui.btnLeave?.click();
        }
    });
});
