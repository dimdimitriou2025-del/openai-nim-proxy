// All artwork, drawn procedurally at art resolution (half of the 288x512
// game space, i.e. every art pixel is 2x2 game pixels, matching the chunky
// grid of the original). These are original recreations, not extracted
// assets. To use authorised replacement art, return images of the same
// sizes from buildSprites() and nothing else needs to change.
(function (FB) {
  'use strict';

  const K = '#543847'; // the dark outline used throughout the original palette

  const PAL = {
    sky: '#4ec0ca',
    cloud: '#e9fcd9',
    cloudEdge: '#cdf0e3',
    city: '#d8f3d0',
    cityEdge: '#abe3b9',
    cityWindow: '#bde8c4',
    bush: '#5ee270',
    bushEdge: '#4ac35e',
    bushLight: '#82ec8a',
    grassLight: '#9ce659',
    grass: '#73bf2e',
    grassHighlight: '#e4fd8b',
    grassDark: '#558022',
    sandEdge: '#d0c874',
    sand: '#ded895',
  };

  // ---- Bird (3 wing frames, 17x12) -------------------------------------------

  const BIRD_PAL = {
    K,
    Y: '#f7c22c', // body
    O: '#ef9f2c', // belly
    W: '#ffffff', // eye and wing
    w: '#f3e7b6', // wing underside
    R: '#f7562b', // upper lip
    r: '#e0441f', // lower lip
  };

  const BIRD_FRAMES = [
    // wing up
    [
      '......KKKKKK.....',
      '....KKYYYKWWK....',
      '.KKKYYYYKWWWWK...',
      'KWWWKYYYKWWWKWK..',
      'KWWWWKYYKWWWKWK..',
      'KwWWwKYYKWWWWWK..',
      '.KwwKYYYYKKKKKKK.',
      '..KKYYYYKRRRRRRRK',
      '..KOOOOOKRKKKKKKK',
      '..KOOOOOOKrrrrrK.',
      '...KKOOOOOKKKKK..',
      '.....KKKKK.......',
    ],
    // wing level
    [
      '......KKKKKK.....',
      '....KKYYYKWWK....',
      '...KYYYYKWWWWK...',
      '..KYYYYYKWWWKWK..',
      '.KKKKYYYKWWWKWK..',
      'KWWWWKYYKWWWWWK..',
      'KWWWWWKYYKKKKKKK.',
      'KwWWWwKYKRRRRRRRK',
      '.KwwwKOOKRKKKKKKK',
      '..KKKOOOOKrrrrrK.',
      '...KKOOOOOKKKKK..',
      '.....KKKKK.......',
    ],
    // wing down
    [
      '......KKKKKK.....',
      '....KKYYYKWWK....',
      '...KYYYYKWWWWK...',
      '..KYYYYYKWWWKWK..',
      '.KYYYYYYKWWWKWK..',
      'KKKKKYYYKWWWWWK..',
      'KWWWWKYYYKKKKKKK.',
      'KWWWWWKYKRRRRRRRK',
      'KwWWWwKOKRKKKKKKK',
      '.KwwwKOOOKrrrrrK.',
      '..KKKOOOOOKKKKK..',
      '.....KKKKK.......',
    ],
  ];

  function buildBirdFrames() {
    return BIRD_FRAMES.map((rows) => {
      const pc = new FB.PixelCanvas(17, 12);
      pc.drawGrid(rows, BIRD_PAL);
      return pc;
    });
  }

  // ---- Background (static sky, clouds, city, bushes) ---------------------------

  function buildBackground() {
    const W = 144;
    const H = 256;
    const GROUND = 200; // art row where the land starts
    const pc = new FB.PixelCanvas(W, H);
    pc.fillRect(0, 0, W, H, PAL.sky);

    // Clouds: a row of overlapping puffs over a solid band.
    const cloud = new FB.PixelCanvas(W, H);
    for (let i = 0; i < 16; i++) {
      const cx = -6 + i * 10 + ((i * 7) % 4);
      const r = 7 + ((i * 5) % 4);
      cloud.fillCircle(cx, 170 + ((i * 3) % 3), r, PAL.cloud);
    }
    cloud.fillRect(0, 170, W, GROUND - 170, PAL.cloud);
    // Thin bluish rim on the top edge of the cloud bank.
    const cloudEdge = FB.parseColor(PAL.cloudEdge);
    for (let y = 1; y < GROUND; y++) {
      for (let x = 0; x < W; x++) {
        if (cloud.get(x, y) && !cloud.get(x, y - 1)) pc.set(x, y - 1, cloudEdge);
      }
    }
    pc.blit(cloud, 0, 0);

    // City skyline in front of the clouds.
    const buildings = [
      [0, 9, 176], [8, 7, 182], [14, 10, 172], [23, 6, 180], [28, 9, 168], [36, 7, 178],
      [42, 11, 174], [52, 6, 184], [57, 9, 170], [65, 8, 180], [72, 10, 175], [81, 7, 168],
      [87, 9, 179], [95, 6, 173], [100, 10, 181], [109, 8, 170], [116, 9, 177], [124, 7, 183],
      [130, 9, 172], [138, 8, 178],
    ];
    const cityEdge = FB.parseColor(PAL.cityEdge);
    const cityWin = FB.parseColor(PAL.cityWindow);
    for (const [bx, bw, top] of buildings) {
      pc.fillRect(bx, top, bw, GROUND - top, PAL.city);
      for (let x = bx; x < bx + bw; x++) pc.set(x, top, cityEdge);
      for (let y = top; y < GROUND; y++) {
        pc.set(bx, y, cityEdge);
        pc.set(bx + bw - 1, y, cityEdge);
      }
      for (let y = top + 3; y < GROUND - 2; y += 3) {
        for (let x = bx + 2; x < bx + bw - 2; x += 2) pc.set(x, y, cityWin);
      }
    }

    // Bushes along the ground line.
    const bush = new FB.PixelCanvas(W, H);
    for (let i = 0; i < 20; i++) {
      const cx = -4 + i * 8 + ((i * 5) % 3);
      const r = 5 + ((i * 3) % 3);
      bush.fillCircle(cx, 194 + ((i * 2) % 3), r, PAL.bush);
    }
    bush.fillRect(0, 194, W, GROUND - 194, PAL.bush);
    const bushEdge = FB.parseColor(PAL.bushEdge);
    const bushLight = FB.parseColor(PAL.bushLight);
    for (let y = 1; y < GROUND; y++) {
      for (let x = 0; x < W; x++) {
        if (!bush.get(x, y)) continue;
        if (!bush.get(x, y - 1)) bush.set(x, y, bushEdge);
        else if (!bush.get(x, y - 2) && x % 3 === 0) bush.set(x, y, bushLight);
      }
    }
    pc.blit(bush, 0, 0);
    return pc;
  }

  // ---- Land strip (168x56, tiles horizontally) ----------------------------------

  function buildLand() {
    const W = 168;
    const H = 56;
    const pc = new FB.PixelCanvas(W, H);
    pc.fillRect(0, 0, W, H, PAL.sand);
    pc.fillRect(0, 0, W, 1, K);
    pc.fillRect(0, 1, W, 1, PAL.grassHighlight);
    for (let y = 2; y < 7; y++) {
      for (let x = 0; x < W; x++) {
        pc.set(x, y, (x + y) % 6 < 3 ? PAL.grassLight : PAL.grass);
      }
    }
    pc.fillRect(0, 7, W, 1, PAL.grassDark);
    pc.fillRect(0, 8, W, 1, PAL.sandEdge);
    return pc;
  }

  // ---- Pipes (26x160; body 24 wide under a 26 wide lip) ------------------------

  const PIPE_PAL = { K, G: '#73bf2e', L: '#9ce659', H: '#e4fd8b', D: '#558022' };
  const PIPE_BODY = 'KLHHLGGGGGGGGGGGDGDDGDDK';
  const PIPE_LIP = 'KLHHHLGGGGGGGGGGGGDGDDGDDK';
  const LIP_ROWS = 12;

  function buildPipe(lipOnTop) {
    const W = 26;
    const H = 160;
    const pc = new FB.PixelCanvas(W, H);
    const lipY = lipOnTop ? 0 : H - LIP_ROWS;
    for (let y = 0; y < H; y++) {
      const inLip = y >= lipY && y < lipY + LIP_ROWS;
      if (inLip) {
        const edge = y === lipY || y === lipY + LIP_ROWS - 1;
        for (let x = 0; x < W; x++) pc.set(x, y, edge ? K : PIPE_PAL[PIPE_LIP[x]]);
      } else {
        for (let x = 0; x < 24; x++) pc.set(x + 1, y, PIPE_PAL[PIPE_BODY[x]]);
      }
    }
    return pc;
  }

  // ---- Text --------------------------------------------------------------------

  function titleText(str, top, bottom) {
    return FB.Font.render(str, FB.Font.DISPLAY, {
      scale: 2,
      gap: 1,
      fill: { top, bottom, split: 5 },
      borders: [
        { color: '#ffffff', size: 1 },
        { color: K, size: 1 },
      ],
    });
  }

  function digitSet(font, scale, outline) {
    const out = {};
    for (let d = 0; d <= 9; d++) {
      out[d] = FB.Font.render(String(d), font, {
        scale,
        fill: '#ffffff',
        borders: [{ color: outline, size: 1 }],
      });
    }
    return out;
  }

  function smallText(str, color, border) {
    return FB.Font.render(str, FB.Font.SMALL, {
      scale: 1,
      gap: 1,
      fill: color,
      borders: border ? [{ color: border, size: 1 }] : [],
    });
  }

  // ---- Get Ready tutorial (57x49) ---------------------------------------------

  const ARROW = ['...K...', '..KWK..', '.KWWWK.', 'KWWWWWK', 'KKKWKKK', '..KWK..', '..KWK..', '..KKK..'];
  const HAND = [
    '....KK......',
    '...KWWK.....',
    '...KWWK.....',
    '...KWWK.....',
    '...KWWKKK...',
    '...KWWKWWKK.',
    '.KKKWWKWWKWK',
    'KWWKWWWWWWWK',
    'KWWWWWWWWWWK',
    '.KWWWWWWWWWK',
    '..KWWWWWWWK.',
    '...KWWWWWWK.',
    '....KWWWWK..',
    '....KKKKKK..',
  ];

  function buildTutorial(birdFrames) {
    const pc = new FB.PixelCanvas(57, 49);
    const grey = { K: '#8a9a9a', W: '#ffffff' };
    pc.drawGrid(ARROW, grey, 25, 0);
    const ghost = birdFrames[1].map((c) =>
      c === FB.parseColor(K) ? FB.parseColor('#8a9a9a') : c === FB.parseColor('#ffffff') ? c : FB.parseColor('#dcdcdc')
    );
    pc.blit(ghost, 20, 10);
    pc.drawGrid(HAND, { K: '#7a6a5a', W: '#ffffff' }, 23, 30);
    // Tap marks around the fingertip.
    const mark = FB.parseColor('#ffffff');
    [[23, 27], [22, 29], [32, 27], [33, 29], [27, 25]].forEach(([x, y]) => pc.set(x, y, mark));
    const tap = smallText('TAP', '#f0582a', '#ffffff');
    pc.blit(tap, 4, 34);
    pc.blit(tap, 40, 34);
    return pc;
  }

  // ---- Score panel, medals, badges, button -----------------------------------------

  function roundRect(pc, x, y, w, h, r, color) {
    const c = FB.parseColor(color);
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const dx = i < x + r ? x + r - i - 0.5 : i >= x + w - r ? i - (x + w - r) + 0.5 : 0;
        const dy = j < y + r ? y + r - j - 0.5 : j >= y + h - r ? j - (y + h - r) + 0.5 : 0;
        if (dx * dx + dy * dy <= r * r) pc.set(i, j, c);
      }
    }
  }

  function buildPanel() {
    const W = 119;
    const H = 63;
    const pc = new FB.PixelCanvas(W, H);
    roundRect(pc, 0, 0, W, H, 4, K);
    roundRect(pc, 1, 1, W - 2, H - 2, 3, '#fbf5c7');
    roundRect(pc, 3, 3, W - 6, H - 6, 2, '#cfc46b');
    roundRect(pc, 4, 4, W - 8, H - 8, 2, PAL.sand);
    const label = '#e2733b';
    pc.blit(smallText('MEDAL', label), 13, 8);
    const score = smallText('SCORE', label);
    pc.blit(score, 106 - score.w, 8);
    const best = smallText('BEST', label);
    pc.blit(best, 106 - best.w, 31);
    return pc;
  }

  const MEDAL_COLORS = {
    bronze: { dark: '#9a5a25', base: '#d48b48', light: '#f2c08b' },
    silver: { dark: '#8e8e8e', base: '#cfcfcf', light: '#f7f7f7' },
    gold: { dark: '#b8860b', base: '#f4c62c', light: '#fff2a8' },
    platinum: { dark: '#9fa9b8', base: '#e3e9f1', light: '#ffffff' },
  };

  function buildMedal(colors) {
    const pc = new FB.PixelCanvas(22, 22);
    pc.fillCircle(11, 11, 11, colors.dark);
    pc.fillCircle(11, 11, 10, colors.base);
    pc.fillCircle(11, 11, 7.5, colors.dark);
    pc.fillCircle(11, 11, 6.5, colors.base);
    pc.fillCircle(8.5, 8.5, 2.5, colors.light);
    pc.fillCircle(14.5, 15.5, 1, colors.light);
    return pc;
  }

  function buildSparkles() {
    const frames = [
      ['.....', '.....', '..#..', '.....', '.....'],
      ['.....', '..#..', '.###.', '..#..', '.....'],
      ['..#..', '..#..', '#####', '..#..', '..#..'],
    ];
    return frames.map((rows) => {
      const pc = new FB.PixelCanvas(5, 5);
      pc.drawGrid(rows, { '#': '#ffffff' });
      return pc;
    });
  }

  function buildNewBadge() {
    const pc = new FB.PixelCanvas(16, 7);
    roundRect(pc, 0, 0, 16, 7, 2, '#e33b2e');
    pc.blit(smallText('NEW', '#ffffff'), 1, 1);
    return pc;
  }

  function buildPlayButton() {
    const W = 58;
    const H = 33;
    const pc = new FB.PixelCanvas(W, H);
    roundRect(pc, 0, 0, W, H, 4, K);
    roundRect(pc, 1, 1, W - 2, H - 2, 3, '#d6d6d6');
    roundRect(pc, 1, 1, W - 2, H - 5, 3, '#ffffff');
    // Green "play" triangle with dark outline, centred.
    const th = 15;
    const tw = 12;
    const tx = Math.floor((W - tw) / 2) + 1;
    const ty = Math.floor((H - 3 - th) / 2);
    const inside = (x, y) => {
      const half = (th - 1) / 2;
      const reach = (1 - Math.abs(y - half) / (half + 0.5)) * tw;
      return x >= 0 && y >= 0 && y < th && x < reach;
    };
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        pc.set(tx + x, ty + y, edge ? K : '#5bc236');
      }
    }
    return pc;
  }

  // ---- Assembly ------------------------------------------------------------------

  FB.buildSprites = function () {
    const birdPx = buildBirdFrames();
    const toC = (pc) => pc.toCanvas();
    const medals = {};
    for (const name in MEDAL_COLORS) medals[name] = toC(buildMedal(MEDAL_COLORS[name]));
    const big = digitSet(FB.Font.DIGITS_BIG, 2, '#000000');
    const small = digitSet(FB.Font.DIGITS_SMALL, 1, K);
    const mapC = (set) => {
      const out = {};
      for (const k in set) out[k] = toC(set[k]);
      return out;
    };
    return {
      background: toC(buildBackground()),
      land: toC(buildLand()),
      pipeUp: toC(buildPipe(true)),
      pipeDown: toC(buildPipe(false)),
      bird: birdPx.map(toC),
      digitsBig: mapC(big),
      digitsSmall: mapC(small),
      logo: toC(titleText('FlappyBird', '#fdd34b', '#f7a43a')),
      getReady: toC(titleText('Get Ready', '#7fd650', '#53b536')),
      gameOver: toC(titleText('Game Over', '#fcb64a', '#f58f3a')),
      tutorial: toC(buildTutorial(birdPx)),
      panel: toC(buildPanel()),
      medals,
      sparkles: buildSparkles().map(toC),
      newBadge: toC(buildNewBadge()),
      playButton: toC(buildPlayButton()),
    };
  };
})((globalThis.FB = globalThis.FB || {}));
