// Small seedable PRNG (mulberry32) so runs are reproducible in tests.
(function (FB) {
  'use strict';

  FB.createRng = function (seed) {
    let s = seed >>> 0;
    const next = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      // Inclusive integer range.
      int(min, max) {
        return min + Math.floor(next() * (max - min + 1));
      },
    };
  };

  FB.randomSeed = function () {
    return (Math.random() * 4294967296) >>> 0;
  };
})((globalThis.FB = globalThis.FB || {}));
