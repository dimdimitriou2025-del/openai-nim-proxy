// Collision tests. The bird uses a small box around its centre (independent
// of the drawn rotation), pipes are full-width columns that extend without
// limit above and below the opening, and ground/ceiling are horizontal lines.
(function (FB) {
  'use strict';

  const C = FB.CONFIG;

  FB.Collision = {
    // Separate upper/lower tests so callers (and tests) can tell them apart.
    overlapsColumn(bird, pipe) {
      const left = bird.x - C.HITBOX_HALF_W;
      const right = bird.x + C.HITBOX_HALF_W;
      return right > pipe.x && left < pipe.x + C.PIPE_WIDTH;
    },

    hitsUpperPipe(bird, pipe) {
      return (
        this.overlapsColumn(bird, pipe) && bird.y - C.HITBOX_HALF_H < pipe.gapY - C.PIPE_GAP / 2
      );
    },

    hitsLowerPipe(bird, pipe) {
      return (
        this.overlapsColumn(bird, pipe) && bird.y + C.HITBOX_HALF_H > pipe.gapY + C.PIPE_GAP / 2
      );
    },

    hitsPipe(bird, pipe) {
      return this.hitsUpperPipe(bird, pipe) || this.hitsLowerPipe(bird, pipe);
    },

    hitsGround(bird) {
      return bird.y + C.GROUND_CONTACT >= C.GROUND_Y;
    },

    hitsCeiling(bird) {
      return C.CEILING_KILLS && bird.y - C.CEILING_CONTACT < 0;
    },
  };
})((globalThis.FB = globalThis.FB || {}));
