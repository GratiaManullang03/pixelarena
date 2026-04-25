/* countdown.js — 3-2-1-GO! overlay before match starts */
import * as Audio from './audio.js';

let _overlay = null;

function getOverlay() {
    if (!_overlay) {
        _overlay = document.getElementById('countdownOverlay');
        if (!_overlay) {
            _overlay = document.createElement('div');
            _overlay.id = 'countdownOverlay';
            _overlay.style.cssText = `
        position:fixed;inset:0;display:none;align-items:center;justify-content:center;
        z-index:30;pointer-events:none;
      `;
            document.body.appendChild(_overlay);
        }
    }
    return _overlay;
}

export function startCountdown(onDone) {
    const overlay = getOverlay();
    overlay.style.display = 'flex';

    const steps = [3, 2, 1, 0]; // 0 = GO!
    let i = 0;

    function tick() {
        const n = steps[i];
        const label = n > 0 ? String(n) : 'GO!';
        const color = n > 0 ? '#ffc04a' : '#9ee04a';

        overlay.innerHTML = `<div style="
      font-family:'Barlow Condensed','VT323','Courier New',monospace;
      font-weight:900;font-size:clamp(80px,14vw,160px);
      color:${color};
      text-shadow:0 0 20px ${color},2px 2px 0 rgba(0,0,0,.8);
      animation:cdPop 0.35s cubic-bezier(.36,1.56,.64,1) both;
      letter-spacing:.04em;
    ">${label}</div>
    <style>@keyframes cdPop{from{transform:scale(2);opacity:0}to{transform:scale(1);opacity:1}}</style>`;

        Audio.countdown(n);
        i++;

        if (i < steps.length) {
            setTimeout(tick, 900);
        } else {
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.innerHTML = '';
                onDone();
            }, 600);
        }
    }

    tick();
}
