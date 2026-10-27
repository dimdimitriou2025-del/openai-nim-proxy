// Loads the DOM-free game modules into Node and provides test utilities.
const path = require('path');

const JS = path.resolve(__dirname, '..', 'js');
for (const f of ['config', 'rng', 'bird', 'pipes', 'collision', 'game', 'loop', 'audio']) {
  require(path.join(JS, f + '.js'));
}
const FB = globalThis.FB;
const C = FB.CONFIG;

function memoryStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

// A game already past the title fade, waiting on Get Ready.
function readyGame(seed, opts) {
  const sounds = [];
  const game = new FB.Game(
    Object.assign(
      {
        rng: FB.createRng(seed === undefined ? 1 : seed),
        cosmeticRng: FB.createRng(99),
        onSound: (s) => sounds.push({ s, tick: game.tickCount }),
      },
      opts || {}
    )
  );
  game.activatePlay();
  while (game.state !== FB.STATE.READY || game.fade) game.tick();
  game.sounds = sounds;
  return game;
}

const press = (game) => game.queueEvent({ type: 'down', kind: 'key' });

// Autopilot used to prove the generated courses are passable. Its policy
// is "flap when below the next gap's centre and not already rising fast";
// each tick it also rolls the policy forward and takes the other action if
// that survives longer. No knowledge of future (unspawned) pipes is used.
function policyFlap(bird, pipes) {
  const next = pipes.find((p) => p.x + C.PIPE_WIDTH >= bird.x - C.HITBOX_HALF_W);
  const target = next ? next.gapY + 14 : C.BIRD_START_Y;
  return bird.y > target && bird.vel > -2;
}

// Ticks survived (up to `ticks`) taking `first` now and the policy after.
function rollout(y, vel, pipes, first, ticks) {
  const bird = { x: C.BIRD_X, y, vel };
  const ps = pipes.map((p) => ({ x: p.x, gapY: p.gapY }));
  for (let t = 0; t < ticks; t++) {
    for (const p of ps) p.x -= C.WORLD_SPEED;
    if (t === 0 ? first : policyFlap(bird, ps)) bird.vel = C.FLAP_VELOCITY;
    bird.vel = Math.min(C.MAX_FALL_SPEED, bird.vel + C.GRAVITY);
    bird.y += bird.vel;
    if (FB.Collision.hitsGround(bird) || FB.Collision.hitsCeiling(bird)) return t;
    for (const p of ps) if (FB.Collision.hitsPipe(bird, p)) return t;
  }
  return ticks;
}

function autopilotWantsFlap(game) {
  const b = game.bird;
  const N = 60;
  // Decide on the pipes as they will be after this tick's scroll.
  const want = policyFlap(
    { x: b.x, y: b.y, vel: b.vel },
    game.pipes.list.map((p) => ({ x: p.x - C.WORLD_SPEED, gapY: p.gapY }))
  );
  const a = rollout(b.y, b.vel, game.pipes.list, want, N);
  if (a === N) return want;
  return rollout(b.y, b.vel, game.pipes.list, !want, N) > a ? !want : want;
}

module.exports = { FB, C, memoryStorage, readyGame, press, autopilotWantsFlap };
