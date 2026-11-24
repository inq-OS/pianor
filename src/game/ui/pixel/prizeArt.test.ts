// Covers ft_1_21.AC15 (a won tug gives one item of that character into the band's inventory): its picture in the band.
import { describe, expect, it } from 'vitest';
import itemsJson from '../../../../content/items/items.json';
import { parseItems } from '../../../core/item/item';
import { inkBounds, inkCount } from './bitmap';
import { ITEM_SIZE } from './itemArt';
import { acorn, ACORN_INK, BELL_INK, FEATHER_INK, FLOAT_INK, goldenLeaf, gullFeather, holedStone, NEEDLE_INK, netFloat, netNeedle, shipsBell, STONE_INK, LEAF_INK, leafReach, OAK_LEAF_INK, oakLeaf, PRIZE_PICTURES, prizePicture, SEED_INK, seedOfLife } from './prizeArt';

describe('the prizes\' pictures in the band (ft_1_21.AC15, WP-13)', () => {
  it('ft_1_21.AC15 every picture key in the items file is drawn, at the size of a band item', () => {
    for (const item of parseItems(itemsJson).values()) {
      if (item.picture === undefined) continue;
      expect(PRIZE_PICTURES[item.picture], item.id).toBeDefined();
      const picture = prizePicture(item.picture)!;
      expect([picture.width, picture.height]).toEqual([ITEM_SIZE.width, ITEM_SIZE.height]);
    }
    expect(parseItems(itemsJson).get('golden-leaf')?.picture).toBe('golden-leaf');
  });

  it('an item with no picture, or an unknown key, has none (the band shows its name)', () => {
    expect(prizePicture(undefined)).toBeNull();
    expect(prizePicture('no-such-thing')).toBeNull();
  });

  it('the golden leaf is gold, lined in its own darkest tone, with a glint, and fills most of its slot', () => {
    const leaf = goldenLeaf();
    const colours = new Set(leaf.pixels);
    for (const c of [...LEAF_INK.gold, LEAF_INK.line, LEAF_INK.glint]) expect(colours.has(c)).toBe(true);
    const box = inkBounds(leaf)!;
    expect(box.right - box.left).toBeGreaterThan(ITEM_SIZE.width * 0.7);
    expect(box.bottom - box.top).toBeGreaterThan(ITEM_SIZE.height * 0.7);
    expect(inkCount(leaf)).toBeGreaterThan(500);
  });

  it('ft_1_21.AC18 the rungs look like a climb: the plain oak leaf is green with no glint, the acorn and the seed of life are drawn in their own inks', () => {
    const plain = new Set(oakLeaf().pixels);
    for (const c of [...OAK_LEAF_INK.gold, OAK_LEAF_INK.line]) expect(plain.has(c)).toBe(true);
    expect(plain.has(LEAF_INK.glint)).toBe(false);
    expect(inkCount(oakLeaf())).toBeGreaterThan(500);
    const nut = new Set(acorn().pixels);
    for (const c of [...ACORN_INK.nut, ...ACORN_INK.cup, ACORN_INK.line]) expect(nut.has(c)).toBe(true);
    const seed = new Set(seedOfLife().pixels);
    for (const c of [...SEED_INK.seed, ...SEED_INK.sprout, ...SEED_INK.light]) expect(seed.has(c)).toBe(true);
    for (const picture of [acorn(), seedOfLife()]) expect(inkCount(picture)).toBeGreaterThan(300);
  });

  it('the leaf\'s outline has lobes: its reach rises and falls along it, and it closes at the stalk and the tip', () => {
    expect(leafReach(0, 1)).toBe(0);
    expect(leafReach(1, -1)).toBe(0);
    const reach = Array.from({ length: 40 }, (_, i) => leafReach((i + 0.5) / 40, 1));
    const turns = reach.slice(1, -1).filter((r, i) => (r - reach[i]!) * (reach[i + 2]! - r) < 0).length;
    expect(turns).toBeGreaterThanOrEqual(3);
  });

  it('ft_1_21.AC18 the fisherman\'s rungs climb: a plain cork float and net needle, a gull\'s feather, a holed stone with a glint, a brass bell with points of light round it', () => {
    const inks = (picture: ReturnType<typeof netFloat>) => new Set(picture.pixels);
    const float = inks(netFloat());
    for (const c of [...FLOAT_INK.cork, FLOAT_INK.line, FLOAT_INK.twine.light]) expect(float.has(c)).toBe(true);
    const needle = inks(netNeedle());
    for (const c of [...NEEDLE_INK.wood, NEEDLE_INK.line, NEEDLE_INK.twine.light, NEEDLE_INK.twine.dark]) expect(needle.has(c)).toBe(true);
    const feather = inks(gullFeather());
    for (const c of [...FEATHER_INK.vane, FEATHER_INK.line, FEATHER_INK.tip[1], FEATHER_INK.spot]) expect(feather.has(c)).toBe(true);
    const stone = inks(holedStone());
    for (const c of [...STONE_INK.stone, STONE_INK.line, STONE_INK.glint]) expect(stone.has(c)).toBe(true);
    const bell = inks(shipsBell());
    for (const c of [...BELL_INK.brass, BELL_INK.line, ...BELL_INK.light]) expect(bell.has(c)).toBe(true);
    // the plain rungs have no glint, the treasure does
    for (const plain of [float, needle]) expect(plain.has(BELL_INK.light[1])).toBe(false);
    for (const picture of [netFloat(), netNeedle(), gullFeather(), holedStone(), shipsBell()]) expect(inkCount(picture)).toBeGreaterThan(300);
  });

  it('the holed stone has its hole: the slot shows through the middle of the stone', () => {
    const stone = holedStone();
    expect(stone.pixels[20 * stone.width + 33]).toBe(0);
    expect(stone.pixels[20 * stone.width + 20]).not.toBe(0);
  });
});
