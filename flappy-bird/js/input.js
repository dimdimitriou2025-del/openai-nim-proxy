// Mouse, touch, pen and keyboard input -> game events in game coordinates.
// Taps anywhere on the page count (the letterbox is part of the "screen"),
// and page gestures (scroll, zoom, context menu) are suppressed.
(function (FB) {
  'use strict';

  const C = FB.CONFIG;
  const ACTION_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter', 'NumpadEnter']);

  class Input {
    // handlers: { event(e), gesture(), mute() }
    constructor(canvas, handlers) {
      this.canvas = canvas;
      this.h = handlers;
      this.listeners = [];

      this.on(window, 'pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        this.h.gesture();
        const p = this.toGame(e);
        this.h.event({ type: 'down', kind: 'pointer', x: p.x, y: p.y });
      });
      const up = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.h.gesture(); // iOS only unlocks audio on touchend-like events
        const p = this.toGame(e);
        this.h.event({ type: 'up', kind: 'pointer', x: p.x, y: p.y });
      };
      this.on(window, 'pointerup', up);
      this.on(window, 'pointercancel', (e) => {
        // A cancelled touch must not activate a button.
        this.h.event({ type: 'up', kind: 'pointer', x: -1, y: -1 });
        e.preventDefault();
      });

      this.on(window, 'keydown', (e) => {
        if (e.code === 'KeyM' && !e.repeat) {
          this.h.mute();
          return;
        }
        if (!ACTION_KEYS.has(e.code)) return;
        e.preventDefault(); // no page scrolling on Space / arrows
        if (e.repeat) return; // holding a key is one flap, not many
        this.h.gesture();
        this.h.event({ type: 'down', kind: 'key' });
      });
      this.on(window, 'keyup', (e) => {
        if (ACTION_KEYS.has(e.code)) this.h.event({ type: 'up', kind: 'key' });
      });

      const block = (e) => e.preventDefault();
      const opts = { passive: false };
      this.on(document, 'touchstart', block, opts);
      this.on(document, 'touchmove', block, opts);
      this.on(document, 'touchend', block, opts);
      this.on(document, 'gesturestart', block, opts);
      this.on(document, 'dblclick', block, opts);
      this.on(document, 'contextmenu', block, opts);
    }

    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      this.listeners.push([target, type, fn, opts]);
    }

    toGame(e) {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * C.WIDTH,
        y: ((e.clientY - r.top) / r.height) * C.HEIGHT,
      };
    }

    destroy() {
      for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
      this.listeners = [];
    }
  }

  FB.Input = Input;
})((globalThis.FB = globalThis.FB || {}));
