import { beforeAll, describe, expect, it } from 'vitest';
import { lchOf } from '../../src/game/ui/pixel/paint/lab';
import { paintStillOnce } from '../../src/game/ui/pixel/paint/motion';
import { KERI_PICTURES } from '../vite-keri';
import { paintCache } from '../test/paintCache';
import { SKY_PHASES } from '../../src/core/sky/skyPhase';
import { PICTURES, type ToolPicture } from './pictures';
import { bandedFindings, cloudFindings, cloudShape, idleRuns, limitsFor, runFindings, runsDeclared, SCENE_RULES, useFindings } from './sceneChecks';

/**
 * Every painted picture of Keri against the same rules (docs/art-direction.md section 5, d111): the room, the
 * map, the knoll and any scene added later. A picture names its runs of colours (`ToolPicture.runs`); each run keeps
 * the measured colour rules (steps of lightness, the hue's turn, a pale highlight), the picture is painted mostly from
 * its runs at every hour, without coarse dither, its runs are in use, its palette keeps its places from hour to hour,
 * and its clouds keep the measured ranges. A lit set (`banded`: the room) is held the other way on one point: its
 * runs stay short and its dither strong, because long runs turned its computed light into smooth shading that looked
 * too 3D, not in the MI2 style. Rules that only the eye can judge are not here: the maintainer decides those.
 */

/** A picture's runs as colours of the day, each dark to light (some are kept light to dark: a cloud's lit top first). */
const dayRuns = (picture: ToolPicture): [string, number[]][] => Object.entries(picture.runs).map(([run, places]) => [run, places.map((p) => picture.day[p]!).sort((a, b) => lchOf(a).l - lchOf(b).l)]);

const used = (pictures: readonly ToolPicture[]): Set<number> => new Set(pictures.flatMap((p) => [p.bitmap, ...p.moving]).flatMap((b) => [...new Set(b.pixels)]));

describe('every painted picture keeps the same rules of colour (d111)', () => {
  it('every picture the build paints is held to the rules, and no other', () => {
    expect(Object.keys(PICTURES).sort()).toEqual([...KERI_PICTURES].sort());
  });

  const hours = new Map<string, ToolPicture[]>();
  // painted once for each change to the painters' code: a later run reads them (tools/test/paintCache.ts)
  const cache = paintCache();
  /** A picture at every hour, painted once when first asked for. Each picture gets its own time limit, so a new scene does not push the others past one shared limit. */
  const paintedHours = (name: string): ToolPicture[] => {
    const known = hours.get(name);
    if (known) return known;
    const pictures = cache.painted(`${name} at every hour`, () => SKY_PHASES.map((phase) => PICTURES[name]!(phase)));
    hours.set(name, pictures);
    return pictures;
  };

  describe.each(Object.keys(PICTURES))('%s', (name) => {
    beforeAll(() => {
      paintedHours(name);
    }, 240_000);
    const at = (): ToolPicture[] => paintedHours(name);
    /** The picture by day: its runs and clouds are judged in it. */
    const byDay = (): ToolPicture => at()[SKY_PHASES.indexOf('day')]!;

    it('names its runs of colours, and they are sound', () => {
      const picture = byDay();
      expect(Object.keys(picture.runs).length).toBeGreaterThanOrEqual(3);
      expect(runsDeclared(picture.runs, picture.day)).toEqual([]);
    });

    it('each run has no step of lightness over its rule (long where tones are laid by hand, short bands in a lit set), turns its hue towards the light and keeps a pale highlight', () => {
      const picture = byDay();
      const findings = dayRuns(picture)
        .filter(([run]) => !picture.apart?.has(run))
        .flatMap(([run, colours]) => runFindings(run, colours, picture.kinds?.[run] ?? 'material', limitsFor(picture.banded).step));
      expect(findings).toEqual([]);
      // a lit set whose runs have all gone long has lost its flat tones
      if (picture.banded) expect(bandedFindings(dayRuns(picture).map(([, colours]) => colours))).toEqual([]);
    });

    it('at every hour it is painted mostly from its runs, with no more coarse dither than its manner allows, in a palette of one byte', () => {
      at().forEach((picture, i) => expect(useFindings(picture.bitmap, picture.palette, picture.runs, limitsFor(picture.banded).dither), SKY_PHASES[i]).toEqual([]));
    });

    it('the hour changes the colours, never the palette\'s places', () => {
      const day = byDay();
      for (const other of at()) {
        expect(other.palette.length).toBe(day.palette.length);
        expect(other.runs).toEqual(day.runs);
        expect(other.day).toEqual(day.palette);
      }
    });

    it('its own runs are in use: no run it has for itself lies idle at every hour', () => {
      const pictures = at();
      // a run of the shared palette may be another scene\'s: that is asked of all the scenes together, below
      if (!pictures[0]!.shared) expect(idleRuns(pictures[0]!.runs, used(pictures), SCENE_RULES.ownRunUse)).toEqual([]);
    });

    it('its clouds keep the measured ranges, and no two are alike', () => {
      expect(cloudFindings((byDay().clouds ?? []).map(cloudShape))).toEqual([]);
    });
  });

  // The pictures painted in a loop of looks paint their still land once and lay it again (`StillPart`): each is the
  // same, look for look and pixel for pixel, as when it is painted afresh in every look: at dusk and at night, when
  // the lamps burn and the embers glow. Every looped picture is here, so one that starts to paint a part once is held.
  describe.each(['knoll', 'crossroads', 'docks', 'lantern', 'port'].flatMap((name) => (['dusk', 'night'] as const).map((hour) => [name, hour] as const)))('%s at %s, painted once where it stands still', (name, hour) => {
    it('is the picture painted look by look', () => {
      const once = paintedHours(name)[SKY_PHASES.indexOf(hour)]!;
      const afresh = cache.painted(`${name} at ${hour}, look by look`, () => {
        paintStillOnce(false);
        try {
          return PICTURES[name]!(hour);
        } finally {
          paintStillOnce(true);
        }
      });
      expect([...once.bitmap.pixels]).toEqual([...afresh.bitmap.pixels]);
      expect(once.moving.length).toBe(afresh.moving.length);
      once.moving.forEach((m, i) => expect([...m.pixels], `moving ${i}`).toEqual([...afresh.moving[i]!.pixels]));
    }, 240_000);
  });

  it('every run of the shared palette is used by some scene that paints from it', () => {
    const sharing = Object.keys(PICTURES).map(paintedHours).filter((pictures) => pictures[0]!.shared);
    expect(sharing.length).toBeGreaterThan(0);
    expect(idleRuns(sharing[0]![0]!.runs, used(sharing.flat()), 0)).toEqual([]);
  }, 240_000);
});
