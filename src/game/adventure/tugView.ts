import type Phaser from 'phaser';
import { playbackLengthMs, playbackNotes, sliceChart, type Chart } from '../../core/chart';
import { advanceTug, leaveTug, startTug, type TugRules, type TugSetup, type TugState } from '../../core/exchange/tug';
import { studentShare, tugFact, tugSetupOf, turnChartBars } from '../../core/exchange/tugPlay';
import { TempoMode, WaitMode, type NoteJudged, type PieceResult } from '../../core/judge';
import { clickPlan } from '../../core/transport/practiceSpeed';
import { Transport } from '../../core/transport/transport';
import { BOARD_ROWS } from '../../core/layout/frame';
import { lineSpot } from '../../core/layout/talk';
import { ragPlace, risingNotes, TUG, tugBoard, turnNoteBob } from '../../core/layout/tug';
import { strings, t, type StringKey } from '../../core/text/strings';
import type { MetronomeSound, PianoSound, SongClock } from '../../io/audio';
import type { KeyboardInput } from '../../io/keyboard';
import { PracticeController } from '../practice/PracticeController';
import { ChartPlayer } from '../preview/ChartPlayer';
import { PixelImage } from '../ui/pixel/PixelObjects';
import { motionAllowed } from '../motion';
import { spokenLine, spokenPages, talkColour } from '../ui/pixel/talkArt';
import { outlinedNote, RAG_KNOT, TOKEN_SIZE, tugBoardPicture, tugRag, tugToken } from '../ui/pixel/tugArt';
import type { TalkPlace } from './talkView';

/** How long the fact after a student's phrase stays before the next turn, and the pause after the character's phrase. */
const FACT_MS = 2500;
const AFTER_PHRASE_MS = 400;
/** The rag's tails lift in the draught every so often, and still when motion is off. */
const RAG_FLAP_MS = 700;
/** How far the character's rising notes drift sideways as they rise, layout cells. */
const RISING_DRIFT = 14;

export interface TugDevices {
  readonly piano: PianoSound;
  readonly clock: SongClock;
  readonly keyboard: KeyboardInput;
  readonly metronome: MetronomeSound;
}

export interface TugHandlers {
  /** The character plays (true) or listens (false): its figure shows its state. */
  playing(on: boolean): void;
  /** The view is over: the tug won, lost or left (the scene keeps its result), or never started (no outcome). */
  ended(state: TugState): void;
}

/** A key from content, when the catalog has it. */
const knownKey = (key: string): StringKey | null => (key in strings ? (key as StringKey) : null);

/**
 * The tug drawn over a scene (ft_1_21.AC2, AC4 to AC7, WP-13 on WP-10's `tug.ts`): the character plays its phrase of the
 * piece (its sound, at the piece's tempo, the figure playing), then the student plays the next from memory with no staff
 * (level 1: Wait mode where a wrong key moves on, d100), each student phrase judged by the core, and the fact said over
 * the character's head. The standing stays on screen as one marker. A press during the closing line, or Esc at any time,
 * ends it. The rules are `core/exchange`; this only plays, listens and draws.
 * Levels 2 and 3 (AC6, d100) are Tempo mode at the piece's tempo: a bar is counted in, the character plays its phrase and
 * the student's next phrase starts on the beat after it, with no new count-in; at level 2 the click goes on through both,
 * at level 3 only the count-in is heard. AX-3 provisional: each pair of phrases gets its own count-in after the fact.
 */
export class TugView {
  private state: TugState;
  private readonly player: ChartPlayer;
  private controller: PracticeController | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  /** What the character says now (a fact or its closing line), or nothing. */
  private saying: string | null = null;
  private closing = false;
  /** Who plays now: the character's phrase sounds, or the student's is listened to; null between turns. */
  private playingNow: 'character' | 'student' | null = null;
  /** The student's phrase while it is listened to (the self-playing demo plays it). */
  private listeningTo: Chart | null = null;
  /** The first turn was played (the standing shows from then on). */
  private started = false;
  private done = false;
  private readonly pickup: boolean;
  private readonly level: 1 | 2 | 3;
  private readonly mode: 'wait' | 'tempo';
  /** The clock of the student's phrase in Tempo mode; null in Wait mode and between phrases. */
  private transport: Transport | null = null;
  /** What moves while the tug plays (the rag, the bobbing note, the rising notes), stepped every frame by `update`. */
  private movers: ((ms: number) => void)[] = [];

  private constructor(
    private readonly scene: Phaser.Scene,
    private layer: Phaser.GameObjects.Container,
    private readonly chart: Chart,
    /** Who plays against the student: the character, or Kiur in a practice tug (AC14); its id picks its colour and closing lines. */
    private readonly character: { readonly id: string },
    private readonly rules: TugRules,
    private readonly place: TalkPlace,
    private readonly devices: TugDevices,
    private readonly handlers: TugHandlers,
    level: 1 | 2 | 3,
    kind: TugSetup['kind'],
    /** The name of the prize a win gives (its ladder's rung for this level, ft_1_21.AC18), for the closing line's `{prize}`. */
    private readonly prize: string,
  ) {
    const setup = tugSetupOf(chart, kind, level);
    this.pickup = setup.pickup;
    this.level = level;
    this.mode = rules.levels[level - 1]!.mode;
    this.state = startTug(setup, rules);
    this.player = new ChartPlayer(devices.piano, devices.clock);
  }

  /**
   * Starts the tug on `chart` at `level` with `character`; its first turn plays at once. With `notYet` the tug does not
   * start: the character says that line (what practice it waits for, ft_1_06.AC15), and a press ends it with nothing played.
   * `kind` is `practiceTug` for Kiur's practice tug in the room (AC14): the same play, kept differently by the caller.
   */
  static open(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Container,
    input: { chart: Chart; character: { readonly id: string }; level: 1 | 2 | 3; rules: TugRules; place: TalkPlace; devices: TugDevices; notYet?: string; kind?: TugSetup['kind']; prize?: string },
    handlers: TugHandlers,
  ): TugView {
    const view = new TugView(scene, layer, input.chart, input.character, input.rules, input.place, input.devices, handlers, input.level, input.kind ?? 'tug', input.prize ?? '');
    if (input.notYet === undefined) view.play();
    else view.say(input.notYet);
    return view;
  }

  /** What the tug shows now, for the tests and the self-playing demo. */
  get view(): { who: 'character' | 'student' | null; turn: number; standing: number; outcome: TugState['outcome']; saying: string | null; closing: boolean; level: 1 | 2 | 3; mode: 'wait' | 'tempo' } {
    return { who: this.playingNow, turn: this.state.turn, standing: this.state.standing, outcome: this.state.outcome, saying: this.saying, closing: this.closing, level: this.level, mode: this.mode };
  }

  /** Tempo mode: when the student's phrase plays (song time of its tick), for the tests and the self-playing demo. */
  get studentTransport(): Transport | null {
    return this.transport;
  }

  /** Every frame: Tempo mode's judge follows the clock (a phrase is over once its last window has passed). */
  update(nowMs: number): void {
    this.controller?.advance(nowMs);
    const ms = motionAllowed() ? this.scene.time.now : 0;
    for (const move of this.movers) move(ms);
  }

  /** The phrase the student is to play now (in Tempo mode from the count-in on, while the character plays); null otherwise. */
  get studentPhrase(): Chart | null {
    return this.listeningTo;
  }

  /** The finished or running tug, for the scene. */
  get tug(): TugState {
    return this.state;
  }

  /**
   * Keys while the tug is open: Esc leaves; Space or Enter ends the closing line, and with Tab they never reach the buttons
   * under the tug. Every other key is left alone: the computer keys may be the piano (the QWERTY keyboard).
   */
  key(e: KeyboardEvent): boolean {
    if (this.done) return false;
    if (e.key === 'Escape') this.leave();
    else if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat && this.closing) this.finish(); }
    else if (e.key !== 'Tab') return false;
    return true;
  }

  /** A press on the screen: only the closing line takes it (a phrase is never skipped, AX-0). */
  press(): void {
    if (this.closing) this.finish();
  }

  /** Esc: the tug ends here; nothing is won or lost (`leaveTug`). */
  leave(): void {
    if (this.done) return;
    if (this.state.outcome === undefined) this.state = leaveTug(this.state);
    this.finish();
  }

  /** The tests and the demo: the character's phrase ends now, as if it had been played. */
  endPhrase(): void {
    if (!this.player.isPlaying) return;
    this.player.stop();
    this.afterCharacter();
  }

  /** Remove what the tug drew. */
  clear(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
    this.movers = [];
  }

  /** Draw again where the screen now is (after the scene was drawn again on a resize). */
  redrawIn(layer: Phaser.GameObjects.Container): void {
    this.layer = layer;
    this.draw();
  }

  /** The scene closes under the tug: silence it and stop listening, with nothing kept. */
  stop(): void {
    this.done = true;
    this.halt();
    this.clear();
  }

  private halt(): void {
    this.playingNow = null;
    this.listeningTo = null;
    this.timer?.remove();
    this.timer = null;
    this.player.stop();
    if (this.mode === 'tempo') this.devices.metronome.stop();
    this.controller?.dispose();
    this.controller = null;
    this.transport = null;
  }

  private play(): void {
    this.saying = null;
    const turn = this.state.plan.turns[this.state.turn]!;
    const phrase = this.phraseOf(this.state.turn);
    this.playingNow = turn.who;
    this.started = true;
    this.draw();
    if (this.mode === 'tempo') return this.playInTempo(turn.who, phrase);
    if (turn.who === 'character') {
      this.handlers.playing(true);
      this.player.start(playbackNotes(phrase), playbackLengthMs(phrase), () => this.afterCharacter());
      return;
    }
    this.listen(phrase, new WaitMode(phrase, { moveOnWrong: true }));
  }

  /** The chart of turn `index`'s phrase. */
  private phraseOf(index: number): Chart {
    const { first, last } = turnChartBars(this.state.plan.turns[index]!.bars, this.pickup);
    return sliceChart(this.chart, first, last);
  }

  /**
   * Tempo mode: a bar counted in, then the character's phrase and, on the beat after it, the student's next one; or the
   * student's phrase alone after the count-in when it is the student's turn first.
   */
  private playInTempo(who: 'character' | 'student', phrase: Chart): void {
    const next = this.state.plan.turns[this.state.turn + 1];
    const studentPhrase = who === 'student' ? phrase : next?.who === 'student' ? this.phraseOf(this.state.turn + 1) : null;
    const countInMs = new Transport(phrase).countInMs;
    const characterMs = who === 'character' ? playbackLengthMs(phrase) : 0;
    const notes = who === 'character' ? playbackNotes(phrase).map((n) => ({ ...n, startMs: n.startMs + countInMs, endMs: n.endMs + countInMs })) : [];
    // the player starts its lead-in now: its time 0 is the count-in's first beat
    this.player.start(notes, countInMs + characterMs, () => (who === 'character' ? this.afterCharacter() : undefined));
    const startMs = this.devices.clock.nowMs() - (this.player.elapsedMs() ?? 0);
    const studentMs = studentPhrase ? playbackLengthMs(studentPhrase) : 0;
    const { bpm, beatsPerBar } = clickPlan(phrase, 100, 0);
    const beatMs = 60_000 / bpm;
    const countInBeats = Math.round(countInMs / beatMs);
    // level 2 clicks through both phrases, level 3 only counts in
    const beats = this.level === 2 ? countInBeats + Math.round((characterMs + studentMs) / beatMs) : countInBeats;
    this.devices.metronome.start({ bpm, beatsPerBar, startAtMs: startMs, beats });
    if (who === 'character') this.handlers.playing(true);
    if (!studentPhrase) return;
    const transport = new Transport(studentPhrase, { countInBars: 0 });
    transport.start(startMs + countInMs + characterMs);
    this.transport = transport;
    // the student's phrase is known from now on (the demo plays it on the transport); their turn shows once the
    // character's phrase is over (`afterCharacter`)
    this.listen(studentPhrase, new TempoMode(studentPhrase, transport));
  }

  /** The student's phrase is listened to and judged by `mode`. */
  private listen(phrase: Chart, mode: WaitMode | TempoMode): void {
    this.listeningTo = phrase;
    const reasons: string[] = [];
    this.controller = new PracticeController(phrase, this.devices.keyboard, {
      onChange: () => undefined,
      onJudged: (event: NoteJudged) => { if (event.verdict === 'wrong') reasons.push(event.reason); },
      onCompleted: (result: PieceResult) => this.afterStudent(result, reasons),
    }, undefined, mode);
  }

  private afterCharacter(): void {
    this.playingNow = null;
    this.handlers.playing(false);
    this.state = advanceTug(this.state, this.rules);
    // Tempo mode: the student's phrase is already on the clock, right after the character's
    if (this.controller && this.mode === 'tempo') {
      this.playingNow = 'student';
      this.draw();
      return;
    }
    this.next(AFTER_PHRASE_MS);
  }

  private afterStudent(result: PieceResult, reasons: readonly string[]): void {
    // the phrase is over: stop listening (the controller ignores its own callbacks once disposed)
    this.controller?.dispose();
    this.controller = null;
    this.playingNow = null;
    this.listeningTo = null;
    this.transport = null;
    this.state = advanceTug(this.state, this.rules, { share: studentShare(result, this.mode), hands: {}, reasons });
    const fact = tugFact(result, reasons, this.mode);
    const words = t(this.mode === 'tempo' ? 'tug.factTempo' : 'tug.fact', { right: fact.right, total: fact.total });
    this.saying = fact.reason === 'wrong-octave' ? `${words}. ${t('tug.wrongOctave')}` : words;
    this.draw();
    this.next(FACT_MS);
  }

  /** The next turn after `ms`, or the closing line once the tug is decided. */
  private next(ms: number): void {
    this.timer = this.scene.time.delayedCall(ms, () => {
      this.timer = null;
      if (this.done) return;
      if (this.state.outcome === undefined) return this.play();
      this.close();
    });
  }

  /** The character's line on the result (its content's `talk.<id>.tugWon` or `tugLost`); a press ends it. */
  private close(): void {
    const won = this.state.outcome === 'won';
    const key = knownKey(`talk.${this.character.id}.${won ? 'tugWon' : 'tugLost'}`);
    if (key === null) return this.finish();
    const student = this.state.results;
    this.say(t(key, { right: student.filter((r) => r.passed).length, total: student.length, prize: this.prize }));
  }

  /** The character says `text`, and a press ends the view. */
  private say(text: string): void {
    this.closing = true;
    this.saying = text;
    this.handlers.playing(true);
    this.draw();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.closing = false;
    this.halt();
    this.clear();
    this.handlers.playing(false);
    this.handlers.ended(this.state);
  }

  private add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.layer.add(object);
    this.objects.push(object);
    return object;
  }

  private draw(): void {
    this.clear();
    if (this.done) return;
    const { area } = this.place;
    // a press anywhere is the tug's: the scene and the band under it take none while it is open
    const catcher = this.add(this.scene.add.zone(0, -area.h, area.w, area.h * 3).setOrigin(0).setInteractive());
    catcher.on('pointerup', () => this.press());
    if (this.started) this.drawBoard();
    if (this.playingNow === 'character') this.drawRising();
    if (this.saying !== null) {
      const words = spokenLine(spokenPages(this.saying)[0] ?? [], talkColour('character', this.character.id));
      const spot = lineSpot({ head: this.place.head, size: { w: words.width, h: words.height }, area });
      this.add(new PixelImage(this.scene, spot.x, spot.y, words).setName('tugLine'));
    }
  }

  /**
   * The tug's board over the band (take B of sketch 1): the rope between the two tokens, the rag where the standing is,
   * and a note bobbing over the token of whoever plays now. `core/layout/tug.ts` places it; `tugArt.ts` paints it.
   */
  private drawBoard(): void {
    const { area, bandTop } = this.place;
    const top = bandTop ?? area.h - BOARD_ROWS;
    const board = tugBoard(area.w, this.rules.steps);
    const ends = { student: talkColour('student'), character: talkColour('character', this.character.id) };
    this.add(new PixelImage(this.scene, 0, top, tugBoardPicture(area.w, this.rules.steps, ends)).setName('tugBoard'));
    // once it is decided, the winner's token stays lit while the closing line is said
    const won = this.closing ? this.state.outcome : undefined;
    const half = Math.floor(TOKEN_SIZE / 2);
    const tokens = [
      { at: board.student, of: 'student' as const, lit: this.playingNow === 'student' || won === 'won', name: 'tugYourTurn', colour: talkColour('student') },
      { at: board.character, of: { character: this.character.id }, lit: this.playingNow === 'character' || won === 'lost', name: 'tugTheirTurn', colour: talkColour('character', this.character.id) },
    ];
    for (const token of tokens) {
      this.add(new PixelImage(this.scene, token.at.x - half, top + token.at.y - half, tugToken(token.of, token.lit)));
      if (!token.lit) continue;
      // whose turn it is: a note bobbing over their token (no words, the clean screen rule)
      const note = outlinedNote(token.colour);
      const x = token.at.x - Math.floor(note.width / 2), y = top + token.at.y - half - TUG.noteOver - note.height;
      const image = this.add(new PixelImage(this.scene, x, y, note).setName(token.name));
      this.movers.push((ms) => image.setY(y + turnNoteBob(ms)));
    }
    const rag = ragPlace(board, this.state.standing);
    const looks = [tugRag(0), tugRag(1)].map((look) => this.add(new PixelImage(this.scene, rag.x - RAG_KNOT.x, top + rag.y - RAG_KNOT.y, look).setName('tugMarker')));
    looks[1]!.setVisible(false);
    this.movers.push((ms) => {
      const flap = Math.floor(ms / RAG_FLAP_MS) % 4 === 3;
      looks[0]!.setVisible(!flap);
      looks[1]!.setVisible(flap);
    });
  }

  /** While the character plays, notes in its colour rise from its head, one after another. */
  private drawRising(): void {
    const { head, area } = this.place;
    const note = outlinedNote(talkColour('character', this.character.id));
    const from = { x: head.x - Math.floor(note.width / 2), y: head.y - TUG.noteOver - note.height };
    // they drift toward the open middle of the picture, away from its edge and the corner buttons
    const drift = head.x < area.w / 2 ? RISING_DRIFT : -RISING_DRIFT;
    const images = risingNotes(0, drift).map(() => this.add(new PixelImage(this.scene, from.x, from.y, note).setName('tugRising')));
    const place = (ms: number) => risingNotes(ms, drift).forEach((n, i) => images[i]!.setPosition(from.x + n.dx, from.y + n.dy).setVisible(n.shown));
    place(motionAllowed() ? this.scene.time.now : 0);
    this.movers.push(place);
  }
}
