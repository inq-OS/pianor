// Covers ft_0_08.AC1 (recorded and synthetic replays).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChart } from '../../src/core/chart';
import type { JudgeEvent, NoteEvent, WrongNoteJudged } from '../../src/core/judge';
import { WaitMode } from '../../src/core/judge';

/** Replay fixture: recorded or synthetic key events plus what the judge must make of them. */
interface Replay {
  synthetic?: boolean;
  description: string;
  chart: string;
  events: Omit<NoteEvent, 'source'>[];
  expect: {
    wrong: { midi: number; expectedMidi: number; reason: string; direction: string }[];
    bars: Record<string, number>[];
    piece: Record<string, number>;
  };
}

const root = join(__dirname, '../..');
const files = readdirSync(__dirname).filter((f) => f.endsWith('.replay.json'));

describe('replay fixtures', () => {
  it('exist', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  describe.each(files)('%s', (file) => {
    const replay = JSON.parse(readFileSync(join(__dirname, file), 'utf-8')) as Replay;
    const parsed = parseChart(JSON.parse(readFileSync(join(root, replay.chart), 'utf-8')));
    if (!parsed.ok) throw new Error(parsed.errors.join('; '));

    const run = (): JudgeEvent[] => {
      const mode = new WaitMode(parsed.chart);
      return replay.events.flatMap((e) => mode.handle({ ...e, source: 'replay' }));
    };
    const events = run();

    it('is labelled synthetic unless it came from a real keyboard', () => {
      expect(typeof replay.synthetic === 'boolean' || replay.synthetic === undefined).toBe(true);
      expect(replay.description.length).toBeGreaterThan(10);
    });

    it('gives the wrong-note verdicts the fixture expects', () => {
      const wrong = events.filter((e): e is WrongNoteJudged => e.type === 'NoteJudged' && e.verdict === 'wrong');
      expect(wrong.map(({ midi, expectedMidi, reason, direction }) => ({ midi, expectedMidi, reason, direction }))).toEqual(replay.expect.wrong);
    });

    it('completes every bar and the piece with the expected results', () => {
      const bars = events.flatMap((e) => (e.type === 'BarCompleted' ? [e.result] : []));
      expect(bars).toMatchObject(replay.expect.bars);
      const piece = events.flatMap((e) => (e.type === 'PieceCompleted' ? [e.result] : []));
      expect(piece).toHaveLength(1);
      expect(piece[0]).toMatchObject(replay.expect.piece);
    });

    it('is deterministic', () => {
      expect(run()).toEqual(events);
    });
  });
});
