// Tiny pixel-art toolkit: an RGBA pixel buffer with crisp (non antialiased)
// primitives, converted to a canvas once at start-up.
(function (FB) {
  'use strict';

  function parseColor(hex) {
    if (hex === null || hex === undefined) return 0;
    const v = parseInt(hex.slice(1), 16);
    const r = (v >> 16) & 255;
    const g = (v >> 8) & 255;
    const b = v & 255;
    // ImageData is RGBA in memory; read as little-endian uint32 that's ABGR.
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  class PixelCanvas {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.data = new Uint32Array(w * h);
    }

    set(x, y, color) {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.data[y * this.w + x] = typeof color === 'number' ? color : parseColor(color);
    }

    get(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
      return this.data[y * this.w + x];
    }

    fillRect(x, y, w, h, color) {
      const c = parseColor(color);
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    }

    // Disc of pixels whose centres fall inside radius r around (cx, cy).
    fillCircle(cx, cy, r, color) {
      const c = parseColor(color);
      for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++) {
        for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) {
          const dx = i + 0.5 - cx;
          const dy = j + 0.5 - cy;
          if (dx * dx + dy * dy <= r * r) this.set(i, j, c);
        }
      }
    }

    // Character grid -> pixels. '.' or ' ' is transparent.
    drawGrid(rows, palette, ox, oy) {
      ox = ox || 0;
      oy = oy || 0;
      for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < rows[y].length; x++) {
          const ch = rows[y][x];
          if (ch === '.' || ch === ' ') continue;
          if (!(ch in palette)) throw new Error('No palette entry for "' + ch + '"');
          this.set(ox + x, oy + y, palette[ch]);
        }
      }
    }

    // Paste another PixelCanvas (opaque pixels only).
    blit(src, ox, oy) {
      for (let y = 0; y < src.h; y++) {
        for (let x = 0; x < src.w; x++) {
          const c = src.data[y * src.w + x];
          if (c >>> 24) this.set(ox + x, oy + y, c);
        }
      }
    }

    // Recolour every opaque pixel through a map (packed -> hex) or function.
    map(fn) {
      const out = new PixelCanvas(this.w, this.h);
      for (let i = 0; i < this.data.length; i++) out.data[i] = this.data[i] ? fn(this.data[i]) : 0;
      return out;
    }

    toCanvas() {
      const c = document.createElement('canvas');
      c.width = this.w;
      c.height = this.h;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(this.w, this.h);
      new Uint32Array(img.data.buffer).set(this.data);
      ctx.putImageData(img, 0, 0);
      return c;
    }
  }

  // Boolean mask helpers used for outlined text.
  function dilate(mask, w, h, r) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++) {
          for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) out[j * w + i] = 1;
        }
      }
    }
    return out;
  }

  FB.parseColor = parseColor;
  FB.PixelCanvas = PixelCanvas;
  FB.dilateMask = dilate;
})((globalThis.FB = globalThis.FB || {}));
