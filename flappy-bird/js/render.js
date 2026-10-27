// Canvas renderer. Draws the game in 288x512 logical units scaled to the
// display, nearest-neighbour, interpolating moving objects between fixed
// simulation ticks so motion stays smooth at any refresh rate.
(function (FB) {
  'use strict';

  const C = FB.CONFIG;
  const L = C.LAYOUT;
  const S = C.ART_SCALE;
  const STATE = FB.STATE;

  const lerp = (a, b, t) => a + (b - a) * t;

  class Renderer {
    constructor(canvas, sprites) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.sp = sprites;
      this.k = 1; // device px per game px
    }

    // Fit the 9:16 game into the viewport, crisp at the device pixel ratio.
    resize(viewW, viewH, dpr) {
      const scale = Math.min(viewW / C.WIDTH, viewH / C.HEIGHT);
      const cssW = Math.floor(C.WIDTH * scale);
      const cssH = Math.floor(C.HEIGHT * scale);
      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
      this.canvas.width = Math.max(1, Math.round(cssW * dpr));
      this.canvas.height = Math.max(1, Math.round(cssH * dpr));
      this.k = this.canvas.width / C.WIDTH;
    }

    snap(v) {
      return Math.round(v * this.k) / this.k;
    }

    // Draw an art-resolution image at game coordinates (top-left).
    img(image, x, y, alpha) {
      const ctx = this.ctx;
      if (alpha !== undefined) {
        if (alpha <= 0) return;
        ctx.globalAlpha = Math.min(1, alpha);
      }
      ctx.drawImage(image, this.snap(x), this.snap(y), image.width * S, image.height * S);
      ctx.globalAlpha = 1;
    }

    // Same, positioned by its centre.
    imgCentered(image, cx, cy, alpha) {
      this.img(image, cx - (image.width * S) / 2, cy - (image.height * S) / 2, alpha);
    }

    draw(game, alpha) {
      const ctx = this.ctx;
      const sp = this.sp;
      ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
      ctx.imageSmoothingEnabled = false;

      this.img(sp.background, 0, 0);

      for (const p of game.pipes.list) {
        const x = lerp(p.prevX, p.x, alpha);
        this.img(sp.pipeDown, x, p.gapY - C.PIPE_GAP / 2 - C.PIPE_HEIGHT);
        this.img(sp.pipeUp, x, p.gapY + C.PIPE_GAP / 2);
      }

      const scroll = lerp(game.prevScroll, game.scroll, alpha);
      const landX = -(scroll % C.LAND_WIDTH);
      this.img(sp.land, landX, C.GROUND_Y);
      this.img(sp.land, landX + C.LAND_WIDTH, C.GROUND_Y);

      this.drawBird(game.bird, alpha);

      switch (game.state) {
        case STATE.TITLE:
          this.imgCentered(sp.logo, C.WIDTH / 2, L.TITLE_LOGO_Y);
          this.drawButton(game.playButton);
          break;
        case STATE.READY:
        case STATE.PLAYING: {
          const a = game.readyAlpha;
          if (a > 0) {
            this.imgCentered(sp.getReady, C.WIDTH / 2, L.READY_TEXT_Y, a);
            this.imgCentered(sp.tutorial, C.WIDTH / 2, L.TUTORIAL_Y, a);
          }
          break;
        }
        case STATE.GAMEOVER:
          this.drawGameOver(game, alpha);
          break;
      }

      if (game.showScore) this.drawNumber(sp.digitsBig, game.score, C.WIDTH / 2, L.SCORE_TOP, 'center');

      if (game.flash > 0) {
        const k = game.flash / C.FLASH_TICKS;
        ctx.globalAlpha = k * k;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
        ctx.globalAlpha = 1;
      }

      const fade = game.fadeAlpha;
      if (fade > 0) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
        ctx.globalAlpha = 1;
      }

      if (this.debug) this.drawHitboxes(game);
    }

    // ?debug overlay: the exact boxes the collision code tests.
    drawHitboxes(game) {
      const ctx = this.ctx;
      ctx.lineWidth = 1 / this.k;
      ctx.strokeStyle = '#ff00ff';
      const b = game.bird;
      ctx.strokeRect(b.x - C.HITBOX_HALF_W, b.y - C.HITBOX_HALF_H, C.HITBOX_HALF_W * 2, C.HITBOX_HALF_H * 2);
      ctx.strokeStyle = '#ff0000';
      for (const p of game.pipes.list) {
        ctx.strokeRect(p.x, -1000, C.PIPE_WIDTH, p.gapY - C.PIPE_GAP / 2 + 1000);
        ctx.strokeRect(p.x, p.gapY + C.PIPE_GAP / 2, C.PIPE_WIDTH, 1000);
      }
      ctx.beginPath();
      ctx.moveTo(0, C.GROUND_Y);
      ctx.lineTo(C.WIDTH, C.GROUND_Y);
      ctx.stroke();
    }

    drawBird(bird, alpha) {
      const ctx = this.ctx;
      const image = this.sp.bird[bird.frame];
      const y = lerp(bird.prevY, bird.y, alpha);
      const rot = lerp(bird.prevRot, bird.rot, alpha);
      const w = image.width * S;
      const h = image.height * S;
      ctx.save();
      ctx.translate(this.snap(bird.x), this.snap(y));
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(image, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    drawButton(b) {
      const offset = b.pressed ? L.BUTTON_PRESS_OFFSET : 0;
      this.img(this.sp.playButton, b.x, b.y + offset);
    }

    // Digits are drawn from separate images; their outlines overlap by one
    // art pixel so neighbouring digits share a border.
    numberWidth(set, n) {
      let w = 0;
      const s = String(n);
      for (const ch of s) w += set[ch].width * S;
      return w - (s.length - 1) * S;
    }

    drawNumber(set, n, x, top, align) {
      const s = String(n);
      const total = this.numberWidth(set, n);
      let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
      for (const ch of s) {
        this.img(set[ch], cx, top);
        cx += set[ch].width * S - S;
      }
    }

    drawGameOver(game, alpha) {
      const sp = this.sp;
      const go = game.go;
      const t = go.t + alpha;

      const k = Math.min(1, t / C.GAMEOVER_TEXT_TICKS);
      const drop = C.GAMEOVER_TEXT_DROP * (1 - k) * (1 - k);
      this.imgCentered(sp.gameOver, C.WIDTH / 2, L.GAMEOVER_TEXT_Y - drop, k);

      if (t < go.panelStart) return;
      const pk = Math.min(1, (t - go.panelStart) / C.PANEL_SLIDE_TICKS);
      const eased = 1 - Math.pow(1 - pk, 3);
      const ph = sp.panel.height * S;
      const pw = sp.panel.width * S;
      const py = lerp(C.HEIGHT + ph / 2, L.PANEL_Y, eased) - ph / 2;
      const px = C.WIDTH / 2 - pw / 2;
      this.img(sp.panel, px, py);

      // Panel contents, in game px relative to the panel's top-left.
      this.drawNumber(sp.digitsSmall, game.displayScore, px + 214, py + 32, 'right');
      this.drawNumber(sp.digitsSmall, game.best, px + 214, py + 78, 'right');

      if (go.t >= go.countEnd) {
        if (go.medal) {
          const mx = px + 26 + 22;
          const my = py + 42 + 22;
          this.imgCentered(sp.medals[go.medal], mx, my);
          if (go.sparkle) {
            // Glint grows and shrinks: small, medium, large, medium, small.
            const life = Math.min(0.999, go.sparkle.age / C.SPARKLE_TICKS);
            const frame = [0, 1, 2, 1, 0][Math.floor(life * 5)];
            this.imgCentered(sp.sparkles[frame], mx + go.sparkle.dx, my + go.sparkle.dy);
          }
        }
        if (go.newBest) {
          const bw = this.numberWidth(sp.digitsSmall, game.best);
          this.img(sp.newBadge, px + 214 - bw - sp.newBadge.width * S - 6, py + 80);
        }
      }

      if (game.buttonVisible) this.drawButton(game.playButton);
    }
  }

  FB.Renderer = Renderer;
})((globalThis.FB = globalThis.FB || {}));
