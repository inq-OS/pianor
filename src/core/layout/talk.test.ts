import { describe, expect, it } from 'vitest';
import { BAND_ROWS } from './band';
import { TALK, choiceLayout, lineSpot, studentHead, talkPages } from './talk';

/** A stand-in for the game's font: every letter 6 cells wide, words split at spaces. */
const wrapBy = (perRow: number) => (text: string, width: number): string[] => {
  const max = Math.floor(width / perRow);
  const rows: string[] = [];
  let row = '';
  for (const word of text.split(' ')) {
    const trial = row === '' ? word : `${row} ${word}`;
    if (row !== '' && trial.length > max) { rows.push(row); row = word; } else row = trial;
  }
  rows.push(row);
  return rows;
};
const wrap = wrapBy(6);
const AREA = { w: 320, h: 124 };

describe('the spoken line, in pages (ft_1_22.AC1, WP-09 look)', () => {
  it('a short line is one page of one row', () => {
    expect(talkPages('Ma kuulan.', wrap)).toEqual([['Ma kuulan.']]);
  });

  it('a page never has more than two rows, so a young student reads it before the next one (AX-0)', () => {
    const long = 'Siin saarel pole teisi puid. Ma olen kaua üksi kuulanud, mida tuul ja tuletornirahvas mängisid. Õpeta mulle!';
    const pages = talkPages(long, wrap);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(TALK.lineRows);
    expect(pages.flat().join(' ')).toBe(long);
  });

  it('a page ends at a sentence\'s end when the sentences fit', () => {
    const pages = talkPages('Ohoo... keegi tuli mu okste alla. Siin saarel pole teisi puid, ma olen kaua üksi kuulanud, mida tuul mängis.', wrap);
    expect(pages[0]!.join(' ')).toBe('Ohoo... keegi tuli mu okste alla.');
  });

  it('two sentences that each fit a row get a row each, never a word left alone on the second (art review 1)', () => {
    const pages = talkPages('Vana puu juures sahiseb keegi. Lähme vaatama?', wrapBy(5));
    expect(pages).toEqual([['Vana puu juures sahiseb keegi.', 'Lähme vaatama?']]);
  });

  it('one sentence too long for a page is cut between rows', () => {
    const one = Array.from({ length: 30 }, () => 'tuul').join(' ') + '.';
    const pages = talkPages(one, wrap);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(TALK.lineRows);
    expect(pages.flat().join(' ')).toBe(one);
  });

  it('no line gives no page', () => {
    expect(talkPages('', wrap)).toEqual([]);
    expect(talkPages('   ', wrap)).toEqual([]);
  });
});

describe('where the line floats: over the speaker\'s head, in the main area (MI2\'s manner, no box)', () => {
  it('centred over the head, its foot a little above it', () => {
    const spot = lineSpot({ head: { x: 160, y: 60 }, size: { w: 80, h: 20 }, area: AREA });
    expect(spot.x + 40).toBe(160);
    expect(spot.y + 20).toBe(60 - TALK.aboveHead);
  });

  it('kept inside the area\'s margins when the speaker stands at an edge', () => {
    const left = lineSpot({ head: { x: 4, y: 80 }, size: { w: 100, h: 20 }, area: AREA });
    expect(left.x).toBe(TALK.margin);
    const right = lineSpot({ head: { x: 318, y: 80 }, size: { w: 100, h: 20 }, area: AREA });
    expect(right.x + 100).toBe(AREA.w - TALK.margin);
  });

  it('a head near the top: the line goes beside the head, never over the face', () => {
    const head = { x: 60, y: 14 };
    const spot = lineSpot({ head, size: { w: 120, h: 20 }, area: AREA });
    expect(spot.y).toBeGreaterThanOrEqual(TALK.margin);
    const overHead = head.x >= spot.x && head.x <= spot.x + 120 && head.y >= spot.y && head.y <= spot.y + 20 + TALK.aboveHead;
    expect(overHead).toBe(false);
    const far = lineSpot({ head: { x: 280, y: 14 }, size: { w: 120, h: 20 }, area: AREA });
    expect(far.x + 120).toBeLessThan(280);
  });

  it('a line keeps clear of the other actors\' heads in the scene (art review 1: Kiur\'s line hid the man\'s face)', () => {
    const size = { w: 180, h: 20 };
    const other = { x: 195, y: 28 };
    const spot = lineSpot({ head: { x: 98, y: 52 }, size, area: AREA, avoid: [other] });
    const covers = other.x >= spot.x - TALK.headClear && other.x <= spot.x + size.w + TALK.headClear && other.y >= spot.y - TALK.headClear && other.y <= spot.y + size.h + TALK.headClear;
    expect(covers).toBe(false);
  });

  it('with no way round another head, the line still goes over its own speaker', () => {
    const spot = lineSpot({ head: { x: 160, y: 60 }, size: { w: 300, h: 20 }, area: AREA, avoid: [{ x: 160, y: 40 }] });
    expect(spot.y + 20).toBe(60 - TALK.aboveHead);
  });

  it('the student has no figure: their line rises from the band, centred at the foot of the picture', () => {
    const head = studentHead(AREA);
    expect(head).toEqual({ x: 160, y: AREA.h });
    const spot = lineSpot({ head, size: { w: 90, h: 9 }, area: AREA });
    expect(spot.y + 9).toBeLessThanOrEqual(AREA.h - TALK.aboveHead);
  });
});

describe('the student\'s choices in the band (ft_1_22.AC1: at most three)', () => {
  const LH = 11;

  it('three one-row choices sit in the band, top to bottom, inside its rows', () => {
    const { choices, overflow } = choiceLayout({ rows: [1, 1, 1], lineHeight: LH, width: 320 });
    expect(overflow).toBe(false);
    expect(choices).toHaveLength(3);
    for (let i = 1; i < 3; i++) expect(choices[i]!.text.y).toBeGreaterThan(choices[i - 1]!.text.y);
    expect(choices[0]!.hit.y).toBeGreaterThanOrEqual(0);
    const last = choices[2]!;
    expect(last.hit.y + last.hit.h).toBeLessThanOrEqual(BAND_ROWS);
  });

  it('every choice is pressed anywhere along its row, and the rows do not overlap', () => {
    const { choices } = choiceLayout({ rows: [1, 2, 1], lineHeight: LH, width: 320 });
    for (const c of choices) {
      expect(c.hit.x).toBe(0);
      expect(c.hit.w).toBe(320);
      expect(c.text.y).toBeGreaterThanOrEqual(c.hit.y);
    }
    for (let i = 1; i < choices.length; i++) expect(choices[i]!.hit.y).toBeGreaterThanOrEqual(choices[i - 1]!.hit.y + choices[i - 1]!.hit.h);
  });

  it('the note before a choice stands at its first row, left of the words', () => {
    const { choices } = choiceLayout({ rows: [1], lineHeight: LH, width: 320 });
    const c = choices[0]!;
    expect(c.bullet.y).toBe(c.text.y);
    expect(c.bullet.x).toBeLessThan(c.text.x);
    expect(c.text.x - c.bullet.x).toBe(TALK.textIndent);
  });

  it('more rows than the band holds is reported, so the linter or the writer can shorten a choice', () => {
    expect(choiceLayout({ rows: [2, 2, 1], lineHeight: LH, width: 320 }).overflow).toBe(true);
    expect(choiceLayout({ rows: [2, 1, 1], lineHeight: LH, width: 320 }).overflow).toBe(false);
  });

  it('the words wrap to the band\'s width less the note and the margins', () => {
    expect(choiceLayout({ rows: [1], lineHeight: LH, width: 320 }).textWidth).toBe(320 - TALK.choiceLeft - TALK.textIndent - TALK.choiceLeft);
  });
});
