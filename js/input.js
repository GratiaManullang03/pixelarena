/* input.js — keyboard/mouse input state */
export const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false,
    ult: false,
    mx: 640,
    my: 360,
    aimUp: false,
    aimDown: false,
    aimLeft: false,
    aimRight: false,
    aimAngle: 0,
    usingKeyAim: false,
};

let _matchStartTime = 0;

export function initInput(canvas, getState) {
    window.addEventListener('keydown', (e) => {
        if (getState() !== 'game') return;
        if (e.key === 'w' || e.key === 'W') input.up = true;
        if (e.key === 's' || e.key === 'S') input.down = true;
        if (e.key === 'a' || e.key === 'A') input.left = true;
        if (e.key === 'd' || e.key === 'D') input.right = true;
        if (e.key === 'ArrowUp') {
            input.aimUp = true;
            input.usingKeyAim = true;
            e.preventDefault();
        }
        if (e.key === 'ArrowDown') {
            input.aimDown = true;
            input.usingKeyAim = true;
            e.preventDefault();
        }
        if (e.key === 'ArrowLeft') {
            input.aimLeft = true;
            input.usingKeyAim = true;
            e.preventDefault();
        }
        if (e.key === 'ArrowRight') {
            input.aimRight = true;
            input.usingKeyAim = true;
            e.preventDefault();
        }
        if (e.key === ' ') {
            input.shoot = true;
            e.preventDefault();
        }
        if (e.key === 'q' || e.key === 'Q') {
            input.ult = true;
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'w' || e.key === 'W') input.up = false;
        if (e.key === 's' || e.key === 'S') input.down = false;
        if (e.key === 'a' || e.key === 'A') input.left = false;
        if (e.key === 'd' || e.key === 'D') input.right = false;
        if (e.key === 'ArrowUp') input.aimUp = false;
        if (e.key === 'ArrowDown') input.aimDown = false;
        if (e.key === 'ArrowLeft') input.aimLeft = false;
        if (e.key === 'ArrowRight') input.aimRight = false;
        if (!input.aimUp && !input.aimDown && !input.aimLeft && !input.aimRight)
            input.usingKeyAim = false;
        if (e.key === ' ') input.shoot = false;
        if (e.key === 'q' || e.key === 'Q') input.ult = false;
    });

    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        input.mx = (e.clientX - r.left) * (canvas.width / r.width);
        input.my = (e.clientY - r.top) * (canvas.height / r.height);
        input.usingKeyAim = false;
    });

    canvas.addEventListener('mousedown', () => {
        input.shoot = true;
    });
    canvas.addEventListener('mouseup', () => {
        input.shoot = false;
    });

    window.addEventListener('blur', () => {
        input.up =
            input.down =
            input.left =
            input.right =
            input.shoot =
            input.ult =
                false;
        input.aimUp = input.aimDown = input.aimLeft = input.aimRight = false;
    });
}

export function setMatchStartTime(t) {
    _matchStartTime = t;
}

export function renderKeyHints(ctx, W, H, now) {
    const elapsed = now - _matchStartTime;
    if (elapsed > 8000) return;
    const alpha = Math.max(0, 1 - (elapsed - 6000) / 2000);
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W / 2 - 220, H - 44, 440, 32);
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = '#efe6d1';
    ctx.font = "bold 11px 'Barlow Condensed', 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(
        'WASD Move  ·  Mouse Aim  ·  Click/Space Shoot  ·  Q Ult',
        W / 2,
        H - 23,
    );
    ctx.restore();
}
