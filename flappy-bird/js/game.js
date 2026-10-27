// Game state machine: title -> ready -> playing -> dying -> gameover -> ready.
//
// Pure logic driven by tick(); input arrives as queued events
// ({ type: 'down' | 'up', kind: 'pointer' | 'key', x, y } in game px) and
// sounds leave through the onSound callback, so the whole game can be run
// headless (see tests/).
(function (FB) {
  'use strict';

  const C = FB.CONFIG;
  const L = C.LAYOUT;

  const STATE = Object.freeze({
    TITLE: 'title',
    READY: 'ready',
    PLAYING: 'playing',
    DYING: 'dying',
    GAMEOVER: 'gameover',
  });

  class Game {
    constructor(opts) {
      opts = opts || {};
      this.rng = opts.rng || FB.createRng(FB.randomSeed());
      this.cosmeticRng = opts.cosmeticRng || FB.createRng(FB.randomSeed());
      this.storage = opts.storage || null;
      this.onSound = opts.onSound || function () {};

      this.bird = new FB.Bird();
      this.pipes = new FB.PipeManager(this.rng);
      this.best = this.loadBest();
      this.playButton = {
        x: C.WIDTH / 2 - L.BUTTON_W / 2,
        y: L.PLAY_BUTTON_Y - L.BUTTON_H / 2,
        w: L.BUTTON_W,
        h: L.BUTTON_H,
        pressed: false,
      };
      this.events = [];
      this.tickCount = 0;
      this.scroll = 0;
      this.prevScroll = 0;
      this.fade = null;
      this.enterTitle();
    }

    // ---- external API --------------------------------------------------------

    queueEvent(e) {
      this.events.push(e);
    }

    tick() {
      this.tickCount++;
      this.bird.savePrev();
      this.pipes.savePrev();
      this.prevScroll = this.scroll;

      const events = this.events;
      this.events = [];
      const input = this.fade ? [] : events;

      switch (this.state) {
        case STATE.TITLE:
          this.tickTitle(input);
          break;
        case STATE.READY:
          this.tickReady(input);
          break;
        case STATE.PLAYING:
          this.tickPlaying(input);
          break;
        case STATE.DYING:
          this.tickDying();
          break;
        case STATE.GAMEOVER:
          this.tickGameOver(input);
          break;
      }

      this.tickFade();
      this.tickSounds();
    }

    get fadeAlpha() {
      if (!this.fade) return 0;
      const k = this.fade.t / C.FADE_TICKS;
      return this.fade.phase === 'out' ? k : 1 - k;
    }

    get readyAlpha() {
      if (this.state === STATE.READY) return 1;
      if (this.state === STATE.PLAYING) return this.readyFade / C.READY_FADE_TICKS;
      return 0;
    }

    get showScore() {
      return (
        this.state === STATE.READY || this.state === STATE.PLAYING || this.state === STATE.DYING
      );
    }

    get buttonVisible() {
      if (this.state === STATE.TITLE) return true;
      return this.state === STATE.GAMEOVER && this.go.t >= this.go.buttonsAt;
    }

    // ---- states ----------------------------------------------------------------

    enterTitle() {
      this.state = STATE.TITLE;
      this.resetWorld();
      this.bird.reset(L.TITLE_BIRD_X, L.TITLE_BIRD_Y);
    }

    resetWorld() {
      this.score = 0;
      this.flash = 0;
      this.readyFade = 0;
      this.go = null;
      this.pendingSounds = [];
      this.pipes.reset();
      this.bird.reset(C.BIRD_X, C.BIRD_START_Y);
      this.playButton.pressed = false;
    }

    activatePlay() {
      if (this.fade) return;
      this.playButton.pressed = false;
      this.sound('swoosh');
      this.fade = {
        phase: 'out',
        t: 0,
        action: () => {
          this.resetWorld();
          this.state = STATE.READY;
        },
      };
    }

    tickTitle(events) {
      this.scrollWorld();
      this.bird.updateIdle();
      this.handleButton(events);
    }

    tickReady(events) {
      this.scrollWorld();
      if (events.some((e) => e.type === 'down')) {
        this.startPlaying();
        return;
      }
      this.bird.updateIdle();
    }

    startPlaying() {
      this.state = STATE.PLAYING;
      this.readyFade = C.READY_FADE_TICKS;
      this.pipes.spawn();
      this.bird.flap();
      this.sound('flap');
    }

    tickPlaying(events) {
      this.scrollWorld();
      this.pipes.scroll();
      if (this.readyFade > 0) this.readyFade--;

      // One flap per tick no matter how many taps landed in it.
      if (events.some((e) => e.type === 'down')) {
        this.bird.flap();
        this.sound('flap');
      }
      this.bird.updateFlying();

      const bird = this.bird;
      if (FB.Collision.hitsGround(bird)) {
        bird.y = C.GROUND_Y - C.GROUND_CONTACT;
        this.die('ground');
        return;
      }
      if (FB.Collision.hitsCeiling(bird)) {
        this.die('ceiling');
        return;
      }
      for (const p of this.pipes.list) {
        if (FB.Collision.hitsPipe(bird, p)) {
          this.die('pipe');
          return;
        }
        // A pair scores once its trailing edge is behind the bird's centre.
        if (!p.passed && p.x + C.PIPE_WIDTH < bird.x) {
          p.passed = true;
          this.score++;
          this.sound('point');
        }
      }
      this.pipes.tickSpawner();
    }

    die(cause) {
      this.state = STATE.DYING;
      this.deathCause = cause;
      this.flash = C.FLASH_TICKS;
      this.bird.die();
      this.sound('hit');
      // Hitting the ground is a single smack; anything else falls with a swoop.
      if (cause !== 'ground') this.soundLater('die', C.DIE_SOUND_DELAY);
    }

    tickDying() {
      if (this.flash > 0) this.flash--;
      const bird = this.bird;
      bird.updateDead(FB.Collision.hitsGround(bird));
      if (FB.Collision.hitsGround(bird)) {
        bird.y = C.GROUND_Y - C.GROUND_CONTACT;
        this.enterGameOver();
      }
    }

    enterGameOver() {
      this.state = STATE.GAMEOVER;
      const newBest = this.score > this.best;
      if (newBest) {
        this.best = this.score;
        this.saveBest();
      }
      const panelEnd = C.PANEL_DELAY + C.PANEL_SLIDE_TICKS;
      const countTicks = Math.min(this.score * 2, C.COUNT_MAX_TICKS);
      this.go = {
        t: 0,
        newBest,
        medal: medalFor(this.score),
        panelStart: C.PANEL_DELAY,
        panelEnd,
        countTicks,
        countEnd: panelEnd + countTicks,
        buttonsAt: panelEnd + countTicks + C.BUTTONS_DELAY,
        sparkle: null,
      };
    }

    tickGameOver(events) {
      if (this.flash > 0) this.flash--;
      this.bird.updateDead(true);
      const go = this.go;
      go.t++;
      if (go.t === go.panelStart) this.sound('swoosh');
      if (go.medal && go.t >= go.countEnd) this.tickSparkle();
      if (go.t >= go.buttonsAt + C.BUTTON_GUARD_TICKS) this.handleButton(events);
    }

    // Score shown on the panel while it counts up from zero.
    get displayScore() {
      const go = this.go;
      if (!go || go.t < go.panelEnd) return 0;
      if (go.countTicks === 0) return this.score;
      const k = Math.min(1, (go.t - go.panelEnd) / go.countTicks);
      return Math.floor(this.score * k);
    }

    tickSparkle() {
      const go = this.go;
      if (!go.sparkle || go.sparkle.age >= C.SPARKLE_TICKS) {
        // Random point inside the medal disc (radius in game px).
        const a = this.cosmeticRng.next() * Math.PI * 2;
        const r = Math.sqrt(this.cosmeticRng.next()) * 16;
        go.sparkle = { dx: Math.cos(a) * r, dy: Math.sin(a) * r, age: 0 };
      }
      go.sparkle.age++;
    }

    // ---- helpers -----------------------------------------------------------------

    scrollWorld() {
      this.scroll += C.WORLD_SPEED;
    }

    // Buttons act on release inside them (press sinks the button), like the
    // original. A key press activates the visible button directly.
    handleButton(events) {
      const b = this.playButton;
      for (const e of events) {
        if (e.kind === 'key') {
          if (e.type === 'down') {
            this.activatePlay();
            return;
          }
          continue;
        }
        const inside = e.x >= b.x && e.x < b.x + b.w && e.y >= b.y && e.y < b.y + b.h;
        if (e.type === 'down' && inside) {
          b.pressed = true;
        } else if (e.type === 'up' && b.pressed) {
          b.pressed = false;
          if (inside) {
            this.activatePlay();
            return;
          }
        }
      }
    }

    tickFade() {
      const f = this.fade;
      if (!f) return;
      f.t++;
      if (f.t < C.FADE_TICKS) return;
      if (f.phase === 'out') {
        f.action();
        f.phase = 'in';
        f.t = 0;
      } else {
        this.fade = null;
      }
    }

    sound(name) {
      this.onSound(name);
    }

    soundLater(name, ticks) {
      this.pendingSounds.push({ name, at: this.tickCount + ticks });
    }

    tickSounds() {
      if (!this.pendingSounds.length) return;
      const due = this.pendingSounds.filter((s) => s.at <= this.tickCount);
      this.pendingSounds = this.pendingSounds.filter((s) => s.at > this.tickCount);
      for (const s of due) this.sound(s.name);
    }

    loadBest() {
      try {
        const v = this.storage && parseInt(this.storage.getItem(C.STORAGE_KEY), 10);
        return v > 0 ? v : 0;
      } catch (e) {
        return 0;
      }
    }

    saveBest() {
      try {
        if (this.storage) this.storage.setItem(C.STORAGE_KEY, String(this.best));
      } catch (e) {
        // Storage can be unavailable (private mode); best score stays in memory.
      }
    }
  }

  function medalFor(score) {
    for (const m of C.MEDALS) if (score >= m.min) return m.name;
    return null;
  }

  FB.STATE = STATE;
  FB.Game = Game;
  FB.medalFor = medalFor;
})((globalThis.FB = globalThis.FB || {}));
