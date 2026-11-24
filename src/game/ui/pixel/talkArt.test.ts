import { afterEach, describe, expect, it } from 'vitest';
import { BOARD_ROWS } from '../../../core/layout/frame';
import { TALK } from '../../../core/layout/talk';
import { setLanguage } from '../../../core/text/language';
import { CAP_HEIGHT, CELL_HEIGHT } from './font';
import { C } from './palette';
import { CHARACTER_INK, CHOICE_INK, NOTE_TO_WORDS, TALK_INK, choiceNote, choiceRows, choiceWords, scriptInk, spokenLine, spokenPages, talkBoard, talkColour } from './talkArt';

const colours = (pixels: Uint8Array): Set<number> => new Set([...pixels].filter((p) => p !== 0));

afterEach(() => setLanguage('et'));

describe('the conversation\'s look (ft_1_22.AC1, WP-09 painter part, take A2)', () => {
  it('every speaker has their own colour, as in MI2: the student white, Kiur gold, each character its own', () => {
    expect(talkColour('student')).toBe(C.white);
    expect(talkColour('kiur')).toBe(C.goldLight);
    expect(talkColour('character', 'puuvaim')).toBe(CHARACTER_INK.puuvaim);
    const all = [...Object.values(TALK_INK), ...Object.values(CHARACTER_INK)];
    expect(new Set(all).size).toBe(all.length);
  });

  it('a character without a colour of its own still speaks, in the fallback colour', () => {
    expect(talkColour('character', 'nobody-yet')).toBe(C.teal);
    expect(talkColour('character')).toBe(C.teal);
  });

  it('a spoken line is its colour inside a one-pixel ink outline, and nothing else (no box)', () => {
    const line = spokenLine(['MA KUULAN.'], C.goldLight);
    expect(colours(line.pixels)).toEqual(new Set([C.goldLight, C.ink]));
    // the outline adds one pixel round the letters: the first and last rows and columns hold ink only
    const w = line.width;
    for (let x = 0; x < w; x++) expect([0, C.ink]).toContain(line.pixels[x]);
    for (let y = 0; y < line.height; y++) expect([0, C.ink]).toContain(line.pixels[y * w]);
    expect(line.height).toBe(CELL_HEIGHT + 2);
  });

  it('two rows are centred on each other', () => {
    const line = spokenLine(['A', 'MMMMM'], C.white);
    const firstRowInk = [...line.pixels.slice(line.width, line.width * 2)].map((p, x) => (p === C.white ? x : -1)).filter((x) => x >= 0);
    const middle = (Math.min(...firstRowInk) + Math.max(...firstRowInk)) / 2;
    expect(Math.abs(middle - (line.width - 1) / 2)).toBeLessThanOrEqual(1);
  });

  it('spoken pages are drawn in the language\'s letter case and never longer than two rows', () => {
    const pages = spokenPages('Siin saarel pole teisi puid. Ma olen kaua üksi kuulanud, mida tuul ja tuletornirahvas mängisid.');
    expect(pages.length).toBeGreaterThanOrEqual(1);
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(TALK.lineRows);
  });

  it('a choice is dim honey at rest and gold when lit, its note the same', () => {
    expect(colours(choiceWords('Ma tulen hiljem.', 280, false).pixels)).toEqual(new Set([CHOICE_INK.rest]));
    expect(colours(choiceWords('Ma tulen hiljem.', 280, true).pixels)).toEqual(new Set([CHOICE_INK.lit]));
    expect(colours(choiceNote(false).pixels)).toEqual(new Set([CHOICE_INK.rest]));
    expect(colours(choiceNote(true).pixels)).toEqual(new Set([CHOICE_INK.lit]));
    expect(CHOICE_INK.rest).not.toBe(CHOICE_INK.lit);
  });

  it('the choices\' ink belongs to no speaker, as in MI2 (art review 1: Kiur\'s gold was the lit choice\'s)', () => {
    const speakers = [...Object.values(TALK_INK), ...Object.values(CHARACTER_INK), C.teal];
    expect(speakers).not.toContain(CHOICE_INK.lit);
    expect(speakers).not.toContain(CHOICE_INK.rest);
  });

  it('the note is as tall as a capital, so it stands on the first row\'s line, and leaves a gap before the words', () => {
    expect(choiceNote(false).height).toBe(CAP_HEIGHT);
    expect(NOTE_TO_WORDS).toBeGreaterThanOrEqual(3);
  });

  it('choiceRows counts the rows a choice wraps to', () => {
    expect(choiceRows('Ma tulen hiljem.', 280)).toBe(1);
    expect(choiceRows('Ma tulen hiljem.', 30)).toBeGreaterThan(1);
  });

  it('the board fills the band\'s rows, in the band\'s own wood and a dark board', () => {
    const board = talkBoard(320);
    expect(board.width).toBe(320);
    expect(board.height).toBe(BOARD_ROWS);
    expect([...board.pixels].every((p) => p !== 0)).toBe(true);
    expect(board.pixels[(BOARD_ROWS >> 1) * 320 + 160]).toBe(C.night);
    for (const c of colours(board.pixels)) expect([C.panel, C.groove, C.night, C.panelLit, C.panelDark]).toContain(c);
  });
});

describe("a scene script's line colour (ft_1_24, WP-07)", () => {
  const characters = [{ id: 'puuvaim', actor: 'puuvaim' }, { id: 'someone', actor: 'someone-figure' }];
  it('ft_1_24.AC6 Kiur speaks in his gold, a character in its own colour found by its actor, anyone else in the fallback', () => {
    expect(scriptInk('kiur', characters)).toBe(TALK_INK.kiur);
    expect(scriptInk('puuvaim', characters)).toBe(CHARACTER_INK.puuvaim);
    expect(scriptInk('someone-figure', characters)).toBe(talkColour('character', 'someone'));
    expect(scriptInk('boat', characters)).toBe(talkColour('character'));
    expect(scriptInk('boat', characters)).not.toBe(TALK_INK.kiur);
  });
});
