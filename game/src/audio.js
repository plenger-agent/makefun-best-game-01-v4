// Sound: a small WebAudio synth, no audio files.
//
// Every effect is oscillators and filtered noise shaped in code: the
// beam's hum (a continuous oscillator whose pitch follows the light),
// glass chimes for building, a low bell for the Dawn Bell, a tearing
// lance, the Storm Prism's crackle, the hiss of melting ice, a bright
// chime when an achievement lands, soft pops for kills and a two-note
// fall when a shade reaches the crystal. The context is created lazily
// on the first user gesture, as browsers require; until then every call
// is a no-op.

/** Create the audio engine (inert until `unlock` is called by a gesture). */
export function makeAudio() {
  const state = {
    ctx: null,
    master: null,
    humOsc: null,
    humGain: null,
    muted: false,
  };

  function unlock() {
    if (state.ctx) {
      if (state.ctx.state === 'suspended') state.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    state.ctx = new AC();
    state.master = state.ctx.createGain();
    state.master.gain.value = state.muted ? 0 : 0.5;
    state.master.connect(state.ctx.destination);
    startHum();
  }

  function startHum() {
    const ctx = state.ctx;
    state.humOsc = ctx.createOscillator();
    state.humOsc.type = 'sine';
    state.humOsc.frequency.value = 196;
    const shimmer = ctx.createOscillator();
    shimmer.type = 'triangle';
    shimmer.frequency.value = 392.5;
    state.humGain = ctx.createGain();
    state.humGain.gain.value = 0.0;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.35;
    state.humOsc.connect(state.humGain);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(state.humGain);
    state.humGain.connect(state.master);
    state.humOsc.start();
    shimmer.start();
  }

  /** Set the beam hum's loudness/pitch from how much light is burning. */
  function setHum(level, night) {
    if (!state.ctx || !state.humGain) return;
    const t = state.ctx.currentTime;
    const target = state.muted ? 0 : Math.min(0.16, level * 0.16);
    state.humGain.gain.setTargetAtTime(target, t, 0.08);
    state.humOsc.frequency.setTargetAtTime(night ? 146 : 196 + level * 60, t, 0.1);
  }

  /** One shaped tone. */
  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!state.ctx || state.muted) return;
    const ctx = state.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(state.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** A short burst of filtered noise (ash, impacts, the lance's tear). */
  function noise(dur, vol, freq, delay = 0, type = 'bandpass') {
    if (!state.ctx || state.muted) return;
    const ctx = state.ctx;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(state.master);
    src.start(t0);
  }

  return {
    unlock,
    setHum,
    toggleMute() {
      state.muted = !state.muted;
      if (state.master && state.ctx) {
        state.master.gain.setTargetAtTime(state.muted ? 0 : 0.5, state.ctx.currentTime, 0.03);
      }
      return state.muted;
    },
    get muted() { return state.muted; },
    build() { tone(660, 0.16, 'triangle', 0.16); tone(990, 0.22, 'sine', 0.12, null, 0.05); },
    upgrade() { tone(523, 0.12, 'triangle', 0.14); tone(784, 0.14, 'triangle', 0.14, null, 0.07); tone(1046, 0.2, 'sine', 0.12, null, 0.14); },
    sell() { tone(880, 0.1, 'sine', 0.1, 660); },
    rotate() { tone(440, 0.05, 'sine', 0.05, 470); },
    kill() { noise(0.09, 0.1, 1400); tone(220, 0.09, 'square', 0.045, 110); },
    leak() { tone(392, 0.18, 'sawtooth', 0.1, 196); tone(311, 0.3, 'sawtooth', 0.09, 155, 0.1); },
    bell() { tone(174, 1.1, 'sine', 0.22, 173); tone(261, 0.9, 'sine', 0.1, 260, 0.02); tone(349, 0.7, 'sine', 0.06, 348, 0.04); },
    lance() { noise(0.24, 0.2, 2600); tone(1180, 0.22, 'sawtooth', 0.07, 240); },
    zap() { noise(0.13, 0.16, 3400); tone(1560, 0.1, 'square', 0.05, 320); noise(0.08, 0.1, 900, 0.03); },
    melt() { noise(0.7, 0.07, 5200, 0, 'highpass'); tone(740, 0.4, 'sine', 0.04, 990); },
    surface() { noise(0.16, 0.08, 500); },
    achievement() { tone(880, 0.16, 'sine', 0.12); tone(1174, 0.2, 'sine', 0.11, null, 0.08); tone(1568, 0.3, 'sine', 0.1, null, 0.16); },
    islandClear() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.26, 'triangle', 0.12, null, i * 0.09)); },
    waveStart() { tone(329, 0.14, 'triangle', 0.12); tone(494, 0.2, 'triangle', 0.12, null, 0.09); },
    waveClear() { tone(523, 0.12, 'triangle', 0.13); tone(659, 0.12, 'triangle', 0.13, null, 0.08); tone(784, 0.24, 'sine', 0.13, null, 0.16); },
    gameOver() { tone(330, 0.4, 'triangle', 0.16, 165); tone(262, 0.7, 'triangle', 0.14, 131, 0.25); },
    victory() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.13, null, i * 0.11)); },
    click() { tone(740, 0.05, 'sine', 0.06); },
    error() { tone(160, 0.12, 'square', 0.07, 140); },
  };
}
