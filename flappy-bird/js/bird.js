// Bird: position, velocity, rotation and wing animation. Pure logic, no DOM.
//
// (x, y) is the centre of the 34x24 sprite. The previous tick's y/rotation
// are kept so the renderer can interpolate between fixed ticks.
(function (FB) {
  'use strict';

  const C = FB.CONFIG;

  class Bird {
    constructor() {
      this.reset(C.BIRD_X, C.BIRD_START_Y);
    }

    reset(x, y) {
      this.x = x;
      this.y = y;
      this.baseY = y;
      this.vel = 0;
      this.rot = 0;
      this.dead = false;
      this.bobTick = 0;
      this.animTick = 0;
      this.frame = C.WING_SEQUENCE[0];
      this.savePrev();
    }

    savePrev() {
      this.prevY = this.y;
      this.prevRot = this.rot;
    }

    // A flap sets the velocity outright (it does not add to it), which is
    // what makes every flap produce the same arc in the original.
    flap() {
      if (this.dead) return;
      this.vel = C.FLAP_VELOCITY;
      this.rot = C.ROT_FLAP;
      this.prevRot = this.rot; // snap, never sweep, to the flap angle
    }

    // Title / Get Ready hover: sine bob around baseY, wings flapping.
    updateIdle() {
      this.bobTick++;
      this.y =
        this.baseY +
        C.BOB_AMPLITUDE * Math.sin((this.bobTick / C.BOB_PERIOD_TICKS) * Math.PI * 2);
      this.rot = 0;
      this.animateWings();
    }

    updateFlying() {
      this.integrate();
      if (this.vel >= C.ROT_DIVE_START_VELOCITY) {
        this.rot = Math.min(C.ROT_MAX, this.rot + C.ROT_DIVE_SPEED);
      }
      // Wings stop beating once the bird is in a full nose dive.
      if (this.rot < C.ROT_MAX) this.animateWings();
    }

    updateDead(onGround) {
      if (!onGround) this.integrate();
      this.rot = Math.min(C.ROT_MAX, this.rot + C.ROT_DEATH_SPEED);
    }

    integrate() {
      this.vel = Math.min(C.MAX_FALL_SPEED, this.vel + C.GRAVITY);
      this.y += this.vel;
    }

    die() {
      this.dead = true;
      // No bounce: the bird drops from wherever it hit.
      if (this.vel < 0) this.vel = 0;
    }

    animateWings() {
      this.animTick++;
      const seq = C.WING_SEQUENCE;
      this.frame = seq[Math.floor(this.animTick / C.WING_FRAME_TICKS) % seq.length];
    }
  }

  FB.Bird = Bird;
})((globalThis.FB = globalThis.FB || {}));
