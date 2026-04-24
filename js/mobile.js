/* mobile.js — virtual joystick for landscape mobile */
const mobileState = {
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false,
    ult: false,
    hasAim: false,
    aim: 0,
};

let leftOrigin = null,
    rightOrigin = null;
let leftKnob = null,
    rightKnob = null;
let leftTouchId = -1,
    rightTouchId = -1;
const MAX_R = 50;

export function isMobile() {
    return (
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && window.innerWidth < 1100)
    );
}

export function getMobileInput() {
    return { ...mobileState };
}

export function setupMobile(canvas) {
    if (!isMobile()) return;

    const overlay = document.getElementById('mobileOverlay');
    if (!overlay) return;
    overlay.classList.remove('hide');

    leftKnob = document.getElementById('joystickLeftKnob');
    rightKnob = document.getElementById('joystickRightKnob');

    const leftEl = document.getElementById('joystickLeft');
    const rightEl = document.getElementById('joystickRight');
    const ultBtn = document.getElementById('ultBtn');

    if (leftEl) {
        leftEl.addEventListener(
            'touchstart',
            (e) => {
                e.preventDefault();
                const t = e.changedTouches[0];
                leftTouchId = t.identifier;
                const r = leftEl.getBoundingClientRect();
                leftOrigin = {
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2,
                };
                updateLeft(t.clientX, t.clientY);
            },
            { passive: false },
        );

        leftEl.addEventListener(
            'touchmove',
            (e) => {
                e.preventDefault();
                for (const t of e.changedTouches) {
                    if (t.identifier === leftTouchId)
                        updateLeft(t.clientX, t.clientY);
                }
            },
            { passive: false },
        );

        leftEl.addEventListener('touchend', (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === leftTouchId) {
                    leftTouchId = -1;
                    leftOrigin = null;
                    mobileState.up =
                        mobileState.down =
                        mobileState.left =
                        mobileState.right =
                            false;
                    if (leftKnob)
                        leftKnob.style.transform = 'translate(-50%,-50%)';
                }
            }
        });
    }

    if (rightEl) {
        rightEl.addEventListener(
            'touchstart',
            (e) => {
                e.preventDefault();
                const t = e.changedTouches[0];
                rightTouchId = t.identifier;
                const r = rightEl.getBoundingClientRect();
                rightOrigin = {
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2,
                };
                mobileState.shoot = true;
                updateRight(t.clientX, t.clientY);
            },
            { passive: false },
        );

        rightEl.addEventListener(
            'touchmove',
            (e) => {
                e.preventDefault();
                for (const t of e.changedTouches) {
                    if (t.identifier === rightTouchId)
                        updateRight(t.clientX, t.clientY);
                }
            },
            { passive: false },
        );

        rightEl.addEventListener('touchend', (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === rightTouchId) {
                    rightTouchId = -1;
                    rightOrigin = null;
                    mobileState.shoot = false;
                    mobileState.hasAim = false;
                    if (rightKnob)
                        rightKnob.style.transform = 'translate(-50%,-50%)';
                }
            }
        });
    }

    if (ultBtn) {
        ultBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            mobileState.ult = true;
        });
        ultBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            mobileState.ult = false;
        });
    }
}

function updateLeft(cx, cy) {
    if (!leftOrigin) return;
    const dx = cx - leftOrigin.x,
        dy = cy - leftOrigin.y;
    const dist = Math.hypot(dx, dy);
    const clampedDx = dist > MAX_R ? (dx / dist) * MAX_R : dx;
    const clampedDy = dist > MAX_R ? (dy / dist) * MAX_R : dy;

    if (leftKnob)
        leftKnob.style.transform = `translate(calc(-50% + ${clampedDx}px), calc(-50% + ${clampedDy}px))`;

    const threshold = 12;
    mobileState.up = dy < -threshold;
    mobileState.down = dy > threshold;
    mobileState.left = dx < -threshold;
    mobileState.right = dx > threshold;
}

function updateRight(cx, cy) {
    if (!rightOrigin) return;
    const dx = cx - rightOrigin.x,
        dy = cy - rightOrigin.y;
    const dist = Math.hypot(dx, dy);
    const clampedDx = dist > MAX_R ? (dx / dist) * MAX_R : dx;
    const clampedDy = dist > MAX_R ? (dy / dist) * MAX_R : dy;

    if (rightKnob)
        rightKnob.style.transform = `translate(calc(-50% + ${clampedDx}px), calc(-50% + ${clampedDy}px))`;

    if (dist > 8) {
        mobileState.hasAim = true;
        mobileState.aim = Math.atan2(dy, dx);
    }
}
