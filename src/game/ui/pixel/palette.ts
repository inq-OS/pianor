/**
 * The colours of the pixel-art look: 79, original to this project. Bitmaps store an index into this list
 * (0 is "nothing"), so the whole look can be changed here in one place. Colours that belong together are grouped into
 * ramps of shades (`RAMPS`, dark to light, docs/sprites.md 3.1); the ramps from purple on came with the art style test,
 * the last sixteen are the feathers of Kiur, a tree pipit (d114).
 */
export const C = {
  clear: 0,
  ink: 1, // outlines and the deepest shadow
  night: 2, // screen background: a dark, warm brown
  panel: 3, // the board a panel, a card and the band are made of: walnut in shade
  panelLight: 4, // the lighter line beside a cut line
  panelDark: 5,
  blue: 6,
  blueLight: 7,
  blueDark: 8,
  gold: 9,
  goldLight: 10,
  goldDark: 11,
  teal: 12,
  tealDark: 13,
  cream: 14,
  white: 15,
  pink: 16,
  red: 17,
  green: 18,
  dim: 19, // secondary text: pale, warm
  lock: 20, // locked and empty things
  purpleDark: 21,
  purple: 22,
  purpleLight: 23,
  leafDark: 24,
  leaf: 25, // the battle stage's ground
  leafLight: 26,
  orangeDark: 27,
  orange: 28,
  orangeLight: 29,
  redDark: 30,
  redLight: 31, // the mid shade is `red`
  pinkDark: 32,
  pinkLight: 33, // the mid shade is `pink`
  brownDark: 34, // brown and skin are for people, paths and trees
  brown: 35,
  brownLight: 36,
  skinShade: 37,
  skin: 38,
  // the night sky: sky and sea, clouds, moon and its halo
  skyDeep: 39,
  skyDark: 40,
  sky: 41,
  skyLight: 42,
  cloudInk: 43, // the clouds' outline and deepest shade
  cloudDark: 44,
  cloud: 45,
  cloudLight: 46,
  cloudPale: 47,
  moonDark: 48,
  moon: 49,
  moonLight: 50,
  haloDark: 51,
  halo: 52,
  haloLight: 53,
  // Kiur's feathers (d114): the browns of a tree pipit's back, the buff of its breast, the white of its belly, the pink of its legs
  featherInk: 54, // his outline on the shade side: a dark violet brown, softer than `ink`
  featherStreak: 55, // the streaks on his crown, back and breast
  umberDeep: 56,
  umberDark: 57,
  umber: 58,
  umberLight: 59,
  buffDeep: 60,
  buffDark: 61,
  buff: 62,
  buffLight: 63,
  downShade: 64,
  down: 65,
  downLight: 66,
  legDark: 67,
  leg: 68,
  legLight: 69,
  // the warm wood of the screens and the band (ft_1_20), with `night` and the three `panel` tones: the line cut round a
  // panel, a face under the pointer, and the letters on wood
  groove: 70,
  panelLit: 71,
  honey: 72,
  honeyDark: 73,
  // the dusk behind the battle stage and in the room's shadows: what `night` and the panels were until the screens went warm
  duskDeep: 74,
  duskDark: 75,
  dusk: 76,
  duskLight: 77,
  // steel, a wig, steam: the grey that `dim` and `lock` were, kept as a paint
  silverDark: 78,
  silver: 79,
} as const;

/** Index to 0xRRGGBB. Index 0 is never drawn. */
export const PALETTE: readonly number[] = [
  0x000000, // clear
  0x14142a, // ink
  0x2b1e17, // night
  0x4b3625, // panel
  0x6d5136, // panelLight
  0x35261b, // panelDark
  0x2b6cff, // blue
  0x7aa5ff, // blueLight
  0x1a47b8, // blueDark
  0xffc83d, // gold
  0xffe58a, // goldLight
  0xc98a12, // goldDark
  0x37c6b6, // teal
  0x1f8f8a, // tealDark
  0xfdf0c8, // cream
  0xffffff, // white
  0xff8fa3, // pink
  0xd7263d, // red
  0x7dffa0, // green
  0xcdb894, // dim
  0x6a5440, // lock
  0x4b2a8c, // purpleDark
  0x7b4fd6, // purple
  0xb795ff, // purpleLight
  0x1f7a3f, // leafDark
  0x3fb55a, // leaf
  0x9be36a, // leafLight
  0xb3501b, // orangeDark
  0xf2862e, // orange
  0xffbe73, // orangeLight
  0x8e1830, // redDark
  0xff6b6b, // redLight
  0xc2507a, // pinkDark
  0xffc4d0, // pinkLight
  0x5c3a21, // brownDark
  0x8f5e34, // brown
  0xc98f5a, // brownLight
  0xd8946a, // skinShade
  0xf5c39b, // skin
  0x061418, // skyDeep
  0x08191d, // skyDark
  0x0c2328, // sky
  0x103036, // skyLight
  0x0a2a2e, // cloudInk
  0x17505a, // cloudDark
  0x237a80, // cloud
  0x3aa8a6, // cloudLight
  0x7fd8c8, // cloudPale
  0x8fa048, // moonDark
  0xb8c860, // moon
  0xd9e68a, // moonLight
  0x153c3a, // haloDark
  0x1d4e46, // halo
  0x2a6550, // haloLight
  0x2b1d2b, // featherInk
  0x3a2726, // featherStreak
  0x3f2b2e, // umberDeep
  0x5f4631, // umberDark
  0x82663b, // umber
  0xa4884d, // umberLight
  0x9b7046, // buffDeep
  0xc79a5a, // buffDark
  0xe3c07d, // buff
  0xf2dca4, // buffLight
  0xdcd3cf, // downShade
  0xf5eedc, // down
  0xfffcf2, // downLight
  0xa2524f, // legDark
  0xdd8b7c, // leg
  0xf5b6a4, // legLight
  0x1e1410, // groove
  0x644a30, // panelLit
  0xdcbc82, // honey
  0x8a6c44, // honeyDark
  0x1b1b2f, // duskDeep
  0x232339, // duskDark
  0x2d2d4a, // dusk
  0x4a4a7a, // duskLight
  0x4a4a6a, // silverDark
  0xb8b8d0, // silver
];

/** The shade ramps, dark to light. A three-shade ramp has its mid shade in the middle; skin has two. Kiur's umber and buff have four. */
export const RAMPS: Readonly<Record<string, readonly number[]>> = {
  blue: [C.blueDark, C.blue, C.blueLight],
  gold: [C.goldDark, C.gold, C.goldLight],
  purple: [C.purpleDark, C.purple, C.purpleLight],
  leaf: [C.leafDark, C.leaf, C.leafLight],
  orange: [C.orangeDark, C.orange, C.orangeLight],
  red: [C.redDark, C.red, C.redLight],
  pink: [C.pinkDark, C.pink, C.pinkLight],
  brown: [C.brownDark, C.brown, C.brownLight],
  skin: [C.skinShade, C.skin],
  sky: [C.skyDeep, C.skyDark, C.sky, C.skyLight],
  cloud: [C.cloudInk, C.cloudDark, C.cloud, C.cloudLight, C.cloudPale],
  moon: [C.moonDark, C.moon, C.moonLight],
  halo: [C.haloDark, C.halo, C.haloLight],
  umber: [C.umberDeep, C.umberDark, C.umber, C.umberLight],
  buff: [C.buffDeep, C.buffDark, C.buff, C.buffLight],
  down: [C.downShade, C.down, C.downLight],
  leg: [C.legDark, C.leg, C.legLight],
  wood: [C.groove, C.panelDark, C.panel, C.panelLit, C.panelLight],
  honey: [C.honeyDark, C.honey],
  dusk: [C.duskDeep, C.duskDark, C.dusk, C.duskLight],
  silver: [C.silverDark, C.silver],
};

/** A 0xRRGGBB colour as a CSS string ("#rrggbb"), for DOM styles and Phaser text. */
export function hexCss(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

/** A palette colour as a CSS string, for text and Phaser colours that want one. */
export function css(index: number): string {
  return hexCss(PALETTE[index]!);
}
