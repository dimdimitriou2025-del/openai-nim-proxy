// Pipe pairs: spawning, scrolling and recycling. Pure logic, no DOM.
//
// Each pair is { x, prevX, gapY, passed } where x is the left edge and gapY
// the centre of the opening. Pairs spawn just off the right edge every
// PIPE_SPAWN_INTERVAL ticks, so consecutive pairs are always 180 px apart.
(function (FB) {
  'use strict';

  const C = FB.CONFIG;

  class PipeManager {
    constructor(rng) {
      this.rng = rng;
      this.reset();
    }

    reset() {
      this.list = [];
      this.spawnTimer = 0;
    }

    spawn() {
      if (this.list.length >= C.MAX_PIPES) return;
      const gapY = this.rng.int(C.PIPE_GAP_CENTER_MIN, C.PIPE_GAP_CENTER_MAX);
      this.list.push({ x: C.PIPE_SPAWN_X, prevX: C.PIPE_SPAWN_X, gapY, passed: false });
    }

    savePrev() {
      for (const p of this.list) p.prevX = p.x;
    }

    scroll() {
      for (const p of this.list) p.x -= C.WORLD_SPEED;
      while (this.list.length && this.list[0].x + C.PIPE_WIDTH < 0) this.list.shift();
    }

    tickSpawner() {
      this.spawnTimer++;
      if (this.spawnTimer >= C.PIPE_SPAWN_INTERVAL && this.list.length < C.MAX_PIPES) {
        this.spawnTimer = 0;
        this.spawn();
      }
    }
  }

  FB.PipeManager = PipeManager;
})((globalThis.FB = globalThis.FB || {}));
