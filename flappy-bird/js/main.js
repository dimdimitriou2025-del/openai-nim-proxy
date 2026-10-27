// Boot: build art, wire input/audio/render to the game and run the loop.
(function (FB) {
  'use strict';

  function safeStorage() {
    try {
      const s = window.localStorage;
      const k = '__fb_probe__';
      s.setItem(k, '1');
      s.removeItem(k);
      return s;
    } catch (e) {
      return null;
    }
  }

  const canvas = document.getElementById('game');
  const storage = safeStorage();
  const sound = new FB.Sound(storage);
  const game = new FB.Game({ storage, onSound: (name) => sound.play(name) });
  const renderer = new FB.Renderer(canvas, FB.buildSprites());
  renderer.debug = /[?&]debug\b/.test(location.search);
  const loop = new FB.FixedLoop(
    () => game.tick(),
    (alpha) => renderer.draw(game, alpha)
  );

  const input = new FB.Input(canvas, {
    event: (e) => game.queueEvent(e),
    gesture: () => sound.unlock(),
    mute: () => sound.toggleMute(),
  });

  function resize() {
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    renderer.resize(w, h, window.devicePixelRatio || 1);
    renderer.draw(game, 0);
  }
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  // Re-run when the pixel ratio changes (browser zoom, moving between monitors).
  (function watchDpr() {
    const mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    const onChange = () => {
      resize();
      watchDpr();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange, { once: true });
  })();
  resize();

  // Hidden tabs get no frames; don't fast-forward the bird when we return.
  document.addEventListener('visibilitychange', () => loop.resetClock());

  const app = { game, loop, renderer, sound, input, manual: false };
  function frame(now) {
    if (!app.manual) loop.frame(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Handle for debugging and the browser tests: with app.manual set, the
  // real-time loop stops and step(n) advances exactly n ticks.
  app.step = function (n) {
    for (let i = 0; i < n; i++) game.tick();
    renderer.draw(game, 0);
  };
  FB.app = app;
})(globalThis.FB);
