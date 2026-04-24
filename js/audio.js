/* audio.js — Web Audio API sound effects */
let actx = null;

function ac() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    return actx;
}

function blip(freq, dur, type, vol) {
    const c = ac(),
        o = c.createOscillator(),
        g = c.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.value = vol || 0.1;
    o.connect(g).connect(c.destination);
    const t = c.currentTime;
    g.gain.setValueAtTime(vol || 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur);
}

function noise(dur, vol) {
    const c = ac(),
        b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++)
        d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource();
    s.buffer = b;
    const g = c.createGain();
    g.gain.value = vol || 0.2;
    s.connect(g).connect(c.destination);
    s.start();
}

export function shoot() {
    blip(480, 0.05, 'square', 0.06);
    blip(240, 0.06, 'triangle', 0.05);
}
export function hit() {
    noise(0.12, 0.15);
    blip(160, 0.08, 'sawtooth', 0.06);
}
export function boom() {
    noise(0.35, 0.3);
    blip(80, 0.25, 'sawtooth', 0.1);
}
export function pickup() {
    blip(880, 0.08, 'triangle', 0.08);
    setTimeout(() => blip(1200, 0.08, 'triangle', 0.08), 70);
}
export function ult() {
    blip(660, 0.1, 'square', 0.08);
    blip(880, 0.12, 'square', 0.08);
    blip(1100, 0.15, 'triangle', 0.1);
}

export function countdown(n) {
    if (n > 0) {
        blip(660, 0.15, 'square', 0.12);
    } else {
        // GO! — higher pitch burst
        blip(880, 0.08, 'square', 0.15);
        setTimeout(() => blip(1100, 0.12, 'square', 0.15), 60);
        setTimeout(() => blip(1320, 0.18, 'triangle', 0.18), 120);
    }
}
