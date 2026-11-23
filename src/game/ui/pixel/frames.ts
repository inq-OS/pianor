import { createBitmap, type Bitmap } from './bitmap';
import { C } from './palette';

/** What a panel is for; each kind has its own colours. */
export type PanelKind = 'panel' | 'button' | 'buttonHover' | 'buttonDown' | 'card' | 'cardHover' | 'locked' | 'bubble' | 'active' | 'tab';

interface Look {
  fill: number;
  light: number;
  shade: number;
  outline: number;
}

// Warm wood: a panel is the board with a line cut round it, a button a lighter block of wood, a card
// the board with honey lines; gold stays for what is switched on, cream for what Kiur says.
const LOOKS: Readonly<Record<PanelKind, Look>> = {
  panel: { fill: C.panel, light: C.panelLight, shade: C.panelDark, outline: C.groove },
  button: { fill: C.brown, light: C.brownLight, shade: C.brownDark, outline: C.groove },
  buttonHover: { fill: C.brownLight, light: C.cream, shade: C.brown, outline: C.groove },
  buttonDown: { fill: C.brownDark, light: C.brown, shade: C.brownDark, outline: C.groove },
  card: { fill: C.panel, light: C.panelLight, shade: C.panelDark, outline: C.honeyDark },
  cardHover: { fill: C.panelLit, light: C.panelLight, shade: C.panel, outline: C.honey },
  locked: { fill: C.panel, light: C.panel, shade: C.groove, outline: C.panelLight },
  bubble: { fill: C.cream, light: C.white, shade: C.goldLight, outline: C.groove },
  active: { fill: C.gold, light: C.goldLight, shade: C.goldDark, outline: C.groove },
  // the chosen tab of a row: flat (no raised light and shade lines), dark like the cards of the list below it
  tab: { fill: C.panel, light: C.panel, shade: C.panel, outline: C.honey },
};

/**
 * A rounded frame of any size: a one-pixel outline with the corners cut, a light line inside the top and left edges and a
 * dark line inside the bottom and right edges, which makes it look raised. Small enough to redraw whenever a size changes.
 */
export function panelBitmap(width: number, height: number, kind: PanelKind): Bitmap {
  if (width < 5 || height < 5) throw new Error(`a panel needs at least 5 x 5 pixels, not ${width} x ${height}`);
  const look = LOOKS[kind];
  const bitmap = createBitmap(width, height);
  const corner = (x: number, y: number) => (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (corner(x, y)) continue;
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      // the pixel next to each cut corner is also outline, so the corner looks round
      let index: number;
      if (edge) index = look.outline;
      else if (y === 1 || x === 1) index = look.light;
      else if (y === height - 2 || x === width - 2) index = look.shade;
      else index = look.fill;
      bitmap.pixels[y * width + x] = index;
    }
  }
  // round the inside corners: the light and shade lines do not reach the cut corners
  for (const [x, y] of [[1, 1], [width - 2, 1], [1, height - 2], [width - 2, height - 2]] as const) bitmap.pixels[y * width + x] = look.outline;
  return bitmap;
}

/** A plate of the action and inventory band (ft_1_20): an action's cell, an item's slot, and what each looks like under the pointer, pressed, switched on or with nothing to do. */
export type TrayKind = 'cell' | 'cellHover' | 'cellDown' | 'cellOn' | 'cellOff' | 'slot' | 'slotHover' | 'slotOn' | 'slotEmpty' | 'slotArmed';

/** `raised`: the light line lies inside the top and left edges (a plate that stands out); else inside the bottom and right (a slot cut in). */
const TRAYS: Readonly<Record<TrayKind, { fill: number; raised: boolean; corner: number }>> = {
  cell: { fill: C.panel, raised: true, corner: 0 },
  cellHover: { fill: C.panelLit, raised: true, corner: 0 },
  cellDown: { fill: C.panel, raised: false, corner: 0 },
  cellOn: { fill: C.panelLit, raised: false, corner: 0 },
  cellOff: { fill: C.panel, raised: true, corner: 0 },
  slot: { fill: C.panelLit, raised: false, corner: 0 },
  slotHover: { fill: C.panelLight, raised: false, corner: 0 },
  slotOn: { fill: C.panelLit, raised: false, corner: C.goldLight },
  slotEmpty: { fill: C.panel, raised: false, corner: 0 },
  // the item a click on the staff writes with: a purple ground, so notes or rests read at a glance
  slotArmed: { fill: C.purple, raised: false, corner: 0 },
};

/** How long each arm of a switched-on slot's corner marks is. */
const TRAY_CORNER = 3;

/**
 * A plate of the band, in the manner of the early 1990s adventure games: the band is one warm board and a plate is only
 * cut into it, a dark line all round with a lighter line beside it. The face has the board's own colour; under the
 * pointer, and in a slot that holds an item, it is a tone lighter. The last row is left clear, which is the board
 * between two rows of plates that touch. A switched-on slot has gold marks in its corners.
 */
export function trayBitmap(width: number, height: number, kind: TrayKind): Bitmap {
  if (width < 5 || height < 5) throw new Error(`a tray needs at least 5 x 5 pixels, not ${width} x ${height}`);
  const look = TRAYS[kind];
  const bitmap = createBitmap(width, height);
  const w = width, h = height - 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
      const lightLine = look.raised ? (y === 1 || x === 1) && x < w - 1 && y < h - 1 : (y === h - 2 || x === w - 2) && x > 0 && y > 0;
      bitmap.pixels[y * width + x] = corner ? C.panel : edge ? C.groove : lightLine ? C.panelLight : look.fill;
    }
  }
  if (look.corner) {
    for (let k = 0; k < TRAY_CORNER; k++) {
      for (const [x, y] of [[1 + k, 1], [1, 1 + k], [w - 2 - k, 1], [w - 2, 1 + k], [1 + k, h - 2], [1, h - 2 - k], [w - 2 - k, h - 2], [w - 2, h - 2 - k]] as const) bitmap.pixels[y * width + x] = look.corner;
    }
  }
  return bitmap;
}

/**
 * A round plate of the bubble (ft_1_20, d282): the band's tray as a disc `width` wide, the dark line all round and the
 * lighter line inside its upper left (raised) or lower right (pressed, switched on); switched on, a gold ring inside it.
 */
export function roundTrayBitmap(width: number, height: number, kind: TrayKind): Bitmap {
  const look = TRAYS[kind];
  const bitmap = createBitmap(width, height);
  const d = Math.min(width, height - 1);
  const r = d / 2;
  const ox = Math.floor((width - d) / 2);
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dx = x + 0.5 - r;
      const dy = y + 0.5 - r;
      const dist = Math.hypot(dx, dy);
      if (dist > r) continue;
      const upperLeft = dx + dy < 0;
      let colour = look.fill;
      if (dist > r - 1) colour = C.groove;
      else if (dist > r - 2) colour = look.raised === upperLeft ? C.panelLight : look.fill;
      else if (look.corner && dist > r - 3) colour = look.corner;
      bitmap.pixels[y * width + ox + x] = colour;
    }
  }
  return bitmap;
}

/** A picture in one colour: every pixel of `picture` that is not its outline (`C.ink`) becomes `colour`, the outline `outline`. For the band's action pictures, which have the letters' colour on the board. */
export function tinted(picture: Bitmap, colour: number, outline: number = C.groove): Bitmap {
  const out = createBitmap(picture.width, picture.height);
  picture.pixels.forEach((index, i) => {
    if (index !== 0) out.pixels[i] = index === C.ink ? outline : colour;
  });
  return out;
}

/** The ring drawn around the button that has the keyboard focus: two light gold pixels all round, with the corners cut. It is `width + 4` by `height + 4`, so it sits just outside the button. */
export function focusRingBitmap(width: number, height: number): Bitmap {
  const w = width + 4;
  const h = height + 4;
  const bitmap = createBitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ring = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
      const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
      if (ring && !corner) bitmap.pixels[y * w + x] = C.goldLight;
    }
  }
  return bitmap;
}

/** The three tones of a bar's fill: a light top line, the body and a dark bottom line. */
export interface BarColors {
  light: number;
  mid: number;
  dark: number;
}

export const GOLD_BAR: BarColors = { light: C.goldLight, mid: C.gold, dark: C.goldDark };
/** The player's health in a battle: mint green, so it is not mistaken for the monster's gold HP bar. */
export const HEALTH_BAR: BarColors = { light: C.white, mid: C.green, dark: C.tealDark };

/** A bar (XP, HP): a dark trough cut into the wood, with a fill of `fraction` (0 to 1), gold unless other `colors` are given. The fill never looks empty while there is any left. */
export function barBitmap(width: number, height: number, fraction: number, colors: BarColors = GOLD_BAR): Bitmap {
  if (width < 5 || height < 5) throw new Error(`a bar needs at least 5 x 5 pixels, not ${width} x ${height}`);
  const bitmap = createBitmap(width, height);
  const corner = (x: number, y: number) => (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
  const inner = width - 4;
  const clamped = Math.max(0, Math.min(1, fraction));
  const filled = clamped === 0 ? 0 : Math.max(2, Math.round(clamped * inner));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (corner(x, y)) continue;
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (edge) {
        bitmap.pixels[y * width + x] = C.groove;
        continue;
      }
      const inTrough = x >= 2 && x < width - 2 && y >= 2 && y < height - 2;
      if (!inTrough) {
        bitmap.pixels[y * width + x] = C.panelDark;
        continue;
      }
      const into = x - 2;
      if (into < filled) bitmap.pixels[y * width + x] = y === 2 ? colors.light : y >= height - 3 ? colors.dark : colors.mid;
      else bitmap.pixels[y * width + x] = C.panelDark;
    }
  }
  return bitmap;
}

/**
 * A bar written on parchment (d130): its outline drawn in ink with the corners cut, nothing in the trough (the paper
 * shows through), and the filled part hatched in red ink. The fill never looks empty while there is any left.
 */
export function inkBarBitmap(width: number, height: number, fraction: number): Bitmap {
  if (width < 5 || height < 5) throw new Error(`a bar needs at least 5 x 5 pixels, not ${width} x ${height}`);
  const bitmap = createBitmap(width, height);
  const inner = width - 4;
  const clamped = Math.max(0, Math.min(1, fraction));
  const filled = clamped === 0 ? 0 : Math.max(2, Math.round(clamped * inner));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
    const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if (corner) continue;
    if (edge) bitmap.pixels[y * width + x] = C.featherStreak;
    else if (x >= 2 && x < 2 + filled && y >= 2 && y < height - 2 && (x + y) % 3 !== 0) bitmap.pixels[y * width + x] = C.redDark;
  }
  return bitmap;
}

/** A star written on parchment (d130): its outline in ink, filled with red ink when earned and left empty when not. */
export function inkStar(star: Bitmap, earned: boolean): Bitmap {
  const out = createBitmap(star.width, star.height);
  const { width, height } = star;
  const blank = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || star.pixels[y * width + x] === 0;
  star.pixels.forEach((index, i) => {
    const x = i % width, y = Math.floor(i / width);
    // only the outline is inked: the marks inside the sprite's star are left out (they read as dots on an empty star)
    const rim = index !== 0 && (blank(x - 1, y) || blank(x + 1, y) || blank(x, y - 1) || blank(x, y + 1));
    if (rim) out.pixels[i] = C.featherStreak;
    else if (index !== 0 && earned) out.pixels[i] = C.redDark;
  });
  return out;
}

/** A cheap, repeatable scatter: the same (x, y) always gives the same number. */
function scatter(x: number, y: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

export interface SkyStar {
  x: number;
  y: number;
  color: number;
}

/**
 * The faint stars of the night sky behind the screens, always in the same places (a position's star does not depend on the
 * screen size, so a resize does not make the sky jump). A list of dots, not a full-screen picture: filling a million
 * screen pixels every frame costs a slow computer more than all the rest of a screen together.
 */
export function skyStars(width: number, height: number): SkyStar[] {
  const stars: SkyStar[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = scatter(x, y) % 900;
      if (n < 5) stars.push({ x, y, color: n === 0 ? C.panelLight : C.panel });
    }
  }
  return stars;
}

/**
 * How many art pixels a label's letters reach past the inside of its button's frame (the outline and the light and dark
 * lines, two pixels all round), on the worst side; 0 or less when they fit.
 */
export function labelOverflow(box: { x: number; y: number; width: number; height: number }, letters: { left: number; top: number; right: number; bottom: number }): number {
  return Math.max(box.x + 2 - letters.left, letters.right - (box.x + box.width - 2), box.y + 2 - letters.top, letters.bottom - (box.y + box.height - 2));
}
