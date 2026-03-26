/*
 * medievalAudio.js — Sistema audio atmosferico Dark Fantasy.
 * Usa Web Audio API per generare suoni pesanti a tema medievale:
 * fruscio di pergamena, rintocchi di campana, strisciamento metallico, clangor di armatura.
 * NESSUN suono 8-bit.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/* ── Noise buffer generator ───────────────────────── */
function createNoiseBuffer(ctx, duration, type = 'white') {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'brown') {
      // Rumore marrone — più profondo, rimbombante
      b0 = (b0 + (0.02 * white)) / 1.02;
      data[i] = b0 * 3.5;
    } else if (type === 'pink') {
      b0 = 0.99886*b0 + white*0.0555179;
      b1 = 0.99332*b1 + white*0.0750759;
      b2 = 0.96900*b2 + white*0.1538520;
      b3 = 0.86650*b3 + white*0.3104856;
      b4 = 0.55000*b4 + white*0.5329522;
      b5 = -0.7616*b5 - white*0.0168980;
      data[i] = (b0+b1+b2+b3+b4+b5+b6+white*0.5362)*0.11;
      b6 = white * 0.115926;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

/* ── Heavy parchment rustling ─────────────────────── */
function playParchment(ctx) {
  const t = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.5, 'pink');
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 2000;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 6000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
  gain.gain.linearRampToValueAtTime(0.15, t + 0.15);
  gain.gain.linearRampToValueAtTime(0.3, t + 0.25);
  gain.gain.linearRampToValueAtTime(0, t + 0.5);
  noise.connect(hp).connect(lp).connect(gain).connect(ctx.destination);
  noise.start(t); noise.stop(t + 0.5);
}

/* ── Deep bell toll ───────────────────────────────── */
function playBellToll(ctx) {
  const t = ctx.currentTime;
  const fundamentals = [110, 220, 330, 440];
  fundamentals.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const vol = (i === 0 ? 0.3 : 0.12 / (i + 1));
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 2.5);
  });
  // Luccichio metallico
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.3, 'white');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  noise.connect(bp).connect(g).connect(ctx.destination);
  noise.start(t); noise.stop(t + 0.3);
}

/* ── Metal scraping / blade ───────────────────────── */
function playMetalScrape(ctx) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(2000, t + 0.15);
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.4);
  const dist = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = (i * 2) / 256 - 1; curve[i] = (Math.PI + 10) * x / (Math.PI + 10 * Math.abs(x)); }
  dist.curve = curve;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(dist).connect(gain).connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.4);
}

/* ── Armor clank ──────────────────────────────────── */
function playArmorClank(ctx) {
  const t = ctx.currentTime;
  [800, 1200, 1600, 2400].forEach(freq => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.12);
  });
  // Tonfo d'impatto
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(80, t);
  osc2.frequency.exponentialRampToValueAtTime(30, t + 0.15);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.2, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc2.connect(g2).connect(ctx.destination);
  osc2.start(t); osc2.stop(t + 0.15);
}

/* ── Pack seal breaking (wax seal crack + reveal) ── */
function playPackOpen(ctx) {
  const t = ctx.currentTime;
  // Schiocco secco
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.15, 'white');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 4000; bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  noise.connect(bp).connect(g).connect(ctx.destination);
  noise.start(t); noise.stop(t + 0.15);
  // Rimbombo risonante dopo lo schiocco
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t + 0.05);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.6);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.25, t + 0.05);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  osc.connect(g2).connect(ctx.destination);
  osc.start(t + 0.05); osc.stop(t + 0.6);
}

/* ── Card reveal (shimmering chime) ───────────────── */
function playCardReveal(ctx) {
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + i * 0.06);
    g.gain.linearRampToValueAtTime(0.12, t + i * 0.06 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.8);
    osc.connect(g).connect(ctx.destination);
    osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.8);
  });
}

/* ── Legendary card fanfare ───────────────────────── */
function playLegendaryReveal(ctx) {
  const t = ctx.currentTime;
  // Corno profondo
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(65, t);
  osc.frequency.linearRampToValueAtTime(130, t + 0.3);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.linearRampToValueAtTime(0.15, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  osc.connect(lp).connect(g).connect(ctx.destination);
  osc.start(t); osc.stop(t + 1.5);
  // Carillon ascendente
  [262, 330, 392, 523, 659].forEach((freq, i) => {
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t + 0.2 + i * 0.1);
    g2.gain.linearRampToValueAtTime(0.1, t + 0.25 + i * 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.9 + i * 0.1);
    osc2.connect(g2).connect(ctx.destination);
    osc2.start(t + 0.2 + i * 0.1); osc2.stop(t + 0.9 + i * 0.1);
  });
}

/* ── Save/confirm (heavy stamp) ───────────────────── */
function playSave(ctx) {
  const t = ctx.currentTime;
  // Tonfo
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(100, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(g).connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.25);
  // Risonanza
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = 200;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.1, t + 0.05);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc2.connect(g2).connect(ctx.destination);
  osc2.start(t + 0.05); osc2.stop(t + 0.4);
}

/* ── Click feedback ───────────────────────────────── */
function playClick(ctx) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.06);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(g).connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.06);
}

/* ── Swipe sound ──────────────────────────────────── */
function playSwipe(ctx) {
  const t = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.25, 'pink');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1000, t);
  bp.frequency.exponentialRampToValueAtTime(4000, t + 0.25);
  bp.Q.value = 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  noise.connect(bp).connect(g).connect(ctx.destination);
  noise.start(t); noise.stop(t + 0.25);
}

/* ── Error / denied ───────────────────────────────── */
function playError(ctx) {
  const t = ctx.currentTime;
  [220, 180].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t + i * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.12);
    osc.connect(g).connect(ctx.destination);
    osc.start(t + i * 0.15); osc.stop(t + i * 0.15 + 0.12);
  });
}

/* ── Public API ───────────────────────────────────── */
const SOUNDS = {
  parchment:    playParchment,
  bell:         playBellToll,
  metal:        playMetalScrape,
  armor:        playArmorClank,
  packOpen:     playPackOpen,
  cardReveal:   playCardReveal,
  legendary:    playLegendaryReveal,
  save:         playSave,
  click:        playClick,
  swipe:        playSwipe,
  error:        playError,
};

export function playMedievalSound(type) {
  try {
    const ctx = getCtx();
    const fn = SOUNDS[type];
    if (fn) fn(ctx);
  } catch {
    // Audio non disponibile — fallimento silenzioso
  }
}
