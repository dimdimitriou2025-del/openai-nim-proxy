// Sound effects synthesised at start-up with Web Audio (no audio files):
// wing flap, point chime, hit smack, falling "die" swoop and UI swoosh,
// matching the five cues of the original. Short, dry, arcade-style.
(function (FB) {
  'use strict';

  const VOICES_PER_SOUND = 3;

  // Deterministic noise so the sounds are identical on every load.
  function noiseSource(seed) {
    const rng = FB.createRng(seed);
    return () => rng.next() * 2 - 1;
  }

  // Chamberlin state-variable band-pass with a per-sample cutoff.
  function bandPass(sr, q) {
    let low = 0;
    let band = 0;
    return (x, fc) => {
      const f = 2 * Math.sin((Math.PI * Math.min(fc, sr / 6)) / sr);
      low += f * band;
      const high = x - low - q * band;
      band += f * high;
      return band;
    };
  }

  function make(sr, seconds, fn) {
    const n = Math.floor(sr * seconds);
    const out = new Float32Array(n);
    let peak = 0;
    for (let i = 0; i < n; i++) {
      out[i] = fn(i / sr, i);
      peak = Math.max(peak, Math.abs(out[i]));
    }
    if (peak > 0) for (let i = 0; i < n; i++) out[i] /= peak;
    // 2 ms fade at both ends to avoid clicks.
    const edge = Math.min(n >> 1, Math.floor(sr * 0.002));
    for (let i = 0; i < edge; i++) {
      out[i] *= i / edge;
      out[n - 1 - i] *= i / edge;
    }
    return out;
  }

  const SYNTHS = {
    // Quick feathery "fwip": noise swept down through a band-pass.
    flap(sr) {
      const noise = noiseSource(11);
      const bp = bandPass(sr, 0.9);
      let phase = 0;
      return make(sr, 0.13, (t) => {
        const env = Math.min(1, t / 0.006) * Math.exp(-t / 0.035);
        const fc = 2600 * Math.exp(-t * 12) + 500;
        phase += (2 * Math.PI * (260 - t * 900)) / sr;
        return bp(noise(), fc) * env + 0.25 * Math.sin(phase) * env;
      });
    },

    // Bright two-step chime.
    point(sr) {
      let phase = 0;
      return make(sr, 0.42, (t) => {
        const f = t < 0.07 ? 1046.5 : 1568;
        phase += (2 * Math.PI * f) / sr;
        const local = t < 0.07 ? t : t - 0.07;
        const env = Math.min(1, local / 0.004) * Math.exp(-local / (t < 0.07 ? 0.05 : 0.14));
        const tone = Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase);
        return tone * env;
      });
    },

    // Short smack: noise crack over a falling thump.
    hit(sr) {
      const noise = noiseSource(23);
      const bp = bandPass(sr, 1.2);
      let phase = 0;
      return make(sr, 0.18, (t) => {
        phase += (2 * Math.PI * (190 * Math.exp(-t * 14) + 55)) / sr;
        const crack = bp(noise(), 1800) * Math.exp(-t / 0.018);
        const thump = Math.sin(phase) * Math.exp(-t / 0.05);
        return 0.9 * crack + thump;
      });
    },

    // Falling swoop after a pipe hit.
    die(sr) {
      const noise = noiseSource(37);
      const bp = bandPass(sr, 0.7);
      let phase = 0;
      return make(sr, 0.55, (t) => {
        const f = 760 * Math.exp(-t * 2.6) + 120;
        phase += (2 * Math.PI * f) / sr;
        const env = Math.min(1, t / 0.03) * Math.min(1, (0.55 - t) / 0.18);
        const tri = (2 / Math.PI) * Math.asin(Math.sin(phase));
        return (0.8 * tri + 0.35 * bp(noise(), f * 2.2)) * env;
      });
    },

    // Airy whoosh for screen transitions and the score panel.
    swoosh(sr) {
      const noise = noiseSource(41);
      const bp = bandPass(sr, 0.6);
      return make(sr, 0.36, (t) => {
        const k = t / 0.36;
        const env = Math.pow(Math.sin(Math.PI * k), 2);
        const fc = 500 + 2600 * Math.sin(Math.PI * Math.min(1, k * 1.2));
        return bp(noise(), fc) * env;
      });
    },
  };

  const GAINS = { flap: 0.5, point: 0.45, hit: 0.7, die: 0.5, swoosh: 0.35 };

  class Sound {
    constructor(storage) {
      this.storage = storage;
      this.ctx = null;
      this.buffers = {};
      this.voices = {};
      this.muted = false;
      try {
        this.muted = storage && storage.getItem('flappy-recreation-muted') === '1';
      } catch (e) {
        this.muted = false;
      }
    }

    // Must run inside a user gesture (browsers start audio suspended).
    unlock() {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
        const sr = this.ctx.sampleRate;
        for (const name in SYNTHS) {
          const data = SYNTHS[name](sr);
          const buf = this.ctx.createBuffer(1, data.length, sr);
          buf.getChannelData(0).set(data);
          this.buffers[name] = buf;
          this.voices[name] = [];
        }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    play(name) {
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running' || !this.buffers[name]) return;
      const voices = this.voices[name];
      while (voices.length >= VOICES_PER_SOUND) {
        const old = voices.shift();
        try {
          old.stop();
        } catch (e) {
          // already finished
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = this.buffers[name];
      const gain = ctx.createGain();
      gain.gain.value = GAINS[name];
      src.connect(gain);
      gain.connect(this.master);
      src.onended = () => {
        const i = voices.indexOf(src);
        if (i >= 0) voices.splice(i, 1);
      };
      voices.push(src);
      src.start();
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 1;
      try {
        if (this.storage) this.storage.setItem('flappy-recreation-muted', this.muted ? '1' : '0');
      } catch (e) {
        // ignore unavailable storage
      }
    }
  }

  FB.Sound = Sound;
  FB.SYNTHS = SYNTHS;
})((globalThis.FB = globalThis.FB || {}));
