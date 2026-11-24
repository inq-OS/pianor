import { Random } from '../../../../core/random';
import type { Look, Ramp } from './figureModel';
import { COLOURS, ghostly, ramp, SKINS, type ColourName } from './ramps';

/**
 * The template character's feature set (d142, d144): what `ActorDef.template.features` names. Every key has a list of
 * options; a person is one option per key. A named character chooses them in its content file; a walker or a visitor is
 * generated from the lists with a seed (`generateFeatures`), so the island can have many people without new art.
 */
export const FEATURE_SET = {
  skin: Object.keys(SKINS) as (keyof typeof SKINS)[],
  hair: ['none', 'short', 'bun', 'long', 'bald', 'curly'],
  hairColour: ['black', 'dark-brown', 'chestnut', 'auburn', 'ash', 'grey'],
  headwear: ['none', 'cap', 'brimhat', 'beanie', 'stocking'],
  beard: ['none', 'full', 'moustache'],
  nose: ['button', 'long', 'hook', 'bulb'],
  face: ['plain', 'lips'],
  top: ['shirt', 'coat', 'longcoat', 'jacket', 'sweater', 'vest', 'striped'],
  topColour: Object.keys(COLOURS) as ColourName[],
  accentColour: Object.keys(COLOURS) as ColourName[],
  bottom: ['trousers', 'skirt', 'longskirt'],
  bottomColour: Object.keys(COLOURS) as ColourName[],
  feet: ['boots', 'shoes'],
  feetColour: ['leather', 'oak', 'soot', 'rust', 'black'],
  neckwear: ['none', 'scarf'],
  trimColour: Object.keys(COLOURS) as ColourName[],
  held: ['none', 'folder', 'sax', 'lantern', 'rod'],
  heldColour: ['brass', 'gold', 'oak', 'tan'],
  pocket: ['none', 'metronome'],
  build: ['thin', 'normal', 'stout'],
  height: ['short', 'normal', 'tall'],
  belly: ['none', 'belly'],
  stoop: ['none', 'slight', 'stooped'],
  kind: ['living', 'ghost'],
  /** a child (the student, d154): the student's body and face; no beard, no stoop, and a snub nose whatever `nose` says */
  age: ['adult', 'child'],
} as const;

export type FeatureKey = keyof typeof FEATURE_SET;
export type TemplateFeatures = { readonly [K in FeatureKey]?: (typeof FEATURE_SET)[K][number] };

const DEFAULTS: Required<TemplateFeatures> = {
  skin: 'fair', hair: 'short', hairColour: 'dark-brown', headwear: 'none', beard: 'none', nose: 'button', face: 'plain',
  top: 'shirt', topColour: 'navy', accentColour: 'cream', bottom: 'trousers', bottomColour: 'brown', feet: 'boots',
  feetColour: 'leather', neckwear: 'none', trimColour: 'oak', held: 'none', heldColour: 'brass', pocket: 'none',
  build: 'normal', height: 'normal', belly: 'none', stoop: 'none', kind: 'living', age: 'adult',
};

/** Which option a feature names, or the default when it names none or one the set does not have. */
function option<K extends FeatureKey>(features: Readonly<Record<string, string>>, key: K): Required<TemplateFeatures>[K] {
  const value = features[key];
  return (FEATURE_SET[key] as readonly string[]).includes(value ?? '') ? (value as Required<TemplateFeatures>[K]) : DEFAULTS[key];
}

/** The unknown keys and options in a features record, for a content check: the figure draws the defaults for them. */
export function unknownFeatures(features: Readonly<Record<string, string>>): string[] {
  return Object.entries(features)
    .filter(([key, value]) => !(key in FEATURE_SET) || !(FEATURE_SET[key as FeatureKey] as readonly string[]).includes(value))
    .map(([key, value]) => `${key}: ${value}`);
}

/** A person's look from the features an `ActorDef` names. */
export function lookFromFeatures(features: Readonly<Record<string, string>>, name = 'person'): Look {
  const f = <K extends FeatureKey>(key: K) => option(features, key);
  const ghost = f('kind') === 'ghost';
  const child = f('age') === 'child';
  const tone = (colour: ColourName, opts?: { spread?: number }): Ramp => (ghost ? ghostly(COLOURS[colour]) : ramp(COLOURS[colour], opts));
  const skin: Ramp = ghost ? ghostly(SKINS[f('skin')][2]) : SKINS[f('skin')];
  return {
    name,
    ramps: {
      skin,
      hair: tone(f('hairColour')),
      top: tone(f('topColour')),
      bottom: tone(f('bottomColour')),
      feet: tone(f('feetColour')),
      accent: tone(f('accentColour')),
      held: ghost ? ramp(0xe8cc60, { warm: 0 }) : ramp(COLOURS[f('heldColour')], { spread: 1.15 }),
      trim: tone(f('trimColour')),
    },
    hair: f('hair'),
    headwear: f('headwear'),
    beard: child ? 'none' : f('beard'),
    nose: f('nose'),
    top: f('top'),
    bottom: f('bottom'),
    feet: f('feet'),
    neckwear: f('neckwear'),
    held: f('held'),
    pocket: f('pocket'),
    lips: f('face') === 'lips',
    build: { thin: 0.88, normal: 1, stout: 1.26 }[f('build')],
    tall: { short: 0.93, normal: 1, tall: 1.06 }[f('height')],
    belly: f('belly') === 'belly' ? 1 : 0,
    stoop: child ? 0 : { none: 0, slight: 0.3, stooped: 0.8 }[f('stoop')],
    ghost,
    child,
  };
}

/** Colours that go together on an islander's clothes (top, bottom). */
const OUTFITS: readonly (readonly [ColourName, ColourName])[] = [
  ['sea', 'tan'], ['mustard', 'denim'], ['rust', 'brown'], ['olive', 'moss'], ['navy', 'charcoal'], ['cream', 'brown'],
  ['plum', 'indigo'], ['red', 'denim'], ['khaki', 'oak'],
];

/**
 * A generated islander or visitor (d142): one option per key, drawn with the seeded random, so the same seed is
 * always the same person. Ghosts, held things and pockets belong to named characters and are never generated.
 */
export function generateFeatures(seed: string | number): TemplateFeatures {
  const r = Random.derive('template-figure', seed);
  const woman = r.chance(0.5);
  const [topColour, bottomColour] = r.pick(OUTFITS);
  const hair = woman ? r.pick(['bun', 'long', 'curly', 'short'] as const) : r.pick(['short', 'bald', 'curly', 'none'] as const);
  return {
    skin: r.weighted([['fair', 4], ['ruddy', 3], ['tan', 2], ['deep', 1]] as const),
    hair,
    hairColour: r.pick(FEATURE_SET.hairColour),
    headwear: r.weighted([['none', 5], ['beanie', 2], ['brimhat', 1], ['cap', 1]] as const),
    beard: woman ? 'none' : r.weighted([['none', 3], ['full', 2], ['moustache', 2]] as const),
    nose: r.pick(FEATURE_SET.nose),
    face: woman ? 'lips' : 'plain',
    top: r.pick(['shirt', 'coat', 'jacket', 'sweater', 'vest'] as const),
    topColour,
    accentColour: r.pick(['cream', 'khaki', 'red', 'mustard'] as const),
    bottom: woman ? r.weighted([['trousers', 2], ['skirt', 1], ['longskirt', 2]] as const) : 'trousers',
    bottomColour,
    feet: r.pick(FEATURE_SET.feet),
    feetColour: r.pick(FEATURE_SET.feetColour),
    neckwear: r.chance(0.2) ? 'scarf' : 'none',
    trimColour: r.pick(['oak', 'red', 'black', 'scarlet'] as const),
    build: r.weighted([['thin', 2], ['normal', 4], ['stout', 2]] as const),
    height: r.weighted([['short', 2], ['normal', 4], ['tall', 2]] as const),
    belly: r.chance(0.25) ? 'belly' : 'none',
    stoop: r.weighted([['none', 6], ['slight', 2], ['stooped', 1]] as const),
  };
}

/**
 * Six people on the template, the ones on the reviewed sheet: test cases for the sheet and the tests, not the
 * game's characters (those are chosen in docs/architect/cast-and-phrases.md and built in WP-11, WP-15).
 */
export const SAMPLE_PEOPLE: readonly { readonly name: string; readonly features: TemplateFeatures }[] = [
  {
    name: 'a teacher',
    features: { skin: 'fair', hair: 'bun', hairColour: 'dark-brown', nose: 'button', face: 'lips', top: 'longcoat', topColour: 'navy', accentColour: 'plum', bottom: 'longskirt', bottomColour: 'indigo', feet: 'shoes', feetColour: 'leather', neckwear: 'scarf', trimColour: 'red', held: 'folder', heldColour: 'gold', pocket: 'metronome', build: 'thin', height: 'normal' },
  },
  {
    name: 'a border guard',
    features: { skin: 'tan', hair: 'short', hairColour: 'chestnut', headwear: 'cap', beard: 'moustache', nose: 'hook', top: 'jacket', topColour: 'olive', accentColour: 'khaki', bottomColour: 'moss', feet: 'boots', feetColour: 'oak', trimColour: 'scarlet', held: 'sax', heldColour: 'brass', height: 'tall' },
  },
  {
    name: "a keeper's ghost",
    features: { kind: 'ghost', hair: 'bald', hairColour: 'grey', beard: 'full', nose: 'bulb', top: 'longcoat', topColour: 'navy', accentColour: 'sea', bottomColour: 'indigo', feet: 'boots', feetColour: 'soot', held: 'lantern', stoop: 'stooped' },
  },
  {
    name: 'a visitor',
    features: { skin: 'fair', hair: 'long', hairColour: 'auburn', nose: 'button', face: 'lips', top: 'sweater', topColour: 'mustard', accentColour: 'mustard', bottomColour: 'denim', feet: 'shoes', feetColour: 'rust', build: 'thin', height: 'short' },
  },
  {
    name: 'a fisherman',
    features: { skin: 'ruddy', hair: 'bald', hairColour: 'grey', headwear: 'beanie', beard: 'full', nose: 'bulb', top: 'sweater', topColour: 'sea', accentColour: 'red', bottomColour: 'tan', feet: 'boots', feetColour: 'soot', build: 'stout', height: 'short', belly: 'belly' },
  },
  {
    name: 'a farmer',
    features: { skin: 'tan', hair: 'curly', hairColour: 'black', headwear: 'brimhat', nose: 'long', top: 'vest', topColour: 'rust', accentColour: 'cream', bottomColour: 'brown', feet: 'boots', feetColour: 'oak', trimColour: 'black', build: 'thin', height: 'tall', stoop: 'slight' },
  },
];

/**
 * Three children on the student's body (d154), the outfits shown beside the pick: test cases for the
 * sheet and the tests. The student's own look is theirs to choose later; these are samples, not the student.
 */
export const SAMPLE_CHILDREN: readonly { readonly name: string; readonly features: TemplateFeatures }[] = [
  {
    name: 'the student: a striped sailor shirt and a red stocking cap',
    features: { age: 'child', skin: 'fair', hair: 'short', hairColour: 'chestnut', headwear: 'stocking', top: 'striped', topColour: 'sail', trimColour: 'navy', accentColour: 'red', bottomColour: 'denim', feet: 'boots', feetColour: 'black' },
  },
  {
    name: 'a child in a raincoat',
    features: { age: 'child', skin: 'fair', hair: 'long', hairColour: 'auburn', top: 'coat', topColour: 'mustard', accentColour: 'cream', bottomColour: 'navy', feet: 'boots', feetColour: 'rust', neckwear: 'scarf', trimColour: 'red' },
  },
  {
    name: 'a child in a cap',
    features: { age: 'child', skin: 'ruddy', hair: 'curly', hairColour: 'dark-brown', headwear: 'cap', top: 'shirt', topColour: 'sea', accentColour: 'cream', bottomColour: 'brown', feet: 'shoes', feetColour: 'leather' },
  },
];
