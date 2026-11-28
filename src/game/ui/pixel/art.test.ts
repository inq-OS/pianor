import { describe, expect, it } from 'vitest';
import { blit, createBitmap, flipX, flipY, fromAscii, inkBounds, inkCount, recolor, scale2x, toRgba } from './bitmap';
import { CAP_HEIGHT, TAIL, letterBoxOf, renderText } from './font';
import { barBitmap, focusRingBitmap, labelOverflow, panelBitmap, skyStars, type PanelKind } from './frames';
import { C, PALETTE, RAMPS, css } from './palette';
import { LOCK, SPARKLE, STAR_EMPTY, STAR_FULL } from './sprites';

const at = (b: { width: number; pixels: Uint8Array }, x: number, y: number) => b.pixels[y * b.width + x]!;

describe('palette', () => {
  it('has a colour for every index, as a six-digit colour', () => {
    for (const index of Object.values(C)) expect(PALETTE[index], String(index)).toBeDefined();
    for (let i = 1; i < PALETTE.length; i++) expect(css(i)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps text readable: the lightest text colours are far lighter than the screen background', () => {
    const luminance = (rgb: number) => 0.299 * ((rgb >> 16) & 255) + 0.587 * ((rgb >> 8) & 255) + 0.114 * (rgb & 255);
    for (const text of [C.white, C.cream, C.gold, C.dim, C.honey]) expect(luminance(PALETTE[text]!) - luminance(PALETTE[C.night]!)).toBeGreaterThan(110);
  });

  // docs/sprites.md 3.1: the ramps of the art style test
  const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const relative = (rgb: number) => 0.2126 * channel(((rgb >> 16) & 255) / 255) + 0.7152 * channel(((rgb >> 8) & 255) / 255) + 0.0722 * channel((rgb & 255) / 255);
  const contrast = (a: number, b: number) => {
    const [hi, lo] = [relative(PALETTE[a]!), relative(PALETTE[b]!)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };
  const distance = (a: number, b: number) => Math.hypot(...[16, 8, 0].map((s) => ((PALETTE[a]! >> s) & 255) - ((PALETTE[b]! >> s) & 255)));
  const mid = (ramp: readonly number[]) => ramp[ramp.length === 3 ? 1 : ramp.length - 1]!;

  it('has 79 colours (53, the sixteen of Kiur\'s feathers, d114, and the ten of the warm screens, ft_1_20), every one in at most one ramp', () => {
    expect(PALETTE.length - 1).toBe(79);
    const inRamps = Object.values(RAMPS).flat();
    expect(new Set(inRamps).size).toBe(inRamps.length);
  });

  it('lightens every ramp in order, dark to light', () => {
    for (const [name, ramp] of Object.entries(RAMPS)) {
      for (let i = 1; i < ramp.length; i++) expect(relative(PALETTE[ramp[i]!]!), `${name} shade ${i}`).toBeGreaterThan(relative(PALETTE[ramp[i - 1]!]!));
    }
  });

  // The night sky's ramps are deliberately dark (sky and sea, clouds, moon halo): they sit
  // behind the scene, not on the ink outline or the panels, so the contrast checks below do not hold for them.
  // The wood of the screens and the dusk (ft_1_20) are what the others are drawn on.
  const NIGHT_RAMPS = ['sky', 'cloud', 'moon', 'halo', 'wood', 'dusk'];

  it('sets every mid shade off from the ink outline, the stage backdrop and the ground, and from the wood of the screens', () => {
    for (const [name, ramp] of Object.entries(RAMPS)) {
      if (NIGHT_RAMPS.includes(name)) continue;
      expect(contrast(mid(ramp), C.ink), `${name} on ink`).toBeGreaterThanOrEqual(3);
      for (const behind of [C.dusk, C.duskLight, C.leaf, C.leafLight, C.night, C.panel]) {
        if (ramp.includes(behind)) continue;
        expect(distance(mid(ramp), behind), `${name} on ${behind}`).toBeGreaterThanOrEqual(60);
      }
    }
  });
});

describe('bitmap', () => {
  it('reads rows of letters through a legend, and refuses uneven rows and unknown letters', () => {
    const b = fromAscii(['.a', 'b.'], { a: 5, b: 6 });
    expect([b.width, b.height, [...b.pixels]]).toEqual([2, 2, [0, 5, 6, 0]]);
    expect(() => fromAscii(['..', '.'], {})).toThrow(/row 1/);
    expect(() => fromAscii(['x'], { a: 1 })).toThrow(/legend/);
    expect(() => fromAscii([], {})).toThrow();
  });

  it('draws one picture onto another, leaving what is transparent alone and cutting what is outside', () => {
    const target = createBitmap(3, 3);
    target.pixels.fill(9);
    blit(target, fromAscii(['a.', '.a'], { a: 4 }), 1, 1);
    expect([...target.pixels]).toEqual([9, 9, 9, 9, 4, 9, 9, 9, 4]);
    blit(target, fromAscii(['aa', 'aa'], { a: 7 }), 2, 2);
    expect(at(target, 2, 2)).toBe(7);
    blit(target, fromAscii(['a'], { a: 8 }), -1, 0);
    expect(at(target, 0, 0)).toBe(9);
  });

  it('mirrors a picture top to bottom', () => {
    const b = fromAscii(['ab', 'cd', 'ef'], { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
    expect([...flipY(b).pixels]).toEqual([5, 6, 3, 4, 1, 2]);
  });

  it('flips left to right, swaps colours, counts ink, and makes RGBA bytes', () => {
    const b = fromAscii(['ab.'], { a: C.gold, b: C.red });
    expect([...flipX(b).pixels]).toEqual([0, C.red, C.gold]);
    expect([...recolor(b, { [C.gold]: C.teal }).pixels]).toEqual([C.teal, C.red, 0]);
    expect(inkCount(b)).toBe(2);
    const rgba = toRgba(b);
    expect(rgba).toHaveLength(12);
    expect([...rgba.slice(0, 4)]).toEqual([0xff, 0xc8, 0x3d, 255]);
    expect(rgba[11]).toBe(0);
  });
});

describe('inkBounds and the letter box of a label', () => {
  it('is the box around the drawn pixels, or null for an empty picture', () => {
    expect(inkBounds(fromAscii(['....', '.#..', '..#.'], { '#': 1 }))).toEqual({ left: 1, top: 1, right: 3, bottom: 3 });
    expect(inkBounds(fromAscii(['..', '..'], {}))).toBeNull();
  });

  it('runs from the top of the capitals to the baseline (and the shadow), and takes in the tails only when a letter has one', () => {
    const plain = letterBoxOf(renderText('Click', { color: 1, shadow: 2 }));
    const tails = letterBoxOf(renderText('Free play', { color: 1, shadow: 2 }));
    expect(plain.top).toBe(0);
    expect(plain.bottom).toBe(CAP_HEIGHT + 1);
    expect(tails.bottom).toBe(CAP_HEIGHT + TAIL + 1);
  });

  it('puts a label past the frame by how far its letters reach over the two-pixel border, worst side first', () => {
    const box = { x: 10, y: 20, width: 40, height: 14 };
    expect(labelOverflow(box, { left: 12, top: 22, right: 48, bottom: 32 })).toBe(0);
    expect(labelOverflow(box, { left: 12, top: 21, right: 48, bottom: 32 })).toBe(1);
    expect(labelOverflow(box, { left: 9, top: 22, right: 48, bottom: 33 })).toBe(3);
    expect(labelOverflow(box, { left: 14, top: 24, right: 40, bottom: 30 })).toBeLessThan(0);
  });
});

describe('icons', () => {
  it('has a full and an empty star of the same size, the empty one dark', () => {
    expect([STAR_FULL.width, STAR_FULL.height]).toEqual([STAR_EMPTY.width, STAR_EMPTY.height]);
    expect(new Set(STAR_FULL.pixels).has(C.gold)).toBe(true);
    expect(new Set(STAR_EMPTY.pixels).has(C.gold)).toBe(false);
    expect([...STAR_FULL.pixels].map((p) => (p === 0 ? 0 : 1))).toEqual([...STAR_EMPTY.pixels].map((p) => (p === 0 ? 0 : 1)));
  });

  it('has a padlock and a sparkle', () => {
    expect([LOCK.width, LOCK.height]).toEqual([9, 10]);
    expect([SPARKLE.width, SPARKLE.height]).toEqual([5, 5]);
    expect(inkCount(LOCK)).toBeGreaterThan(40);
  });
});

describe('panelBitmap', () => {
  const kinds: PanelKind[] = ['panel', 'button', 'buttonHover', 'buttonDown', 'card', 'cardHover', 'locked', 'bubble', 'active'];

  it('has cut corners, an outline all round, and a raised look inside, for every kind', () => {
    for (const kind of kinds) {
      const p = panelBitmap(30, 20, kind);
      expect([p.width, p.height], kind).toEqual([30, 20]);
      for (const [x, y] of [[0, 0], [29, 0], [0, 19], [29, 19]] as const) expect(at(p, x, y), `${kind} corner`).toBe(0);
      const outline = at(p, 10, 0);
      expect(outline, kind).not.toBe(0);
      for (const [x, y] of [[10, 19], [0, 10], [29, 10]] as const) expect(at(p, x, y), `${kind} ${x},${y}`).toBe(outline);
      expect(at(p, 15, 10), kind).not.toBe(0); // filled
    }
  });

  it('draws a light line inside the top and a dark one inside the bottom, so it looks raised', () => {
    const p = panelBitmap(30, 20, 'panel');
    expect(at(p, 10, 1)).toBe(C.panelLight);
    expect(at(p, 10, 18)).toBe(C.panelDark);
    expect(at(p, 15, 10)).toBe(C.panel);
  });

  it('has no gaps in the outline and no transparent pixel inside (property over sizes)', () => {
    for (let w = 5; w <= 40; w += 7) {
      for (let h = 5; h <= 30; h += 5) {
        const p = panelBitmap(w, h, 'card');
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
            expect(at(p, x, y) === 0, `${w}x${h} at ${x},${y}`).toBe(corner);
          }
        }
      }
    }
  });

  it('refuses a size too small to hold a frame', () => {
    expect(() => panelBitmap(4, 10, 'panel')).toThrow(/5 x 5/);
  });
});

describe('barBitmap', () => {
  const gold = (b: { pixels: Uint8Array }) => [...b.pixels].filter((p) => p === C.gold || p === C.goldLight || p === C.goldDark).length;

  it('fills in proportion to the fraction', () => {
    const empty = gold(barBitmap(60, 9, 0));
    const half = gold(barBitmap(60, 9, 0.5));
    const full = gold(barBitmap(60, 9, 1));
    expect(empty).toBe(0);
    expect(half).toBe(Math.round(0.5 * 56) * 5);
    expect(full).toBe(56 * 5);
  });

  it('shows a little gold for any progress at all, and never more than full or less than empty', () => {
    expect(gold(barBitmap(60, 9, 0.001))).toBeGreaterThan(0);
    expect(gold(barBitmap(60, 9, 7))).toBe(gold(barBitmap(60, 9, 1)));
    expect(gold(barBitmap(60, 9, -3))).toBe(0);
  });

  it('has a light top and a dark bottom on the gold, and refuses a tiny size', () => {
    const b = barBitmap(60, 9, 1);
    expect(at(b, 10, 2)).toBe(C.goldLight);
    expect(at(b, 10, 6)).toBe(C.goldDark);
    expect(() => barBitmap(3, 9, 0.5)).toThrow();
  });
});

describe('skyStars', () => {
  it('is a few faint stars: the same dots in the same places every time, in dim colours', () => {
    const stars = skyStars(342, 192);
    expect(stars.length).toBeGreaterThan(100);
    expect(stars.length).toBeLessThan(0.02 * 342 * 192);
    expect(skyStars(342, 192)).toEqual(stars);
    expect(stars.every((s) => (s.color === C.panel || s.color === C.panelLight) && s.x >= 0 && s.x < 342 && s.y >= 0 && s.y < 192)).toBe(true);
  });

  it('keeps every star where it is when the screen gets bigger, so a resize does not make the sky jump', () => {
    const small = skyStars(100, 80);
    const big = skyStars(200, 160).filter((s) => s.x < 100 && s.y < 80);
    expect(big).toEqual(small);
  });
});

describe('the focus ring', () => {
  it('ft_Y_13 is an ink line outside two light gold pixels just outside the button, its corners cut and its middle empty: it shows on parchment and on night alike', () => {
    const ring = focusRingBitmap(10, 6);
    expect([ring.width, ring.height]).toEqual([16, 12]);
    const at = (x: number, y: number) => ring.pixels[y * ring.width + x];
    for (const [x, y] of [[0, 0], [15, 0], [0, 11], [15, 11]] as const) expect(at(x, y)).toBe(0);
    expect(at(1, 0)).toBe(C.ink);
    expect(at(0, 5)).toBe(C.ink);
    expect([at(1, 1), at(2, 2), at(5, 2), at(2, 5)]).toEqual([C.goldLight, C.goldLight, C.goldLight, C.goldLight]);
    expect(at(3, 3)).toBe(0); // the button shows through
    expect(inkCount(ring)).toBe(16 * 12 - 10 * 6 - 4);
  });
});

describe('scale2x', () => {
  it('ft_1_18.AC3 doubles a picture and smooths its stairs: a square only loses its corner pixels, a diagonal its steps', () => {
    const flat = scale2x(fromAscii(['aa', 'aa'], { a: C.gold }));
    expect([flat.width, flat.height]).toEqual([4, 4]);
    expect(inkCount(flat)).toBe(12);
    for (const corner of [0, 3, 12, 15]) expect(flat.pixels[corner]).toBe(0);
    const stair = scale2x(fromAscii(['a.', '.a'], { a: C.gold }));
    const plain = [C.gold, C.gold, 0, 0, C.gold, C.gold, 0, 0, 0, 0, C.gold, C.gold, 0, 0, C.gold, C.gold];
    // the two inner corners between the steps are filled in
    expect(inkCount(stair)).toBe(plain.filter(Boolean).length + 2);
    expect(stair.pixels[1 * 4 + 2]).toBe(C.gold);
    expect(stair.pixels[2 * 4 + 1]).toBe(C.gold);
  });
});
