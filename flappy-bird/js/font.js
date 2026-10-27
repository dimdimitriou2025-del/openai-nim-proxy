// Bitmap fonts, drawn from scratch in the chunky style of the original's
// lettering, plus a renderer that adds the layered borders the original
// titles use (coloured face, white rim, dark outline).
(function (FB) {
  'use strict';

  // glyph(firstRow, rows): rows start at firstRow inside the font's box.
  function glyph(firstRow, rows) {
    return { top: firstRow, rows, w: Math.max.apply(null, rows.map((r) => r.length)) };
  }

  // Display face: caps 8 rows, x-height 6, descenders to row 9.
  const DISPLAY = {
    height: 10,
    space: 3,
    glyphs: {
      G: glyph(0, ['.###.', '##.##', '##...', '##...', '##.##', '##.##', '##.##', '.####']),
      R: glyph(0, ['####.', '##.##', '##.##', '##.##', '####.', '##.##', '##.##', '##.##']),
      O: glyph(0, ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.']),
      F: glyph(0, ['#####', '##...', '##...', '####.', '##...', '##...', '##...', '##...']),
      B: glyph(0, ['####.', '##.##', '##.##', '####.', '##.##', '##.##', '##.##', '####.']),
      a: glyph(2, ['.###.', '...##', '.####', '##.##', '##.##', '.####']),
      d: glyph(0, ['...##', '...##', '.####', '##.##', '##.##', '##.##', '##.##', '.####']),
      e: glyph(2, ['.###.', '##.##', '#####', '##...', '##.##', '.###.']),
      i: glyph(0, ['##', '..', '##', '##', '##', '##', '##', '##']),
      l: glyph(0, ['##', '##', '##', '##', '##', '##', '##', '##']),
      m: glyph(2, ['#######.', '##.##.##', '##.##.##', '##.##.##', '##.##.##', '##.##.##']),
      p: glyph(2, ['####.', '##.##', '##.##', '##.##', '##.##', '####.', '##...', '##...']),
      r: glyph(2, ['##.##', '####.', '###..', '##...', '##...', '##...']),
      t: glyph(0, ['.##.', '.##.', '####', '.##.', '.##.', '.##.', '.##.', '..##']),
      v: glyph(2, ['##.##', '##.##', '##.##', '##.##', '.###.', '..#..']),
      y: glyph(2, ['##.##', '##.##', '##.##', '##.##', '##.##', '.####', '...##', '.###.']),
    },
  };

  // Large in-game score digits.
  const DIGITS_BIG = {
    height: 8,
    space: 3,
    glyphs: {
      0: glyph(0, ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.']),
      1: glyph(0, ['.##', '###', '.##', '.##', '.##', '.##', '.##', '.##']),
      2: glyph(0, ['####.', '...##', '...##', '.###.', '##...', '##...', '##...', '#####']),
      3: glyph(0, ['####.', '...##', '...##', '.###.', '...##', '...##', '...##', '####.']),
      4: glyph(0, ['##.##', '##.##', '##.##', '#####', '...##', '...##', '...##', '...##']),
      5: glyph(0, ['#####', '##...', '##...', '####.', '...##', '...##', '...##', '####.']),
      6: glyph(0, ['.###.', '##...', '##...', '####.', '##.##', '##.##', '##.##', '.###.']),
      7: glyph(0, ['#####', '...##', '...##', '..##.', '..##.', '.##..', '.##..', '.##..']),
      8: glyph(0, ['.###.', '##.##', '##.##', '.###.', '##.##', '##.##', '##.##', '.###.']),
      9: glyph(0, ['.###.', '##.##', '##.##', '##.##', '.####', '...##', '...##', '.###.']),
    },
  };

  // Score-panel digits.
  const DIGITS_SMALL = {
    height: 7,
    space: 3,
    glyphs: {
      0: glyph(0, ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.']),
      1: glyph(0, ['.##', '###', '.##', '.##', '.##', '.##', '.##']),
      2: glyph(0, ['####.', '...##', '...##', '.###.', '##...', '##...', '#####']),
      3: glyph(0, ['####.', '...##', '...##', '.###.', '...##', '...##', '####.']),
      4: glyph(0, ['##.##', '##.##', '##.##', '#####', '...##', '...##', '...##']),
      5: glyph(0, ['#####', '##...', '####.', '...##', '...##', '...##', '####.']),
      6: glyph(0, ['.###.', '##...', '####.', '##.##', '##.##', '##.##', '.###.']),
      7: glyph(0, ['#####', '...##', '..##.', '..##.', '.##..', '.##..', '.##..']),
      8: glyph(0, ['.###.', '##.##', '##.##', '.###.', '##.##', '##.##', '.###.']),
      9: glyph(0, ['.###.', '##.##', '##.##', '.####', '...##', '...##', '.###.']),
    },
  };

  // Small caps for panel labels and the tutorial.
  const SMALL = {
    height: 5,
    space: 2,
    glyphs: {
      A: glyph(0, ['.#.', '#.#', '###', '#.#', '#.#']),
      B: glyph(0, ['##.', '#.#', '##.', '#.#', '##.']),
      C: glyph(0, ['.##', '#..', '#..', '#..', '.##']),
      D: glyph(0, ['##.', '#.#', '#.#', '#.#', '##.']),
      E: glyph(0, ['###', '#..', '##.', '#..', '###']),
      L: glyph(0, ['#..', '#..', '#..', '#..', '###']),
      M: glyph(0, ['#...#', '##.##', '#.#.#', '#...#', '#...#']),
      N: glyph(0, ['#..#', '##.#', '#.##', '#..#', '#..#']),
      O: glyph(0, ['.#.', '#.#', '#.#', '#.#', '.#.']),
      P: glyph(0, ['##.', '#.#', '##.', '#..', '#..']),
      R: glyph(0, ['##.', '#.#', '##.', '#.#', '#.#']),
      S: glyph(0, ['.##', '#..', '.#.', '..#', '##.']),
      T: glyph(0, ['###', '.#.', '.#.', '.#.', '.#.']),
      W: glyph(0, ['#...#', '#...#', '#.#.#', '##.##', '#...#']),
    },
  };

  // Text -> boolean mask at art resolution. Each font pixel becomes a
  // scale x scale block; `gap` art px separate glyphs.
  function mask(str, font, scale, gap) {
    const chars = Array.from(String(str));
    let w = 0;
    chars.forEach((ch, i) => {
      const gl = font.glyphs[ch];
      w += (gl ? gl.w : font.space) * scale + (i < chars.length - 1 ? gap : 0);
    });
    const h = font.height * scale;
    const data = new Uint8Array(Math.max(1, w * h));
    const rowOf = new Int16Array(h); // font row for each art row (two-tone fills)
    for (let y = 0; y < h; y++) rowOf[y] = Math.floor(y / scale);
    let x0 = 0;
    for (const ch of chars) {
      const gl = font.glyphs[ch];
      if (!gl) {
        x0 += font.space * scale + gap;
        continue;
      }
      gl.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] !== '#') continue;
          for (let j = 0; j < scale; j++) {
            for (let i = 0; i < scale; i++) {
              data[((gl.top + ry) * scale + j) * w + x0 + rx * scale + i] = 1;
            }
          }
        }
      });
      x0 += gl.w * scale + gap;
    }
    return { w, h, data, rowOf };
  }

  // Render outlined text to a PixelCanvas.
  //   fill:      face colour, or { top, bottom, split } for a two-tone face
  //              (split = first font row drawn in the bottom colour)
  //   borders:   [{ color, size }] innermost first, sizes in art px
  function render(str, font, opts) {
    const scale = opts.scale || 1;
    const m = mask(str, font, scale, opts.gap === undefined ? scale : opts.gap);
    const borders = opts.borders || [];
    const total = borders.reduce((s, b) => s + b.size, 0);
    const W = m.w + total * 2;
    const H = m.h + total * 2;

    const base = new Uint8Array(W * H);
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) base[(y + total) * W + x + total] = m.data[y * m.w + x];
    }

    const pc = new FB.PixelCanvas(W, H);
    let grow = total;
    for (let i = borders.length - 1; i >= 0; i--) {
      const d = FB.dilateMask(base, W, H, grow);
      const c = FB.parseColor(borders[i].color);
      for (let k = 0; k < d.length; k++) if (d[k]) pc.data[k] = c;
      grow -= borders[i].size;
    }

    const fill = typeof opts.fill === 'string' ? { top: opts.fill, bottom: opts.fill, split: 99 } : opts.fill;
    const top = FB.parseColor(fill.top);
    const bottom = FB.parseColor(fill.bottom);
    for (let y = 0; y < H; y++) {
      const my = y - total;
      const c = my >= 0 && my < m.h && m.rowOf[my] >= fill.split ? bottom : top;
      for (let x = 0; x < W; x++) if (base[y * W + x]) pc.data[y * W + x] = c;
    }
    return pc;
  }

  FB.Font = { DISPLAY, DIGITS_BIG, DIGITS_SMALL, SMALL, mask, render };
})((globalThis.FB = globalThis.FB || {}));
