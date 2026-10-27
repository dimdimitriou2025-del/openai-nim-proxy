// Drives the real page through every state and saves screenshots.
//   node tests/screens.js [outDir]
// Uses manual stepping (FB.app.manual) so each shot is deterministic.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'screenshots'));
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 288, height: 512 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.FB && FB.app);
  await page.evaluate(() => {
    FB.app.manual = true;
    // Fixed seeds so the pipe layout is the same every run.
    FB.app.game.rng = FB.createRng(7);
    FB.app.game.pipes.rng = FB.app.game.rng;
  });
  const shot = (name) => page.screenshot({ path: path.join(outDir, name + '.png') });
  const step = (n) => page.evaluate((n) => FB.app.step(n), n);
  const key = () => page.evaluate(() => FB.app.game.queueEvent({ type: 'down', kind: 'key' }));

  await step(20);
  await shot('1-title');

  await key();
  await step(40);
  await shot('2-ready');

  // Simple autopilot: flap when below the next gap's centre and falling.
  const autopilot = (ticks, aim) =>
    page.evaluate(
      ({ ticks, aim }) => {
        const g = FB.app.game;
        for (let i = 0; i < ticks && g.state === 'playing'; i++) {
          const p = g.pipes.list.find((p) => p.x + 52 >= g.bird.x - 7);
          const target = p ? p.gapY + aim : 256;
          if (g.bird.y > target && g.bird.vel >= 0) g.queueEvent({ type: 'down', kind: 'key' });
          g.tick();
        }
        FB.app.renderer.draw(g, 0);
        return { state: g.state, score: g.score };
      },
      { ticks, aim }
    );

  await key();
  await step(1);
  await autopilot(3, 18);
  await shot('3-start');
  let r = await autopilot(330, 18);
  await shot('4-playing');
  console.log('after play', r);

  // Fly into a pipe to die.
  await page.evaluate(() => {
    const g = FB.app.game;
    for (let i = 0; i < 400 && g.state === 'playing'; i++) g.tick();
  });
  await step(2);
  await shot('5-hit');
  await page.evaluate(() => {
    const g = FB.app.game;
    for (let i = 0; i < 300 && g.state === 'dying'; i++) g.tick();
    FB.app.renderer.draw(g, 0);
  });
  await shot('6-landed');
  await step(45);
  await shot('7-panel-sliding');
  await step(80);
  await shot('8-gameover');

  // A medal-winning run (score forced) to show medal, glint and NEW badge.
  await page.evaluate(() => {
    const g = FB.app.game;
    g.activatePlay();
    while (g.state !== 'ready' || g.fade) g.tick();
    g.queueEvent({ type: 'down', kind: 'key' });
    g.tick();
    g.score = 42;
    g.bird.y = 999;
    for (let i = 0; i < 160; i++) g.tick();
    FB.app.renderer.draw(g, 0);
  });
  await shot('9-medal');

  console.log('state', await page.evaluate(() => FB.app.game.state), 'errors', errors);
  await browser.close();
})();
