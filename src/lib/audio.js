/**
 * Música ambiental sintetizada: pads suaves con reverb (ConvolverNode con
 * impulso generado), algunas notas de caja de música y fade in/out.
 * Solo arranca tras una interacción del usuario.
 */
const CHORDS = [
  // Fmaj7 · Dm9 · Bbmaj7 · Csus4 → C
  [174.61, 220.0, 261.63, 329.63],
  [146.83, 220.0, 261.63, 329.63],
  [116.54, 233.08, 293.66, 349.23],
  [130.81, 196.0, 261.63, 349.23],
];
const MELODY = [523.25, 587.33, 659.25, 783.99, 880.0, 698.46];
const BAR = 6.4;

const createImpulse = (ctx, seconds = 3.2, decay = 2.6) => {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c += 1) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return impulse;
};

export const createAmbientMusic = () => {
  let ctx = null;
  let master = null;
  let bus = null;
  let timer = 0;
  let nextBar = 0;
  let bar = 0;
  let playing = false;

  const voice = (freq, start, duration, { type = "sine", gain = 0.05, attack = 1.8, release = 2.6, detune = 0 } = {}) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gain, start + attack);
    g.gain.setValueAtTime(gain, start + duration - release);
    g.gain.linearRampToValueAtTime(0.0001, start + duration);
    osc.connect(filter).connect(g).connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.1);
  };

  const pluck = (freq, start) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.035, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 2.2);
    osc.connect(g).connect(bus);
    osc.start(start);
    osc.stop(start + 2.4);
  };

  const scheduleBar = (time) => {
    const chord = CHORDS[bar % CHORDS.length];
    chord.forEach((f, i) => {
      voice(f, time, BAR + 1.6, { gain: i === 0 ? 0.055 : 0.032, detune: -4 });
      voice(f, time, BAR + 1.6, { gain: i === 0 ? 0 : 0.02, type: "triangle", detune: 5 });
    });
    for (let i = 0; i < 3; i += 1) {
      if (Math.random() < 0.6) pluck(MELODY[(bar * 3 + i * 2 + Math.floor(Math.random() * 3)) % MELODY.length], time + 0.8 + i * 1.9 + Math.random() * 0.3);
    }
    bar += 1;
  };

  const scheduler = () => {
    while (nextBar < ctx.currentTime + 1.5) {
      scheduleBar(nextBar);
      nextBar += BAR;
    }
  };

  const ensure = () => {
    if (ctx) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0;
    bus = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    const reverb = ctx.createConvolver();
    reverb.buffer = createImpulse(ctx);
    bus.connect(dry).connect(master);
    bus.connect(reverb).connect(wet).connect(master);
    master.connect(ctx.destination);
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
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.9, now + 2.5);
      nextBar = Math.max(nextBar, now + 0.05);
      scheduler();
      clearInterval(timer);
      timer = setInterval(scheduler, 500);
      playing = true;
    },
    async pause() {
      if (!ctx) return;
      playing = false;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + 1.4);
      clearInterval(timer);
      await new Promise((r) => setTimeout(r, 1500));
      if (!playing) await ctx.suspend();
    },
  };
};
