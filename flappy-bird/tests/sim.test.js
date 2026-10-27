// Headless tests of the simulation: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { FB, C, memoryStorage, readyGame, press, autopilotWantsFlap } = require('./helpers');

// Keeps the bird hovering at a fixed height (for scoring/collision tests).
function pin(game, y) {
  game.bird.y = y;
  game.bird.updateFlying = function () {
    this.y = y;
  };
}

test('flap sets velocity instead of adding to it', () => {
  const b = new FB.Bird();
  for (const v of [-3, 0, 4, C.MAX_FALL_SPEED]) {
    b.vel = v;
    b.flap();
    assert.equal(b.vel, C.FLAP_VELOCITY);
  }
});

test('flap arc: apex ~0.22 s, ~32 px high, back to start height in ~0.45 s', () => {
  const b = new FB.Bird();
  b.flap();
  let minY = b.y;
  let apex = 0;
  let back = 0;
  for (let t = 1; t < 120; t++) {
    b.updateFlying();
    if (b.y < minY) {
      minY = b.y;
      apex = t;
    }
    if (t > 2 && b.y >= C.BIRD_START_Y) {
      back = t;
      break;
    }
  }
  assert.equal(apex, 13);
  assert.ok(Math.abs(C.BIRD_START_Y - minY - 32.2) < 0.5, 'height ' + (C.BIRD_START_Y - minY));
  assert.equal(back, 27);
});

test('gravity is constant until terminal velocity', () => {
  const b = new FB.Bird();
  b.vel = 0;
  const v = [];
  for (let i = 0; i < 60; i++) {
    b.updateFlying();
    v.push(b.vel);
  }
  assert.ok(Math.abs(v[1] - v[0] - C.GRAVITY) < 1e-9);
  assert.equal(Math.max(...v), C.MAX_FALL_SPEED);
});

test('rotation: snaps nose-up on flap, dives to 90 degrees, wings stop in a dive', () => {
  const b = new FB.Bird();
  b.flap();
  assert.equal(b.rot, C.ROT_FLAP);
  let t = 0;
  while (b.rot < C.ROT_MAX && t < 200) {
    b.updateFlying();
    t++;
    if (b.vel < C.ROT_DIVE_START_VELOCITY) assert.equal(b.rot, C.ROT_FLAP);
  }
  assert.equal(b.rot, C.ROT_MAX);
  const frame = b.frame;
  for (let i = 0; i < 30; i++) b.updateFlying();
  assert.equal(b.frame, frame, 'wings frozen while nose-diving');
});

test('pipes: 180 px apart, gap 100, gap centre always inside [100, 300]', () => {
  const g = readyGame(3);
  press(g);
  pin(g, 9999); // irrelevant: collisions are not checked below
  const seen = [];
  for (let i = 0; i < 5000; i++) {
    g.pipes.scroll();
    g.pipes.tickSpawner();
    for (let j = 1; j < g.pipes.list.length; j++) {
      assert.equal(g.pipes.list[j].x - g.pipes.list[j - 1].x, 180);
    }
    const last = g.pipes.list[g.pipes.list.length - 1];
    if (last && last.x === C.PIPE_SPAWN_X) seen.push(last.gapY);
  }
  assert.ok(seen.length > 50);
  for (const y of seen) {
    assert.ok(y >= C.PIPE_GAP_CENTER_MIN && y <= C.PIPE_GAP_CENTER_MAX);
    assert.ok(y - C.PIPE_GAP / 2 >= 50 && y + C.PIPE_GAP / 2 <= C.GROUND_Y - 50);
  }
  assert.ok(Math.min(...seen) < 120 && Math.max(...seen) > 280, 'uses the whole range');
  assert.ok(g.pipes.list.length <= 3);
});

test('first pair appears at the right edge as play starts; pipes move 2 px per tick', () => {
  const g = readyGame();
  press(g);
  g.tick();
  assert.equal(g.state, 'playing');
  assert.equal(g.pipes.list.length, 1);
  const x0 = g.pipes.list[0].x;
  g.tick();
  assert.equal(x0 - g.pipes.list[0].x, C.WORLD_SPEED);
});

test('scoring: exactly one point per pair, when its trailing edge passes the bird', () => {
  const g = readyGame(5);
  press(g);
  g.tick();
  // Hover in the middle of every gap by aligning gaps with the bird.
  pin(g, 200);
  const passTicks = [];
  let last = 0;
  for (let i = 0; i < 1000; i++) {
    for (const p of g.pipes.list) p.gapY = 200;
    g.tick();
    assert.equal(g.state, 'playing');
    if (g.score !== last) {
      assert.equal(g.score, last + 1, 'never more than one point at a time');
      last = g.score;
      passTicks.push(g.tickCount);
      const p = g.pipes.list.find((q) => q.passed && q.x + C.PIPE_WIDTH < C.BIRD_X);
      assert.ok(p && p.x + C.PIPE_WIDTH >= C.BIRD_X - C.WORLD_SPEED, 'scored on the crossing tick');
    }
  }
  assert.ok(passTicks.length >= 9);
  for (let i = 1; i < passTicks.length; i++) {
    assert.equal(passTicks[i] - passTicks[i - 1], C.PIPE_SPAWN_INTERVAL, 'one point per 1.5 s');
  }
});

test('collisions: upper pipe, lower pipe, ground and ceiling end the run', () => {
  const pipe = { x: C.BIRD_X - 20, gapY: 200 };
  const bird = { x: C.BIRD_X, y: 200 };
  assert.equal(FB.Collision.hitsPipe(bird, pipe), false);
  bird.y = 150 + C.HITBOX_HALF_H; // box top exactly on the upper lip
  assert.equal(FB.Collision.hitsUpperPipe(bird, pipe), false);
  bird.y -= 0.5;
  assert.equal(FB.Collision.hitsUpperPipe(bird, pipe), true);
  assert.equal(FB.Collision.hitsLowerPipe(bird, pipe), false);
  bird.y = 250 - C.HITBOX_HALF_H + 0.5;
  assert.equal(FB.Collision.hitsLowerPipe(bird, pipe), true);
  // Pipes extend without limit above the screen.
  assert.equal(FB.Collision.hitsUpperPipe({ x: C.BIRD_X, y: -500 }, pipe), true);
  // Horizontal extent.
  assert.equal(FB.Collision.hitsPipe({ x: C.BIRD_X, y: 0 }, { x: C.BIRD_X + C.HITBOX_HALF_W, gapY: 300 }), false);
  assert.equal(FB.Collision.hitsPipe({ x: C.BIRD_X, y: 0 }, { x: C.BIRD_X + C.HITBOX_HALF_W - 1, gapY: 300 }), true);
  assert.equal(FB.Collision.hitsGround({ y: C.GROUND_Y - C.GROUND_CONTACT - 0.1 }), false);
  assert.equal(FB.Collision.hitsGround({ y: C.GROUND_Y - C.GROUND_CONTACT }), true);
  assert.equal(FB.Collision.hitsCeiling({ y: C.CEILING_CONTACT }), false);
  assert.equal(FB.Collision.hitsCeiling({ y: C.CEILING_CONTACT - 0.1 }), C.CEILING_KILLS);
});

test('ground death: smack only, bird rests nose-down at the ground line', () => {
  const g = readyGame();
  press(g);
  g.tick();
  for (let i = 0; i < 300 && g.state === 'playing'; i++) g.tick();
  assert.equal(g.deathCause, 'ground');
  const names = g.sounds.map((s) => s.s);
  assert.ok(names.includes('hit'));
  for (let i = 0; i < 120; i++) g.tick();
  assert.equal(g.state, 'gameover');
  assert.ok(!g.sounds.map((s) => s.s).includes('die'), 'no swoop for a ground hit');
  assert.equal(g.bird.y, C.GROUND_Y - C.GROUND_CONTACT);
  assert.equal(g.bird.rot, C.ROT_MAX);
});

test('pipe death: hit then swoop, world stops, no points after death', () => {
  const g = readyGame(2);
  press(g);
  g.tick();
  pin(g, 200);
  for (const p of g.pipes.list) p.gapY = 380; // gap far below: bird hits the upper pipe
  for (let i = 0; i < 400 && g.state === 'playing'; i++) {
    for (const p of g.pipes.list) p.gapY = 380;
    g.tick();
  }
  assert.equal(g.state, 'dying');
  assert.equal(g.deathCause, 'pipe');
  assert.equal(g.score, 0);
  const pipeX = g.pipes.list.map((p) => p.x);
  const scroll = g.scroll;
  delete g.bird.updateFlying;
  for (let i = 0; i < 200; i++) g.tick();
  assert.equal(g.state, 'gameover');
  assert.deepEqual(g.pipes.list.map((p) => p.x), pipeX, 'pipes frozen');
  assert.equal(g.scroll, scroll, 'ground frozen');
  assert.equal(g.score, 0, 'no points while dying');
  const hit = g.sounds.find((s) => s.s === 'hit');
  const die = g.sounds.find((s) => s.s === 'die');
  assert.ok(hit && die && die.tick - hit.tick === C.DIE_SOUND_DELAY);
});

test('game over: panel counts up, medal/new best, button only after the sequence', () => {
  const storage = memoryStorage({ [C.STORAGE_KEY]: '12' });
  const g = readyGame(1, { storage });
  assert.equal(g.best, 12);
  press(g);
  g.tick();
  g.score = 23; // pretend
  g.bird.y = C.GROUND_Y; // force a ground death next tick
  g.tick();
  while (g.state !== 'gameover') g.tick();
  assert.equal(g.go.medal, 'silver');
  assert.equal(g.go.newBest, true);
  assert.equal(storage.getItem(C.STORAGE_KEY), '23');
  assert.equal(g.buttonVisible, false);
  // Input during the sequence is ignored.
  press(g);
  g.tick();
  assert.equal(g.state, 'gameover');
  assert.equal(g.fade, null);
  let lastShown = 0;
  while (!g.buttonVisible) {
    assert.ok(g.displayScore >= lastShown && g.displayScore <= 23);
    lastShown = g.displayScore;
    g.tick();
  }
  assert.equal(g.displayScore, 23);
  // Even a visible button ignores the first few ticks of input.
  press(g);
  g.tick();
  assert.equal(g.fade, null);
});

test('restart: play button resets everything and does not also flap', () => {
  const g = readyGame(4);
  press(g);
  for (let i = 0; i < 400 && g.state !== 'gameover'; i++) g.tick();
  while (!g.buttonVisible) g.tick();
  for (let i = 0; i < C.BUTTON_GUARD_TICKS; i++) g.tick();
  const b = g.playButton;
  // Press inside, release outside: cancelled.
  g.queueEvent({ type: 'down', kind: 'pointer', x: b.x + 5, y: b.y + 5 });
  g.queueEvent({ type: 'up', kind: 'pointer', x: 5, y: 5 });
  g.tick();
  assert.equal(g.fade, null);
  // Proper tap.
  g.queueEvent({ type: 'down', kind: 'pointer', x: b.x + 5, y: b.y + 5 });
  g.tick();
  assert.equal(b.pressed, true);
  g.queueEvent({ type: 'up', kind: 'pointer', x: b.x + 6, y: b.y + 6 });
  g.tick();
  assert.ok(g.fade);
  // Mash during the fade: must not leak into the next run.
  while (g.fade) {
    press(g);
    g.tick();
  }
  assert.equal(g.state, 'ready');
  assert.equal(g.score, 0);
  assert.equal(g.pipes.list.length, 0);
  assert.equal(g.bird.dead, false);
  assert.equal(g.bird.x, C.BIRD_X);
  assert.ok(Math.abs(g.bird.y - C.BIRD_START_Y) <= C.BOB_AMPLITUDE);
  assert.equal(g.flash, 0);
  assert.equal(g.go, null);
  press(g);
  g.tick();
  assert.equal(g.state, 'playing');
});

test('title: tap must hit the play button', () => {
  const g = new FB.Game({ rng: FB.createRng(1) });
  g.queueEvent({ type: 'down', kind: 'pointer', x: 10, y: 10 });
  g.queueEvent({ type: 'up', kind: 'pointer', x: 10, y: 10 });
  g.tick();
  assert.equal(g.fade, null);
  const b = g.playButton;
  g.queueEvent({ type: 'down', kind: 'pointer', x: b.x + b.w / 2, y: b.y + b.h / 2 });
  g.queueEvent({ type: 'up', kind: 'pointer', x: b.x + b.w / 2, y: b.y + b.h / 2 });
  g.tick();
  assert.ok(g.fade);
});

test('one flap per tick even with several taps in it', () => {
  const g = readyGame();
  press(g);
  g.tick();
  const before = g.sounds.filter((s) => s.s === 'flap').length;
  press(g);
  press(g);
  press(g);
  g.tick();
  assert.equal(g.sounds.filter((s) => s.s === 'flap').length, before + 1);
});

test('medal thresholds', () => {
  const cases = [[0, null], [9, null], [10, 'bronze'], [19, 'bronze'], [20, 'silver'], [29, 'silver'], [30, 'gold'], [39, 'gold'], [40, 'platinum'], [500, 'platinum']];
  for (const [s, m] of cases) assert.equal(FB.medalFor(s), m, 'score ' + s);
});

function trace(seed, flapEvery) {
  const g = readyGame(seed);
  press(g);
  g.tick();
  const out = [];
  for (let i = 0; i < 2000 && g.state !== 'gameover'; i++) {
    if (autopilotWantsFlap(g) || (flapEvery && i % flapEvery === 0)) press(g);
    g.tick();
    out.push(g.bird.y.toFixed(6) + ',' + g.score);
  }
  return out.join(';');
}

test('deterministic: same seed and inputs give the same run', () => {
  assert.equal(trace(11, 0), trace(11, 0));
  assert.notEqual(trace(11, 0), trace(12, 0));
});

test('frame-rate independent: identical runs at 30/60/75/120/144/240 Hz with jitter', () => {
  const runs = [];
  for (const hz of [30, 60, 75, 120, 144, 240]) {
    const g = readyGame(21);
    press(g);
    g.tick();
    const perTick = [];
    const loop = new FB.FixedLoop(
      () => {
        if (g.state === 'playing' && autopilotWantsFlap(g)) press(g);
        g.tick();
        perTick.push(g.state + ':' + g.score + ':' + g.bird.y.toFixed(6));
      },
      () => {}
    );
    const jitter = FB.createRng(hz);
    loop.frame(1000);
    for (let n = 1; n <= 20 * hz; n++) {
      loop.frame(1000 + (n * 1000) / hz + (jitter.next() - 0.5) * 2); // +/-1 ms jitter
    }
    assert.ok(Math.abs(loop.ticks - 1200) <= 1, hz + ' Hz ran ' + loop.ticks + ' ticks in 20 s');
    runs.push({ hz, perTick });
  }
  const n = Math.min(...runs.map((r) => r.perTick.length));
  const ref = runs[1].perTick.slice(0, n);
  assert.ok(ref[n - 1].startsWith('playing:') && parseInt(ref[n - 1].split(':')[1], 10) >= 10);
  for (const r of runs) assert.deepEqual(r.perTick.slice(0, n), ref, r.hz + ' Hz diverged');
});

test('60 Hz frames get exactly one tick each despite timestamp jitter', () => {
  let ticks = 0;
  const loop = new FB.FixedLoop(() => ticks++, () => {});
  const rng = FB.createRng(5);
  loop.frame(0);
  const perFrame = [];
  for (let i = 1; i <= 600; i++) {
    const before = ticks;
    loop.frame((i * 1000) / 60 + (rng.next() - 0.5) * 3); // +/-1.5 ms around vsync
    perFrame.push(ticks - before);
  }
  assert.ok(perFrame.every((n) => n === 1), 'ticks per frame: ' + [...new Set(perFrame)]);
});

test('long stalls are clamped instead of fast-forwarding the bird', () => {
  let ticks = 0;
  const loop = new FB.FixedLoop(() => ticks++, () => {});
  loop.frame(0);
  loop.frame(5000);
  assert.ok(ticks <= Math.round(C.MAX_FRAME_TIME * C.TICK_RATE));
  loop.resetClock();
  ticks = 0;
  loop.frame(9000);
  assert.equal(ticks, 0);
});

test('every generated course is passable (look-ahead autopilot, 6 seeds x 150 pipes)', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const g = readyGame(seed);
    press(g);
    g.tick();
    for (let i = 0; i < 150 * C.PIPE_SPAWN_INTERVAL + 200 && g.state === 'playing'; i++) {
      if (autopilotWantsFlap(g)) press(g);
      g.tick();
    }
    assert.equal(g.state, 'playing', 'seed ' + seed + ' died at score ' + g.score);
    assert.ok(g.score >= 150, 'seed ' + seed + ' score ' + g.score);
  }
});

test('synthesised sounds are finite, normalised and short', () => {
  for (const name of ['flap', 'point', 'hit', 'die', 'swoosh']) {
    const data = FB.SYNTHS[name](44100);
    let peak = 0;
    for (const v of data) {
      assert.ok(Number.isFinite(v));
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(peak > 0.5 && peak <= 1.0001, name + ' peak ' + peak);
    assert.ok(data.length / 44100 < 0.6, name + ' length');
  }
});
