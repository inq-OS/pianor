/**
 * What lives in each painted place, said kind by kind (small
 * details and nuances are to be considered in future scenes too). A place is not done when its picture is painted: for each
 * kind below its painter says what moves there, or `none:` and why nothing does. A new place cannot be added without
 * its list (`SceneLife.living` is required, and `sceneLiving.test.ts` fails for a scene in `content/scenes/` with no
 * list or an empty answer), so the question is asked every time. How each kind is made, and the verdicts on
 * them: `projects/painter/artists-notes/living-things.md`.
 */

/**
 * The kinds of life asked after in every place:
 * - `fire`: flames, embers, a lamp's or a window's light, sparks, smoke (`flicker.ts`, `motes.ts`, `paint/smoke.ts`);
 * - `water`: the sea's strokes, glints, rings, surf and spray, a boat on the swell, what swims and sways under it
 *   (`liveWater.ts`, `sway.ts`, `swimMotion.ts`, `leap.ts`);
 * - `wind`: what the place's one wind moves: clouds, grass, a flag, washing, smoke's lean (`windField.ts`, `sway.ts`);
 * - `birds`: gulls and other flocks (`flock.ts`);
 * - `small`: the small lives and lights: fireflies, moths, dust, steam, a sleeper's breath (`motes.ts`, `wisps.ts`).
 */
export const LIFE_KINDS = ['fire', 'water', 'wind', 'birds', 'small'] as const;
export type LifeKind = (typeof LIFE_KINDS)[number];

/** A place's answers, one sentence for each kind. */
export type Living = Readonly<Record<LifeKind, string>>;

/** How an answer starts when the place has nothing of a kind; the reason follows. */
export const NO_LIFE = 'none:';

/** The places' lists, by scene id (`content/scenes/<id>.json`). */
export const SCENE_LIVING: Readonly<Record<string, Living>> = {
  knoll: {
    fire: 'the embers glow up and down in no set rhythm; sharp sparks rise nearly straight, some into the sky; a thread of smoke by day and in the half light, none at night',
    water: 'the far sea is lit live: strokes and glints come and go on their own',
    wind: 'the smoke leans in a gust and the sparks a little downwind; clouds surge with the gusts; the grass and the stems stand still',
    birds: 'three gulls fly as a flock over the sea by day and in the half light',
    small: 'fireflies light up and fade over the grass from dusk to dawn',
  },
  docks: {
    fire: 'the lantern\'s light wanders in strength at dusk and night',
    water: 'strokes, glints, rings and surf are lit live; spray flies off the rocks in a gust',
    wind: 'clouds surge with the gusts; the water and the gulls lean with them',
    birds: 'three gulls fly as a flock by day and in the half light',
    small: 'moths circle the lantern while it is lit',
  },
  crossroads: {
    fire: 'none: no fire or lamp burns in this view; the window\'s light stands still until a look of its own is painted',
    water: 'the far sea is lit live: strokes and glints come and go on their own',
    wind: 'clouds surge with the gusts; the grass and the roses stand still until their looks are painted',
    birds: 'two gulls fly as a flock by day and in the half light',
    small: 'fireflies light up and fade over the grass from dusk to dawn',
  },
  port: {
    fire: 'the beacon\'s light wanders in strength at dusk and night',
    water: 'strokes, glints and rings are lit live; the moored boats ride the swell smoothly, each in its own time; a fish jumps now and then and leaves a ring; below, kelp sways and fish, a school, jellyfish and bubbles go their own ways',
    wind: 'the boats\' pennants and washing fly on the gusts; clouds surge with them',
    birds: 'three gulls fly as a flock by day and in the half light',
    small: 'moths circle the beacon while it is lit',
  },
  terrace: {
    fire: 'the lantern at the watchtower\'s corner on the walk\'s head wanders in strength at dusk and night; the grill\'s coals glow then and throw a spark now and then; the seven torches round the deck and down the walk burn then, each flame licking on its own beat, the two nearest throwing sparks; a thread of smoke rises from the grill by day and in the half light',
    water: 'strokes, glints, the rings round the boulders and the surf along the shingle are lit live',
    wind: 'the pennant on the watchtower\'s staff flaps on the gusts and the smoke leans with them; clouds surge with the gusts; the grass tufts stand still',
    birds: 'three gulls fly as a flock over the sea by day and in the half light',
    small: 'moths circle the lantern while it is lit',
  },
};

/** What is wrong with a place's list: an answer missing, too short to say anything, or a `none:` with no reason. Empty when it is in order. */
export function livingGaps(living: Partial<Living> | undefined): string[] {
  if (!living) return LIFE_KINDS.map((kind) => `${kind}: no answer`);
  return LIFE_KINDS.flatMap((kind) => {
    const answer = (living[kind] ?? '').trim();
    if (answer === '') return [`${kind}: no answer`];
    const said = answer.startsWith(NO_LIFE) ? answer.slice(NO_LIFE.length).trim() : answer;
    return said.split(/\s+/).length < 4 ? [`${kind}: says too little ("${answer}")`] : [];
  });
}
