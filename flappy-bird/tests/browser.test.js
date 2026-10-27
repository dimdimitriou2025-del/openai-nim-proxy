// Real-browser tests with Playwright's bundled Chromium:
//   node --test tests/browser.test.js
// Covers real mouse/keyboard/touch input, the real-time loop, scaling,
// audio unlocking and the full ready -> play -> game over -> restart cycle.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let browser;

test.before(async () => {
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
});
test.after(async () => {
  await browser.close();
});

async function open(contextOpts) {
  const context = await browser.newContext(
    Object.assign({ viewport: { width: 400, height: 700 }, deviceScaleFactor: 2 }, contextOpts || {})
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForFunction(() => window.FB && FB.app);
  // Record every sound the game asks for.
  await page.evaluate(() => {
    window.__sounds = [];
    const play = FB.app.sound.play.bind(FB.app.sound);
    FB.app.sound.play = (n) => {
      window.__sounds.push(n);
      play(n);
    };
    FB.app.game.onSound = (n) => FB.app.sound.play(n);
  });
  return { context, page, errors };
}

// Page coordinates of a point given in game px.
async function toPage(page, gx, gy) {
  const box = await page.locator('#game').boundingBox();
  return { x: box.x + (gx / 288) * box.width, y: box.y + (gy / 512) * box.height };
}

async function playButtonCentre(page) {
  const b = await page.evaluate(() => FB.app.game.playButton);
  return toPage(page, b.x + b.w / 2, b.y + b.h / 2);
}

const state = (page) => page.evaluate(() => FB.app.game.state);
const waitState = (page, s, timeout) =>
  page.waitForFunction((s) => FB.app.game.state === s && !FB.app.game.fade, s, { timeout: timeout || 5000 });

test('loads cleanly, title screen, 9:16 canvas fitted to the window', async () => {
  const { context, page, errors } = await open();
  assert.equal(await state(page), 'title');
  const box = await page.locator('#game').boundingBox();
  assert.ok(Math.abs(box.width / box.height - 288 / 512) < 0.01);
  assert.ok(box.width <= 400 && box.height <= 700);
  assert.ok(Math.round(box.height) === 700 || Math.round(box.width) === 400, 'fills one dimension');
  const backing = await page.evaluate(() => [game.width, game.height]);
  assert.ok(Math.abs(backing[0] - box.width * 2) <= 2, 'backing store uses devicePixelRatio');
  assert.deepEqual(errors, []);
  await context.close();
});

test('real-time loop runs at 60 ticks per second', async () => {
  const { context, page } = await open();
  const t0 = await page.evaluate(() => FB.app.game.tickCount);
  await page.waitForTimeout(1000);
  const t1 = await page.evaluate(() => FB.app.game.tickCount);
  assert.ok(t1 - t0 >= 52 && t1 - t0 <= 68, 'ticks in 1 s: ' + (t1 - t0));
  await context.close();
});

test('mouse: tapping off the button does nothing, clicking PLAY reaches Get Ready', async () => {
  const { context, page } = await open();
  const off = await toPage(page, 144, 60);
  await page.mouse.click(off.x, off.y);
  await page.waitForTimeout(400);
  assert.equal(await state(page), 'title');
  const p = await playButtonCentre(page);
  await page.mouse.click(p.x, p.y);
  await waitState(page, 'ready');
  assert.ok((await page.evaluate(() => window.__sounds)).includes('swoosh'));
  // A click starts the run with an immediate flap.
  await page.mouse.click(off.x, off.y);
  await page.waitForTimeout(50);
  const s = await page.evaluate(() => ({ st: FB.app.game.state, vel: FB.app.game.bird.vel }));
  assert.equal(s.st, 'playing');
  assert.ok(s.vel < 0, 'rising after the first tap');
  assert.ok((await page.evaluate(() => window.__sounds)).includes('flap'));
  await context.close();
});

test('keyboard: Space starts and flaps, held key is one flap, page never scrolls', async () => {
  const { context, page } = await open();
  await page.keyboard.press('Space');
  await waitState(page, 'ready');
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  const flaps = await page.evaluate(() => window.__sounds.filter((s) => s === 'flap').length);
  assert.equal(flaps, 1, 'auto-repeat does not flap');
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__sounds.filter((s) => s === 'flap').length), 2);
  await context.close();
});

test('touch: taps flap on a phone viewport, no scrolling or zooming', async () => {
  const { context, page, errors } = await open({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const box = await page.locator('#game').boundingBox();
  assert.ok(Math.abs(box.width - 390) < 1, 'portrait phone: full width');
  const p = await playButtonCentre(page);
  await page.touchscreen.tap(p.x, p.y);
  await waitState(page, 'ready');
  await page.touchscreen.tap(195, 300);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(195, 300);
  await page.waitForTimeout(80);
  assert.equal(await state(page), 'playing');
  assert.equal(await page.evaluate(() => window.__sounds.filter((s) => s === 'flap').length), 2);
  const vp = await page.evaluate(() => ({ y: window.scrollY, scale: window.visualViewport.scale }));
  assert.deepEqual(vp, { y: 0, scale: 1 });
  assert.deepEqual(errors, []);
  await context.close();
});

test('resizing keeps the 9:16 frame and crisp backing store', async () => {
  const { context, page } = await open();
  for (const [w, h] of [[1920, 1080], [800, 1200], [320, 480], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(50);
    const box = await page.locator('#game').boundingBox();
    assert.ok(Math.abs(box.width / box.height - 288 / 512) < 0.01, w + 'x' + h);
    assert.ok(box.width <= w + 0.5 && box.height <= h + 0.5);
    assert.ok(box.x >= -0.5 && box.y >= -0.5, 'centred, not clipped');
    const k = await page.evaluate(() => FB.app.renderer.k);
    assert.ok(Math.abs(k - (box.width * 2) / 288) < 0.05);
  }
  await context.close();
});

test('audio unlocks on the first gesture and every cue fires during a run', async () => {
  const { context, page } = await open();
  assert.equal(await page.evaluate(() => FB.app.sound.ctx), null, 'no audio before a gesture');
  await page.keyboard.press('Enter');
  const st = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 100));
    return FB.app.sound.ctx.state;
  });
  assert.equal(st, 'running');
  await waitState(page, 'ready');
  // Fly a few pipes with the game's own physics, then crash.
  await page.evaluate(() => {
    FB.app.manual = true;
    const g = FB.app.game;
    g.queueEvent({ type: 'down', kind: 'key' });
    g.tick();
    for (let i = 0; i < 2000 && g.state === 'playing'; i++) {
      for (const p of g.pipes.list) p.gapY = 250;
      if (g.score < 2 && g.bird.y > 262 && g.bird.vel > 0) g.queueEvent({ type: 'down', kind: 'key' });
      g.tick();
    }
    for (let i = 0; i < 400; i++) g.tick();
    FB.app.manual = false;
  });
  const sounds = await page.evaluate(() => window.__sounds);
  for (const s of ['swoosh', 'flap', 'point', 'hit']) assert.ok(sounds.includes(s), s + ' in ' + sounds);
  assert.equal(await page.evaluate(() => Object.keys(FB.app.sound.buffers).sort().join()), 'die,flap,hit,point,swoosh');
  // M toggles mute.
  await page.keyboard.press('KeyM');
  assert.equal(await page.evaluate(() => FB.app.sound.master.gain.value), 0);
  await page.keyboard.press('KeyM');
  assert.equal(await page.evaluate(() => FB.app.sound.master.gain.value), 1);
  await context.close();
});

test('full cycle with real input: crash, game over, PLAY restarts cleanly', async () => {
  const { context, page, errors } = await open();
  const p = await playButtonCentre(page);
  await page.mouse.click(p.x, p.y);
  await waitState(page, 'ready');
  const tap = await toPage(page, 144, 200);
  await page.mouse.click(tap.x, tap.y); // one flap, then fall into the ground
  await page.waitForFunction(() => FB.app.game.state === 'gameover', null, { timeout: 5000 });
  // Clicking PLAY while the panel is still animating does nothing.
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => !!FB.app.game.fade), false);
  await page.waitForFunction(() => FB.app.game.buttonVisible, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  await page.mouse.click(p.x, p.y);
  await waitState(page, 'ready');
  const s = await page.evaluate(() => {
    const g = FB.app.game;
    return { score: g.score, pipes: g.pipes.list.length, dead: g.bird.dead, go: g.go, flash: g.flash };
  });
  assert.deepEqual(s, { score: 0, pipes: 0, dead: false, go: null, flash: 0 });
  assert.deepEqual(errors, []);
  await context.close();
});

test('best score survives a reload', async () => {
  const { context, page } = await open();
  await page.evaluate(() => {
    FB.app.manual = true;
    const g = FB.app.game;
    g.activatePlay();
    while (g.state !== 'ready' || g.fade) g.tick();
    g.queueEvent({ type: 'down', kind: 'key' });
    g.tick();
    g.score = 17;
    g.bird.y = 999;
    for (let i = 0; i < 5; i++) g.tick();
  });
  assert.equal(await page.evaluate(() => FB.app.game.best), 17);
  await page.reload();
  await page.waitForFunction(() => window.FB && FB.app);
  assert.equal(await page.evaluate(() => FB.app.game.best), 17);
  await context.close();
});
