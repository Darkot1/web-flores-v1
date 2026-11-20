/**
 * Música del jardín.
 *
 * 1) Si config.music.src apunta a un archivo (p. ej. "/musica/nuestra-cancion.mp3"
 *    dentro de public/), suena ese archivo en bucle con fundido de entrada/salida.
 * 2) Si no, suena "Nana para margaritas": una pieza compuesta (no aleatoria) en
 *    3/4, Fa mayor, 16 compases. Piano suave en arpegios, melodía de caja de
 *    música, un pad muy tenue, eco y reverb por convolución.
 *
 * Nunca suena sola: solo arranca tras un clic.
 */

const NOTE = (name) => {
  const map = { C: -9, "C#": -8, Db: -8, D: -7, "D#": -6, Eb: -6, E: -5, F: -4, "F#": -3, Gb: -3, G: -2, "G#": -1, Ab: -1, A: 0, "A#": 1, Bb: 1, B: 2 };
  const m = name.match(/^([A-G][b#]?)(\d)$/);
  return 440 * 2 ** ((map[m[1]] + (Number(m[2]) - 4) * 12) / 12);
};

const BPM = 76;
const BEAT = 60 / BPM;
const BAR = BEAT * 3;

/** Acordes: [bajo, quinta, octava, tercera aguda]. */
const CHORDS = {
  F: ["F2", "C3", "F3", "A3"],
  C: ["C2", "G2", "C3", "E3"],
  Dm: ["D2", "A2", "D3", "F3"],
  Bb: ["Bb1", "F2", "Bb2", "D3"],
  Gm: ["G2", "D3", "G3", "Bb3"],
};
const PROGRESSION = ["F", "C", "Dm", "Bb", "F", "Bb", "Gm", "C", "Dm", "Bb", "F", "C", "Bb", "F", "Gm", "F"];

/** Melodía: [nota, duración en tiempos] por compás. */
const MELODY = [
  [["C5", 1], ["A4", 1], ["C5", 1]],
  [["D5", 2], ["C5", 1]],
  [["A4", 2], ["F4", 1]],
  [["G4", 3]],
  [["C5", 1], ["A4", 1], ["C5", 1]],
  [["F5", 2], ["D5", 1]],
  [["C5", 1], ["Bb4", 1], ["A4", 1]],
  [["G4", 3]],
  [["A4", 1], ["D5", 1], ["F5", 1]],
  [["D5", 2], ["Bb4", 1]],
  [["C5", 2], ["A4", 1]],
  [["G4", 2], ["A4", 1]],
  [["Bb4", 1], ["D5", 1], ["F5", 1]],
  [["E5", 1], ["D5", 1], ["C5", 1]],
  [["Bb4", 1], ["A4", 1], ["G4", 1]],
  [["F4", 3]],
];

/** Arpegio de la mano izquierda en corcheas: índices sobre el acorde. */
const ARPEGGIO = [0, 1, 2, 3, 2, 1];

const createImpulse = (ctx, seconds = 3.6, decay = 2.8) => {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return impulse;
};

const createSynth = () => {
  let ctx = null;
  let master = null;
  let dry = null;
  let echoIn = null;
  let timer = 0;
  let loopStart = 0;
  let scheduledUntil = 0;
  let loop = 0;
  let playing = false;

  /** Piano suave: parciales armónicos con caída exponencial. */
  const piano = (freq, time, { velocity = 0.5, length = 2.8 } = {}) => {
    const out = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900 + velocity * 2200, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + length);
    const peak = 0.11 * velocity;
    out.gain.setValueAtTime(0.0001, time);
    out.gain.linearRampToValueAtTime(peak, time + 0.012);
    out.gain.exponentialRampToValueAtTime(peak * 0.35, time + 0.5);
    out.gain.exponentialRampToValueAtTime(0.0001, time + length);
    [
      [1, 1, "triangle"],
      [2, 0.32, "sine"],
      [3, 0.12, "sine"],
    ].forEach(([mult, amp, type], i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq * mult;
      osc.detune.value = i === 0 ? 0 : (i % 2 ? 3 : -3);
      g.gain.value = amp;
      osc.connect(g).connect(filter);
      osc.start(time);
      osc.stop(time + length + 0.05);
    });
    filter.connect(out);
    out.connect(dry);
  };

  /** Caja de música: senoidal brillante, con eco. */
  const bell = (freq, time, { velocity = 0.6, length = 2.2 } = {}) => {
    const out = ctx.createGain();
    const peak = 0.07 * velocity;
    out.gain.setValueAtTime(0.0001, time);
    out.gain.linearRampToValueAtTime(peak, time + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, time + length);
    [
      [1, 1],
      [4.01, 0.08],
      [2, 0.18],
    ].forEach(([mult, amp]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      g.gain.value = amp;
      osc.connect(g).connect(out);
      osc.start(time);
      osc.stop(time + length + 0.05);
    });
    out.connect(dry);
    out.connect(echoIn);
  };

  /** Pad muy tenue que sostiene la armonía. */
  const pad = (freqs, time, length) => {
    const out = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    out.gain.setValueAtTime(0.0001, time);
    out.gain.linearRampToValueAtTime(0.018, time + length * 0.4);
    out.gain.linearRampToValueAtTime(0.0001, time + length + 0.6);
    for (const f of freqs) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + length + 0.8);
      }
    }
    filter.connect(out).connect(dry);
  };

  const humanize = () => (Math.random() - 0.5) * 0.018;

  const scheduleBar = (barIndex, time) => {
    const chordName = PROGRESSION[barIndex];
    const chord = CHORDS[chordName].map(NOTE);
    // Mano izquierda: arpegio en corcheas.
    ARPEGGIO.forEach((idx, i) => {
      piano(chord[idx], time + i * (BEAT / 2) + humanize(), { velocity: i === 0 ? 0.62 : 0.36 + Math.random() * 0.06 });
    });
    // Pad cada dos compases.
    if (barIndex % 2 === 0) pad([chord[2], chord[3] * 2], time, BAR * 2);
    // Melodía: en la primera vuelta entra en el compás 1; en las siguientes,
    // los cuatro primeros compases respiran (solo piano) y luego vuelve.
    const rest = loop > 0 && barIndex < 4;
    if (!rest) {
      let beat = 0;
      for (const [note, dur] of MELODY[barIndex]) {
        const f = NOTE(note) * (loop % 3 === 2 ? 2 : 1);
        bell(f, time + beat * BEAT + humanize(), { velocity: 0.55 + Math.random() * 0.15, length: 1.4 + dur * BEAT });
        beat += dur;
      }
    }
  };

  const scheduler = () => {
    const horizon = ctx.currentTime + 1.2;
    while (scheduledUntil < horizon) {
      const elapsed = scheduledUntil - loopStart;
      const barIndex = Math.round(elapsed / BAR);
      if (barIndex >= PROGRESSION.length) {
        loopStart += PROGRESSION.length * BAR + BAR; // un compás de silencio entre vueltas
        scheduledUntil = loopStart;
        loop += 1;
        continue;
      }
      scheduleBar(barIndex, loopStart + barIndex * BAR);
      scheduledUntil = loopStart + (barIndex + 1) * BAR;
    }
  };

  const ensure = () => {
    if (ctx) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0.0001;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;

    dry = ctx.createGain();
    dry.gain.value = 0.8;

    // Eco (corchea con puntillo) solo para la melodía.
    echoIn = ctx.createGain();
    echoIn.gain.value = 0.35;
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = BEAT * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 2200;
    echoIn.connect(delay).connect(echoTone).connect(feedback).connect(delay);
    echoTone.connect(dry);

    const reverb = ctx.createConvolver();
    reverb.buffer = createImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;

    dry.connect(comp);
    dry.connect(reverb).connect(wet).connect(comp);
    comp.connect(master).connect(ctx.destination);
    return true;
  };

  return {
    get playing() {
      return playing;
    },
    async play() {
      if (!ensure()) throw new Error("Web Audio no disponible");
      await ctx.resume();
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.9, now + 2.5);
      if (!loopStart || scheduledUntil < now) {
        loopStart = now + 0.1;
        scheduledUntil = loopStart;
        loop = 0;
      }
      scheduler();
      clearInterval(timer);
      timer = setInterval(scheduler, 300);
      playing = true;
    },
    async pause() {
      if (!ctx) return;
      playing = false;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      clearInterval(timer);
      await new Promise((r) => setTimeout(r, 1700));
      if (!playing) {
        await ctx.suspend();
        // Al volver, empieza desde el principio de la pieza.
        loopStart = 0;
      }
    },
  };
};

/** Reproduce un archivo propio con fundidos. */
const createFilePlayer = (src) => {
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "none";
  let fade = 0;
  const ramp = (to, ms) =>
    new Promise((resolve) => {
      cancelAnimationFrame(fade);
      const from = audio.volume;
      const start = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - start) / ms);
        audio.volume = from + (to - from) * k;
        if (k < 1) fade = requestAnimationFrame(step);
        else resolve();
      };
      fade = requestAnimationFrame(step);
    });
  return {
    get playing() {
      return !audio.paused;
    },
    async play() {
      audio.volume = 0;
      await audio.play();
      await ramp(0.85, 2000);
    },
    async pause() {
      await ramp(0, 1200);
      audio.pause();
    },
  };
};

export const createAmbientMusic = ({ src } = {}) => (src ? createFilePlayer(src) : createSynth());
