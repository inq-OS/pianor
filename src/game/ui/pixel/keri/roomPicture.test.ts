import { beforeAll, describe, expect, it } from 'vitest';
import { roomPlan } from '../../../../core/layout/room';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import type { Bitmap } from '../bitmap';
import { C, PALETTE } from '../palette';
import { paletteFor } from '../sky/skyLooks';
import { roomArt } from './roomLife';
import { packRoom, unpackRoom } from './roomPack';
import type { Overlay } from '../pack';
import { FIRE_LOOKS, FLAME_FRAMES, HOVER_COLOURS, ROOM_RUNS, paintRoom, roomPalette, type RoomPicture } from './roomPicture';
import { VIEW } from './roomView';
import { ART_DETAIL } from '../../../../core/layout/frame';
import { ROOM, ROOM_OBJECTS, ROOM_PRESSABLES, pieceCorners, projectBounds } from '../../../../core/layout/room';
import { WOBBLE } from '../paint/painter';
import { stripArt } from './stripArt';

const art = roomArt(null);
const plan = roomPlan({ w: art.portrait.width, h: art.portrait.height });
const { w: W, h: H } = plan.fine;

/** How bright a picture's pixels are in the box, 0 to 255 on average. */
function brightness(look: Bitmap, palette: readonly number[], box = { x: 0, y: 0, w: W, h: H }): number {
  let sum = 0;
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
    const c = palette[look.pixels[y * W + x]!]!;
    sum += (((c >> 16) & 255) * 3 + ((c >> 8) & 255) * 5 + (c & 255) * 2) / 10;
  }
  return sum / (box.w * box.h);
}

describe('the painted warden\'s room (ft_1_18.AC3)', () => {
  const rooms = {} as Record<'day' | 'night', RoomPicture>;
  // Two rooms, each painted at rest and again awake (ft_1_20.AC15), take about 12 s, about seven times that under coverage,
  // and more on CI beside the other test files: 60 s ran out there for half of this. The knoll's and the rules'
  // tests have the same kind of margin.
  beforeAll(() => {
    for (const phase of ['day', 'night'] as const) rooms[phase] = paintRoom(plan.fine, plan.camera, phase, plan, art);
  }, 480_000);

  it('ft_1_18.AC3 the room\'s palette is the game\'s own for the hour, the room\'s shades after it, then the island\'s shared runs the view in the windows is painted from', () => {
    const shades = Object.values(ROOM_RUNS).flat().length + 2;
    for (const phase of SKY_PHASES) {
      const palette = roomPalette(phase);
      expect(palette.slice(0, PALETTE.length)).toEqual(paletteFor(phase).slice(0, PALETTE.length));
      expect(palette.length).toBeLessThanOrEqual(256);
      // the room's own shades are the same at every hour and no two are one colour
      const own = palette.slice(PALETTE.length, PALETTE.length + shades);
      expect(own).toEqual(roomPalette('day').slice(PALETTE.length, PALETTE.length + shades));
      expect(new Set(own).size).toBe(shades);
      // the view's colours are the island's at that hour, place for place (docs/art-direction.md rule 25)
      expect(palette.slice(PALETTE.length + shades)).toEqual(VIEW.at(phase).slice(PALETTE.length));
      expect(palette.length - PALETTE.length - shades).toBeGreaterThan(40);
    }
    expect(roomPalette('night').slice(PALETTE.length + shades)).not.toEqual(roomPalette('day').slice(PALETTE.length + shades));
  });

  it('ft_1_18.AC3 through its windows the room shows the island in the island\'s own colours and nowhere else; at night the lighthouse\'s lantern is lit in the left wall\'s window', () => {
    const shades = Object.values(ROOM_RUNS).flat().length + 2;
    const first = PALETTE.length + shades;
    const side = projectBounds(plan.camera, pieceCorners('left', ROOM.windowSide)), left = projectBounds(plan.camera, pieceCorners('back', ROOM.windowLeft));
    const within = (r: { x: number; y: number; w: number; h: number }, x: number, y: number, m: number): boolean => x >= r.x - m && x < r.x + r.w + m && y >= r.y - m && y < r.y + r.h + m;
    const windows = [side, left, projectBounds(plan.camera, pieceCorners('back', ROOM.windowRight))];
    const ember = VIEW.fine.ember.map((p) => p + shades);
    const lit = { day: 0, night: 0 };
    for (const phase of ['day', 'night'] as const) {
      let view = 0, astray = 0;
      rooms[phase].looks[1]!.pixels.forEach((p, i) => {
        if (p < first) return;
        view++;
        const x = i % W, y = Math.floor(i / W);
        // a window leans and the lens wobbles: the glass lies within a few pixels of its planned opening
        if (!windows.some((r) => within(r, x, y, 8))) astray++;
        if (ember.includes(p) && within(side, x, y, 8)) lit[phase]++;
      });
      expect(view).toBeGreaterThan(W * H * 0.02);
      expect(astray).toBe(0);
    }
    expect(lit.night).toBeGreaterThan(30);
    expect(lit.day).toBe(0);
    // the same sea in both sea windows by day: the view is one picture behind the wall
    expect(new Set(rooms.day.looks[1]!.pixels.filter((p) => p >= first)).size).toBeGreaterThan(12);
    expect(left.w).toBeGreaterThan(40);
  });

  it('ft_1_18.AC3 ft_1_08.AC9 the picture fills its size with colours of the room\'s palette, in three looks of the fire that differ only near the stove, and only when it burns', () => {
    for (const [phase, room] of Object.entries(rooms)) {
      expect(room.looks).toHaveLength(3);
      for (const look of room.looks) {
        expect([look.width, look.height]).toEqual([W, H]);
        expect(look.pixels.every((p) => p > 0 && p < room.palette.length)).toBe(true);
        // a painting, not flat fills: many shades are in use
        expect(new Set(look.pixels).size).toBeGreaterThan(40);
      }
      const [low, , high] = room.looks;
      let left = 0, right = 0;
      low!.pixels.forEach((p, i) => {
        if (p === high!.pixels[i]) return;
        if (i % W < W / 2) left++;
        else right++;
      });
      if (phase === 'day') {
        // no fire by day: the looks are alike
        expect(left + right).toBe(0);
        continue;
      }
      // the stove stands on the right: its small red light changes that half far more than the other
      expect(right).toBeGreaterThan(200);
      expect(right).toBeGreaterThan(3 * left);
      expect(brightness(high!, room.palette)).toBeGreaterThan(brightness(low!, room.palette));
    }
  });

  it('ft_1_18.AC3 ft_1_14.AC8 by day the room is lit through its windows; at night it is darker, and the lamps and the fire still light it', () => {
    const day = brightness(rooms.day.looks[1]!, rooms.day.palette), night = brightness(rooms.night.looks[1]!, rooms.night.palette);
    expect(day).toBeGreaterThan(night * 1.3);
    expect(night).toBeGreaterThan(25);
    // warm lamplight shades are in the night picture
    const warm = rooms.night.palette.map((c, i) => (((c >> 16) & 255) > 200 && (c & 255) < 150 ? i : -1)).filter((i) => i >= 0);
    expect(rooms.night.looks[1]!.pixels.filter((p) => warm.includes(p)).length).toBeGreaterThan(400);
    expect(rooms.day.palette).not.toEqual(rooms.night.palette);
  });

  it('ft_1_08.AC9 ft_1_09.AC3 the things that move lie inside the picture, each with its frames: flames, the sea\'s glint, Kiur, steam, metronome, the shield', () => {
    const inside = (o: Overlay): boolean => o.x >= 0 && o.y >= 0 && o.x + o.frames[0]!.width <= W && o.y + o.frames[0]!.height <= H;
    for (const room of Object.values(rooms)) {
      const frames = { flames: FLAME_FRAMES, shimmer: 1, kiur: 2, steam: art.steam.length, metronome: art.metronome.length, shield: art.shields.length } as const;
      for (const [name, n] of Object.entries(frames) as [keyof typeof frames, number][]) {
        const overlay = room[name];
        expect(overlay.frames, name).toHaveLength(n);
        expect(inside(overlay), name).toBe(true);
        for (const f of overlay.frames) {
          expect([f.width, f.height], name).toEqual([overlay.frames[0]!.width, overlay.frames[0]!.height]);
          expect(f.pixels.every((p) => p < room.palette.length), name).toBe(true);
          expect(f.pixels.some((p) => p !== 0), name).toBe(true);
        }
      }
      // the flames move only while the stove burns (at dusk and by night)
      if (room === rooms.night) for (let i = 1; i < FLAME_FRAMES; i++) expect(room.flames.frames[i]!.pixels).not.toEqual(room.flames.frames[i - 1]!.pixels);
      // the flames are in the stove on the right, Kiur on the bed on the left, the shield where the plan hangs it
      expect(room.flames.x).toBeGreaterThan(W / 2);
      expect(room.kiur.x + room.kiur.frames[0]!.width).toBeLessThan(W / 2);
      // within the lens's wobble of its planned place, as the painted wall is
      expect(Math.abs(room.shield.x - plan.shield.x)).toBeLessThanOrEqual(Math.ceil(WOBBLE));
      expect(Math.abs(room.shield.y - plan.shield.y)).toBeLessThanOrEqual(Math.ceil(WOBBLE));
    }
  });

  /** Where each thing's button lies, in fine pixels. */
  const cells = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x * ART_DETAIL, y: r.y * ART_DETAIL, w: r.w * ART_DETAIL, h: r.h * ART_DETAIL });
  /** The middle of what an overlay's frame draws, and how many pixels that is. */
  const middle = (o: Overlay, n = 0) => {
    const frame = o.frames[n]!;
    let sx = 0, sy = 0, k = 0;
    frame.pixels.forEach((p, i) => {
      if (p === 0) return;
      sx += o.x + (i % frame.width); sy += o.y + Math.floor(i / frame.width); k++;
    });
    return { x: sx / k, y: sy / k, pixels: k };
  };
  const within = (at: { x: number; y: number }, box: { x: number; y: number; w: number; h: number }, m: number) => at.x > box.x - m && at.x < box.x + box.w + m && at.y > box.y - m && at.y < box.y + box.h + m;

  it('ft_1_20.AC14 the shield, the one thing a press reaches that has no second look, has a contour of light with ink outside it, round its place in the picture (a simple contour highlight)', () => {
    expect(ROOM_PRESSABLES.filter((thing) => !(ROOM_OBJECTS as readonly string[]).includes(thing))).toEqual(['shield']);
    const { hover } = rooms.day;
    expect(hover.frames).toHaveLength(1);
    const frame = hover.frames[0]!;
    const used = new Set(frame.pixels);
    used.delete(0);
    expect([...used].sort()).toEqual([HOVER_COLOURS.line, HOVER_COLOURS.edge].sort((a, b) => a - b));
    // the line is the light part; the ink is a single pixel round it
    expect(frame.pixels.filter((p) => p === HOVER_COLOURS.line).length).toBeGreaterThan(frame.pixels.filter((p) => p === HOVER_COLOURS.edge).length);
    // the middle of the contour lies in the shield's button
    expect(within(middle(hover), plan.shield, 12)).toBe(true);
  });

  it('ft_1_20.AC15 each object has a second look for each strength of the fire, which changes the picture on and round the object only (the piano lid is closed and opens on hover)', () => {
    for (const room of Object.values(rooms)) {
      let all = 0;
      for (const thing of ROOM_OBJECTS) {
        const layer = room.awake[thing];
        expect(layer.frames, thing).toHaveLength(FIRE_LOOKS.length);
        const first = layer.frames[0]!;
        expect(layer.x >= 0 && layer.y >= 0 && layer.x + first.width <= W && layer.y + first.height <= H, thing).toBe(true);
        layer.frames.forEach((frame, n) => {
          expect([frame.width, frame.height], thing).toEqual([first.width, first.height]);
          expect(frame.pixels.every((p) => p < room.palette.length), thing).toBe(true);
          const at = middle(layer, n);
          // enough changes to be seen, and its middle lies on the object's button: the door's leaf swings a little out of its box
          expect(at.pixels, thing).toBeGreaterThan(300);
          expect(within(at, cells(plan.objects[thing]), 12), thing).toBe(true);
          // a clear pixel is the room at rest; a drawn one differs from it
          frame.pixels.forEach((p, i) => {
            if (p !== 0) expect(p, thing).not.toBe(room.looks[n]!.pixels[(layer.y + Math.floor(i / first.width)) * W + layer.x + (i % first.width)]);
          });
        });
        all += middle(layer, 1).pixels;
      }
      // the room stays the room: the four second looks together change little of it
      expect(all).toBeLessThan(W * H * 0.16);
    }
  });

  it('ft_1_20.AC15 at rest the piano\'s lid is down and the note board\'s stave is empty; awake the keys show and gold notes stand on the stave', () => {
    const room = rooms.day;
    const rgb = (index: number) => { const c = room.palette[index]!; return [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const; };
    type Is = (r: number, g: number, b: number) => boolean;
    /** Of the pixels a second look changes, how many pass `is` awake, how many at rest, and how many pass `is` awake where `was` passed at rest. */
    const count = (thing: 'piano' | 'easel', is: Is, was: Is = () => false) => {
      const layer = room.awake[thing], frame = layer.frames[1]!;
      let awake = 0, rest = 0, turned = 0;
      frame.pixels.forEach((p, i) => {
        if (p === 0) return;
        const before = rgb(room.looks[1]!.pixels[(layer.y + Math.floor(i / frame.width)) * W + layer.x + (i % frame.width)]!);
        if (is(...rgb(p))) awake++;
        if (is(...before)) rest++;
        if (is(...rgb(p)) && was(...before)) turned++;
      });
      return { awake, rest, turned };
    };
    // the ivory of the keys and the open book's paper, pale against the walnut and the shut blue book
    const pale = count('piano', (r, g, b) => (r * 3 + g * 5 + b * 2) / 10 > 100);
    expect(pale.awake).toBeGreaterThan(250);
    expect(pale.awake).toBeGreaterThan(pale.rest * 3);
    // the chalked notes: gold on the dark green board
    const gold = count('easel', (r, g, b) => r > 200 && g > 130 && b < 130, (r, g, b) => g > r && g > b);
    expect(gold.awake).toBeGreaterThan(40);
    // where the notes stand awake the board was bare green at rest (its frame is lit as gold as chalk in either look)
    expect(gold.turned).toBeGreaterThan(40);
    expect(gold.turned).toBeGreaterThan(gold.awake / 3);
  });

  it('ft_1_08.AC10 the portrait is painted into the picture where the plan hangs it', () => {
    const look = rooms.day.looks[1]!;
    const other = paintRoom(plan.fine, plan.camera, 'day', { portrait: { ...plan.portrait, x: plan.portrait.x - 20 }, shield: plan.shield }, art).looks[1]!;
    let changed = 0, outside = 0;
    look.pixels.forEach((p, i) => {
      if (p === other.pixels[i]) return;
      changed++;
      const x = i % W, y = Math.floor(i / W);
      // the painted wall is not where a ruler would put it (the lens wobbles): the portrait hangs within the wobble of its planned place
      const m = Math.ceil(WOBBLE) + 1;
      if (x < plan.portrait.x - 20 - m || x >= plan.portrait.x + plan.portrait.w + m || y < plan.portrait.y - m || y >= plan.portrait.y + plan.portrait.h + m) outside++;
    });
    expect(changed).toBeGreaterThan(300);
    expect(outside).toBe(0);
  }, 180_000);

  it('ft_1_18.AC3 the packed room the build hands the game unpacks to the same pictures', () => {
    const packed = packRoom(rooms.night);
    // three looks and every overlay in less than two thirds of the text the three looks have pixels (the pools' ragged
    // borders and the leaning set pack a sixth worse than the straight room did, d128)
    expect(JSON.stringify(packed).length).toBeLessThan(2 * W * H);
    expect(packed.looks[0]!.length).toBeLessThan(packed.looks[1]!.length);
    const back = unpackRoom(JSON.parse(JSON.stringify(packed)) as typeof packed);
    expect(back.palette).toEqual(rooms.night.palette);
    back.looks.forEach((look, i) => expect(look.pixels).toEqual(rooms.night.looks[i]!.pixels));
    for (const name of ['flames', 'shimmer', 'kiur', 'steam', 'metronome', 'shield', 'plant', 'hover'] as const) {
      expect([back[name].x, back[name].y]).toEqual([rooms.night[name].x, rooms.night[name].y]);
      back[name].frames.forEach((f, i) => expect(f).toEqual(rooms.night[name].frames[i]));
    }
    // ft_1_20.AC15 each object's second look travels with it
    for (const thing of ROOM_OBJECTS) expect(back.awake[thing]).toEqual(rooms.night.awake[thing]);
  });

  it('ft_1_18.AC3 the strip under the picture is a dark board of the size asked for, with a line along its top', () => {
    const strip = stripArt(640, 66);
    expect([strip.width, strip.height]).toEqual([640, 66]);
    expect(strip.pixels.subarray(0, 640).every((p) => p === C.ink)).toBe(true);
    expect(strip.pixels.every((p) => p === C.ink || p === C.panel || p === C.panelDark || p === C.night)).toBe(true);
    expect(strip.pixels.filter((p) => p === C.panelDark).length).toBeGreaterThan(640 * 66 * 0.8);
  });
});
