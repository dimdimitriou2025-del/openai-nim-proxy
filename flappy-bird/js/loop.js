// Fixed-timestep driver: the simulation always advances in 1/60 s ticks no
// matter how often frames are drawn; rendering gets the leftover fraction
// of a tick for interpolation. DOM-free so tests can feed it timestamps.
(function (FB) {
  'use strict';

  const C = FB.CONFIG;

  class FixedLoop {
    constructor(step, render) {
      this.step = step;
      this.render = render;
      this.stepSeconds = 1 / C.TICK_RATE;
      this.acc = 0;
      this.last = null;
      this.ticks = 0;
    }

    // Call with a millisecond timestamp (requestAnimationFrame's argument).
    frame(nowMs) {
      if (this.last === null) this.last = nowMs;
      let dt = (nowMs - this.last) / 1000;
      this.last = nowMs;
      if (!(dt > 0)) dt = 0;
      if (dt > C.MAX_FRAME_TIME) dt = C.MAX_FRAME_TIME;

      this.acc += dt;
      // Run a tick up to a quarter tick early and carry the debt, so jittery
      // 60 Hz timestamps give exactly one tick per frame instead of
      // alternating 0 and 2, while the long-run rate stays exactly 60/s.
      const early = this.stepSeconds * 0.25;
      while (this.acc >= this.stepSeconds - early) {
        this.step();
        this.ticks++;
        this.acc -= this.stepSeconds;
      }
      this.render(Math.max(0, this.acc) / this.stepSeconds);
    }

    // Forget the clock (e.g. after the tab was hidden) so no time is
    // "caught up" when frames resume.
    resetClock() {
      this.last = null;
      this.acc = 0;
    }
  }

  FB.FixedLoop = FixedLoop;
})((globalThis.FB = globalThis.FB || {}));
