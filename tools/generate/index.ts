import { PPQ, midiToSpelling, noteName, type LevelDefinition, type PieceMeta } from '../../src/core/chart/index.ts';
import { Random } from '../../src/core/random.ts';
import { checkPiece, type PieceCheck } from '../../src/core/piece/check.ts';
import { writeAbc, type FingerFor } from './abcWriter.ts';
import { bestFingering } from '../../src/core/fingering/search.ts';
import { handSlices } from '../../src/core/fingering/slices.ts';
import type { Finger } from '../../src/core/fingering/costs.ts';
import { GENERATOR_KINDS, builders, defaultBars, type FiveFingerPattern, type GeneratorKind, type GeneratorParams } from './generators.ts';
import { BadRequest, Rejected, type Draft, type Hand, type Meter } from './model.ts';
import { melodiesOf, sharesWindow } from './similarity.ts';
import { contentStyles } from '../piece/styles.ts';

export { GENERATOR_KINDS, type GeneratorKind };
export { BadRequest } from './model.ts';

/** What to make: the kind of generator, the level it must fit, and the seed that decides the details. */
export interface GenerateRequest extends GeneratorParams {
  kind: GeneratorKind;
  level: number;
  /** The same seed and request always give the same piece. */
  seed: string | number;
  /** Bars wanted; the generator's own choice (within the level's limits) when not given. */
  bars?: number;
  /** A meter the level allows, like "3/4"; the level's first meter when not given. */
  meter?: string;
}

export interface GenerateContext {
  levels: readonly LevelDefinition[];
  /** Run keys (see `similarity.ts`) of melodies a generated piece must not repeat: the pieces that already exist. */
  avoid?: ReadonlySet<string>;
  /** How many candidates to try before giving up. Default 80. */
  maxAttempts?: number;
}

export interface Generated {
  /** The piece id, which is also its folder name. */
  id: string;
  title: string;
  abc: string;
  /** The text of `piece.meta.json`. */
  metaJson: string;
  /** The compile and lint result of this exact text: no errors and no warnings. */
  check: PieceCheck;
  /** Candidates tried; 1 when the first one passed. */
  attempts: number;
}

/** No candidate passed the linter, or only candidates that copy a known melody. */
export class GenerateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerateError';
  }
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 4);
}

function parseMeter(text: string | undefined, level: LevelDefinition): Meter {
  if (text === undefined) return { ...level.meters[0]! };
  const match = /^(\d+)\/(\d+)$/.exec(text);
  const meter = match ? { num: Number(match[1]), den: Number(match[2]) } : null;
  if (!meter || !level.meters.some((m) => m.num === meter.num && m.den === meter.den)) {
    throw new BadRequest(`meter "${text}" is not one of level ${level.level}'s meters (${level.meters.map((m) => `${m.num}/${m.den}`).join(', ')})`);
  }
  return meter;
}

/** The id of a piece: what it is, the level, the hand, the seed and any choice that changes the result. */
export function pieceId(request: GenerateRequest, handCode: string): string {
  const parts = ['gen', request.kind, `l${request.level}`, handCode, `s${slug(String(request.seed))}`];
  if (request.bars !== undefined) parts.push(`b${request.bars}`);
  if (request.meter !== undefined) parts.push(`m${request.meter.replace('/', '')}`);
  if (request.pattern !== undefined) parts.push(request.pattern);
  if (request.motif !== undefined) parts.push(`mo${shortHash(request.motif)}`);
  return parts.join('-');
}

/** The request as recorded in the meta file, so the piece can be regenerated from it. */
function recordedParams(request: GenerateRequest): Record<string, unknown> {
  const params: Record<string, unknown> = { level: request.level };
  for (const key of ['hand', 'bars', 'meter', 'pattern', 'motif'] as const) if (request[key] !== undefined) params[key] = request[key];
  return params;
}

/** A request checked against the level table, with what follows from it. */
interface ValidRequest {
  level: LevelDefinition;
  hand: Hand;
  handCode: string;
  meter: Meter;
  bars: number;
}

/** Check the kind, level, hand, meter, bar count and pattern; throws `BadRequest` naming what is wrong. */
function validateRequest(request: GenerateRequest, context: GenerateContext): ValidRequest {
  if (!(GENERATOR_KINDS as readonly string[]).includes(request.kind)) throw new BadRequest(`unknown generator "${request.kind}" (${GENERATOR_KINDS.join(', ')})`);
  const level = context.levels.find((l) => l.level === request.level);
  if (!level) throw new BadRequest(`level ${request.level} is not in the level table`);

  const both = request.hand === 'both';
  const hand: Hand = request.hand === 'RH' || request.hand === 'LH' ? request.hand : (level.hands[0] as Hand);
  if (!both && !level.hands.includes(hand)) throw new BadRequest(`level ${level.level} does not use the ${hand === 'RH' ? 'right' : 'left'} hand`);
  const meter = parseMeter(request.meter, level);
  const bars = request.bars ?? defaultBars(request.kind, level.bars.min, level.bars.max, (meter.num * 4) / meter.den);
  if (!Number.isInteger(bars) || bars < level.bars.min || bars > level.bars.max) {
    throw new BadRequest(`${bars} bars is outside level ${level.level}'s ${level.bars.min} to ${level.bars.max}`);
  }
  if (request.pattern !== undefined && !(['runs', 'skips', 'pairs'] as FiveFingerPattern[]).includes(request.pattern)) {
    throw new BadRequest(`unknown pattern "${request.pattern}" (runs, skips, pairs)`);
  }
  return { level, hand, handCode: both ? 'both' : hand.toLowerCase(), meter, bars };
}

/** The title says which piece this is: level.seed, and whatever else tells it from its siblings (the menu shows titles). */
function titleLabelOf(request: GenerateRequest, level: LevelDefinition, handCode: string): string {
  const seedLabel = typeof request.seed === 'number' ? String(request.seed) : slug(request.seed);
  return [
    `${level.level}.${seedLabel}`,
    ...(level.hands.length > 1 ? [handCode === 'both' ? 'both hands' : handCode.toUpperCase()] : []),
    ...(request.bars !== undefined ? [`${request.bars} bars`] : []),
    ...(request.meter !== undefined ? [request.meter] : []),
    ...(request.pattern !== undefined ? [request.pattern] : []),
    ...(request.motif !== undefined ? ['motif'] : []),
  ].join(' ');
}

/** The Estonian base of each generator's English title (ft_0_18.AC4). */
const TITLE_BASES_ET: Readonly<Record<string, string>> = {
  'Finger Walk': 'Sõrmekõnd',
  'Scale Climb': 'Gammaredel',
  'Note Hunt': 'Noodijaht',
  'Echo Game': 'Kajamäng',
  'Little Tune': 'Väike lugu',
};

/**
 * The Estonian title: the base, then the level and seed and the hand and bars the English one carries. The pattern and the
 * motif stay English-only: they are generator words, not student words, so they are left out of the Estonian title.
 */
function titleEtOf(request: GenerateRequest, level: LevelDefinition, handCode: string, base: string): string {
  const seedLabel = typeof request.seed === 'number' ? String(request.seed) : slug(request.seed);
  const code = handCode.toLowerCase();
  const hand = code === 'both' ? 'mõlemad käed' : code === 'rh' ? 'PK' : code === 'lh' ? 'VK' : handCode;
  return [
    base,
    `${level.level}.${seedLabel}`,
    ...(level.hands.length > 1 ? [hand] : []),
    ...(request.bars !== undefined ? [`${request.bars} takti`] : []),
    ...(request.meter !== undefined ? [request.meter] : []),
  ].join(' ');
}

/** The text of the draft meta file for a candidate. */
function metaJsonOf(request: GenerateRequest, level: LevelDefinition, id: string, draft: Draft, titleEt: string | null): string {
  const meta = {
    id,
    title: draft.title,
    ...(titleEt !== null ? { titles: { et: titleEt } } : {}),
    level: level.level,
    status: 'draft',
    hands: (['RH', 'LH'] as const).filter((h) => draft.voices.some((v) => v.hand === h)),
    phrases: draft.phrases,
    styles: ['exercise'],
    tags: draft.tags,
    source: `generated by the Pianor ${request.kind} generator (seed ${request.seed}); original`,
    license: 'CC0-1.0',
    generator: { kind: request.kind, seed: request.seed, params: recordedParams(request) },
  };
  return `${JSON.stringify(meta, null, 2)}\n`;
}

/** Why a candidate was turned down: the first diagnostic, without its bar and beat so like reasons count together. */
function rejection(check: PieceCheck, avoid: ReadonlySet<string> | undefined): string | null {
  if (check.diagnostics.length > 0) {
    const first = check.diagnostics[0]!;
    return `${first.severity}${first.rule ? ` [${first.rule}]` : ''}: ${first.message.replace(/^bar \d+, beat [\d.]+: /, '')}`;
  }
  if (avoid && check.compiled.chart && melodiesOf(check.compiled.chart).some((m) => sharesWindow(m, avoid))) return 'copies eight notes of an existing melody';
  return null;
}

/**
 * The fingers a generated piece writes (ft_1_30): the level's hand-position finger of a note, only where the best fingering
 * of the hand (`bestFingering`) also takes it. A scale that climbs out of the position gets no finger past the thumb's
 * turn, instead of a 5 on G that would leave the hand stuck.
 */
function positionFingers(draft: Draft, level: LevelDefinition): FingerFor {
  const agreed = new Map<Hand, (number | undefined)[]>();
  for (const voice of draft.voices) {
    const table = level.fingerings[voice.hand];
    const notes: { midi: number; start: number; end: number; preferred: Finger | undefined }[] = [];
    let at = 0;
    for (const slot of voice.bars.flat()) {
      const end = at + slot.beats * PPQ;
      if (slot.midi !== null) notes.push({ midi: slot.midi, start: at, end, preferred: table?.[noteName(midiToSpelling(slot.midi))] as Finger | undefined });
      at = end;
    }
    const { slices, places } = handSlices(notes);
    const best = bestFingering(voice.hand, slices);
    agreed.set(voice.hand, notes.map((n, i) => {
      const found = best.fingers[places[i]!.slice]?.[places[i]!.key];
      return n.preferred !== undefined && found === n.preferred ? n.preferred : undefined;
    }));
  }
  return (hand, _midi, index) => agreed.get(hand)?.[index];
}

/**
 * Make a piece: ABC text and a draft meta file. The generator builds a candidate from the seed, writes it as ABC and runs
 * the same compile and lint as `piece:lint`; only a candidate with no error and no warning, and no run of eight notes
 * that is also in a known melody, is returned. Later candidates come from the same seed, so the result is always the same.
 */
export function generatePiece(request: GenerateRequest, context: GenerateContext): Generated {
  const { level, hand, handCode, meter, bars } = validateRequest(request, context);
  const id = pieceId(request, handCode);
  const titleLabel = titleLabelOf(request, level, handCode);
  const maxAttempts = context.maxAttempts ?? 80;
  const params: GeneratorParams = {
    ...(request.hand !== undefined ? { hand: request.hand } : {}),
    ...(request.pattern !== undefined ? { pattern: request.pattern } : {}),
    ...(request.motif !== undefined ? { motif: request.motif } : {}),
  };

  const reasons = new Map<string, number>();
  const note = (reason: string) => reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const random = Random.derive(String(request.seed), request.kind, request.level, handCode, request.bars ?? 'auto', request.meter ?? 'auto', request.pattern ?? 'any', request.motif ?? 'none', attempt);
    let draft: Draft;
    try {
      draft = builders[request.kind]({ level, hand, meter, bars, barsGiven: request.bars !== undefined }, random, params);
    } catch (e) {
      if (e instanceof Rejected) {
        note(`rejected: ${e.message}`);
        continue;
      }
      throw e;
    }
    const baseEt = TITLE_BASES_ET[draft.title];
    const titleEt = baseEt === undefined ? null : titleEtOf(request, level, handCode, baseEt);
    draft.title = `${draft.title} ${titleLabel}`;
    const abc = writeAbc(draft, positionFingers(draft, level));
    const metaJson = metaJsonOf(request, level, id, draft, titleEt);
    const check = checkPiece({ styles: contentStyles, folder: id, abc, meta: metaJson, levels: context.levels });
    const reason = rejection(check, context.avoid);
    if (reason !== null) {
      note(reason);
      continue;
    }
    return { id, title: draft.title, abc, metaJson, check, attempts: attempt + 1 };
  }
  const summary = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r, n]) => `${n}x ${r}`).join('; ');
  throw new GenerateError(`no candidate passed in ${maxAttempts} attempts (${summary})`);
}

/** Make the same piece again from the generator record in its meta file. */
export function regenerate(meta: Pick<PieceMeta, 'level' | 'generator'>, context: GenerateContext): Generated {
  const { kind, seed, params } = meta.generator;
  if (!(GENERATOR_KINDS as readonly string[]).includes(kind)) throw new BadRequest(`"${kind}" is not a generator this tool knows`);
  if (seed === undefined) throw new BadRequest('the meta file records no seed, so the piece cannot be made again');
  const recorded = (params ?? {}) as Partial<GenerateRequest>;
  return generatePiece({ ...recorded, kind: kind as GeneratorKind, level: typeof recorded.level === 'number' ? recorded.level : meta.level, seed }, context);
}
