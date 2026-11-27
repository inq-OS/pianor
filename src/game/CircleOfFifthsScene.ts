import { CIRCLE_SCALE_BARS, chooseKey, circleHit, circleLayout, circlePanelLayout, keyAt, moveStep, otherSpelling, spellingsOf, stepOfKey, tonicStep, withFlat, type CircleKey, type CircleLayout, type CircleRing, type CircleStep, type CircleTarget } from '../core/layout/circleOfFifths';
import { frameCorners } from '../core/layout/frame';
import { pitchClass } from '../core/chart/pitch';
import { rectCentre } from '../core/layout/rect';
import { keyName, keyTonic } from '../core/editor/key';
import { language } from '../core/text/language';
import { circleScaleLayout } from '../core/trainer/staffFrame';
import { staffSpaceLimits } from '../core/layout/canvasSize';
import { scaleChart } from '../core/trainer/scaleChart';
import { t } from '../core/text/strings';
import { contextOf } from './context';
import { CANCELLED, closeOverlay, settleOverlay } from './scenes';
import { recolor } from './ui/pixel/bitmap';
import { paintWheel, WHEEL_MARGIN } from './ui/pixel/circleArt';
import { ICONS } from './ui/pixel/iconArt';
import { ACCIDENTAL_ICONS, signatureIcon } from './ui/pixel/lengthArt';
import { C, PALETTE } from './ui/pixel/palette';
import { drawnText, renderText } from './ui/pixel/font';
import { PixelImage, PixelText } from './ui/pixel/PixelObjects';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { BAR_BUTTON_HEIGHT } from './ui/pixel/playBars';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { StaffView } from './ui/staff/StaffView';

/** What the circle is opened with: the key of the piece on screen (rule 3), or none (the note-name trainer). */
export interface CircleData {
  key?: CircleKey | null;
  /** Opened to choose the piece's key (the piece maker): a tick per spelling hands the key back. */
  choose?: boolean;
}

/** How dark the paused screen under the overlay gets, in the room's dusk (as Kiur's door, art-direction rule 26). */
const DIM_ALPHA = 0.7;
/** One note of the scale as the game plays it: about 100 beats a minute (AX-3 provisional). */
const NOTE_MS = 600;
const VELOCITY = 80;

/**
 * The circle of fifths (ft_1_28): an overlay (d070) over the paused practice screen, note-name trainer or piece maker. Twelve
 * keys round a wheel, majors outside, their relative minors inside, the count of sharps or flats beyond. It is interactive:
 * a click on a key, or the arrows, chooses it; its name, its key signature and its scale stand on a
 * staff beside the wheel, and the game plays the scale with the cursor on each note. A key played on the piano chooses the
 * key with that tonic on the ring that is chosen. The piece's key is marked. Opened to choose (the piece maker, rule 8), a tick
 * for each spelling of the chosen step hands that key back; otherwise the overlay only shows, and it saves nothing.
 */
export class CircleOfFifthsScene extends PixelScene {
  protected override framed = false;
  private pieceKey: CircleKey | null = null;
  private choosing = false;
  private selected: { step: number; ring: CircleRing } = { step: 0, ring: 'major' };
  private layout: CircleLayout | null = null;
  private staff: StaffView | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];
  private sounding: number[] = [];
  /** The key chosen now and whether its scale is playing (read by the end-to-end test). */
  selectedKey: CircleKey = { fifths: 0, mode: 'major' };
  playing = false;

  constructor() {
    super('circle');
  }

  init(data: CircleData): void {
    this.pieceKey = data.key ?? null;
    this.choosing = data.choose ?? false;
    this.selected = this.pieceKey ? { step: stepOfKey(this.pieceKey), ring: this.pieceKey.mode } : { step: 0, ring: 'major' };
    this.selectedKey = this.pieceKey ?? { fifths: 0, mode: 'major' };
    this.playing = false;
  }

  override create(): void {
    this.scene.bringToTop();
    this.events.once('shutdown', () => {
      this.stopScale();
      settleOverlay('circle', CANCELLED, this);
    });
    // the keys are this overlay's own while it is open: the arrows, Enter and Esc stop here, ahead of the computer keyboard's piano
    this.onWindowKey((e) => this.onKey(e));
    this.events.once('shutdown', contextOf(this).keyboard.onNote((event) => {
      // a played tonic takes the spelling with fewer signs, or the piece's, and never switches the spelling (only a click or an arrow does)
      if (event.kind === 'on' && event.velocity > 0) this.choose(keyAt(tonicStep(pitchClass(event.midi), this.selected.ring), this.selected.ring, this.piecePrefer), false);
    }));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || !this.layout) return;
      // the screen's Back, dimmed under the overlay at the top left, closes the overlay as Esc does
      const back = frameCorners(this.px.width).back;
      const bx = (pointer.x - this.root.x) / this.px.scale - back.x;
      const by = pointer.y / this.px.scale - back.y;
      if (bx >= 0 && by >= 0 && bx < back.w && by < back.h) {
        this.close();
        return;
      }
      const hit = circleHit(this.layout, (pointer.x - this.root.x) / this.px.scale, (pointer.y - this.root.y) / this.px.scale);
      if (hit) this.go(hit);
    });
    super.create();
  }

  protected override back(): void {
    this.close();
  }

  private close(): void {
    this.stopScale();
    closeOverlay(this, 'circle', 'closed');
  }

  /** Sets the piece's key to this one (opened to choose): the piece maker takes it as an edit. */
  private take(key: CircleKey): void {
    this.stopScale();
    closeOverlay(this, 'circle', key);
  }

  private onKey(e: KeyboardEvent): void {
    const { step, ring } = this.selected;
    const act: Record<string, () => void> = {
      Escape: () => this.close(),
      ArrowLeft: () => this.go({ step: moveStep(step, -1), ring }),
      ArrowRight: () => this.go({ step: moveStep(step, 1), ring }),
      // up on the major ring (or down on the minor) again switches a two-spelling step's spelling, as a second click does
      ArrowUp: () => this.go({ step, ring: 'major' }),
      ArrowDown: () => this.go({ step, ring: 'minor' }),
      Enter: () => this.playScale(),
      ' ': () => this.playScale(),
    };
    const action = act[e.key];
    if (!action) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) action();
  }

  /** The fifths counts whose spelling the wheel shows where a step has two: the key chosen, then the piece's key. */
  private get prefer(): number[] {
    return [this.selectedKey.fifths, ...this.piecePrefer];
  }

  /** The piece's key, whose spelling a newly chosen step takes where it has two (rule 3). */
  private get piecePrefer(): number[] {
    return this.pieceKey ? [this.pieceKey.fifths] : [];
  }

  /** A click or an arrow: chooses the key it lands on (`chooseKey`, the spelling switching on a second press) and plays its scale. */
  private go(target: CircleTarget): void {
    this.choose(chooseKey(this.selectedKey, target, this.piecePrefer), true);
  }

  /** Switches the chosen key to its other spelling (the button by its name, "also G♭") and plays its scale. */
  private swap(): void {
    const other = otherSpelling(this.selectedKey);
    if (other) this.choose(other, true);
  }

  /** Choose a key: its name, signature and scale are drawn; `play` plays the scale (a click or an arrow, not a key the student played). */
  private choose(key: CircleKey, play: boolean): void {
    this.stopScale();
    this.selected = { step: stepOfKey(key), ring: key.mode };
    this.selectedKey = key;
    this.redraw();
    if (play) this.playScale();
  }

  /** The chosen key's scale, one note at a time, with the cursor on the note that sounds. */
  private playScale(): void {
    this.stopScale();
    const piano = contextOf(this).audio.piano;
    const notes = scaleChart(this.selectedKey.fifths, this.selectedKey.mode).notes;
    this.playing = true;
    notes.forEach((note, k) => {
      this.timers.push(this.time.delayedCall(k * NOTE_MS, () => {
        piano.noteOn(note.midi, VELOCITY);
        this.sounding.push(note.midi);
        this.staff?.setCursor([k]);
      }));
      this.timers.push(this.time.delayedCall((k + 1) * NOTE_MS - 40, () => piano.noteOff(note.midi)));
    });
    this.timers.push(this.time.delayedCall(notes.length * NOTE_MS, () => {
      this.playing = false;
      this.sounding = [];
      this.staff?.setCursor(null);
    }));
  }

  private stopScale(): void {
    this.timers.forEach((timer) => timer.remove(false));
    this.timers = [];
    const piano = contextOf(this).audio.piano;
    this.sounding.forEach((midi) => piano.noteOff(midi));
    this.sounding = [];
    this.playing = false;
    this.staff?.setCursor(null);
  }

  protected draw(): void {
    const { width, height, scale } = this.px;
    const { profiles } = contextOf(this);
    const naming = profiles.noteNaming;
    // the paused screen stays visible, in shade, toolbar included
    this.root.add(this.add.rectangle(0, -this.mainTop / scale, width, height + this.mainTop / scale, PALETTE[C.duskDeep], DIM_ALPHA).setOrigin(0, 0));

    // beside the wheel: the chosen key's name, a Listen button, and its scale on a staff with its signature
    const title = keyName(this.selectedKey.fifths, this.selectedKey.mode, naming);
    // keepCase: the key's name is written as on the circle, the small letter of a minor key included
    const heading = new PixelText(this, 0, 0, title, { color: C.ink, keepCase: true });
    // opened to choose (rule 8): a tick with the signature for each spelling of the step chosen, sharps first; two where the
    // step has two (F sharp or G flat), so every one of the fifteen signatures can be set
    const ticks = (this.choosing ? spellingsOf(this.selected.step).sort((x, y) => y - x) : []).map((fifths) => {
      const key: CircleKey = { fifths, mode: this.selectedKey.mode };
      const name = keyName(fifths, key.mode, naming);
      // C major and a minor have no signs to show: a tick says the same
      const picture = fifths === 0 ? TOOL_ICONS.tick : signatureIcon(fifths);
      return { key, name, picture, width: Math.max(22, picture.width + 8) };
    });
    // a key with two spellings has a switch to the other by its name ("also G♭"), so the second spelling is never hidden
    const other = otherSpelling(this.selectedKey);
    const otherShort = other && keyTonic(other.fifths, other.mode, naming, language());
    const otherTitle = other && keyName(other.fifths, other.mode, naming);
    const swapLabel = otherShort === null ? null : t('circle.also', { key: otherShort });
    const layout = circlePanelLayout({ width, rows: this.mainRows }, {
      heading: { w: heading.width, h: heading.height }, swap: swapLabel === null ? null : renderText(drawnText(swapLabel, true), { color: C.ink }).width + 10,
      ticks: ticks.map((tick) => tick.width), wheelMargin: WHEEL_MARGIN, button: { w: 22, h: BAR_BUTTON_HEIGHT },
    });
    this.parchmentCard(layout.panel);

    // the wheel on the left, as big as the panel's height allows
    const { cx, cy, radius } = layout.wheel;
    const circle = circleLayout({ cx, cy, radius }, naming, this.prefer);
    this.layout = circle;
    const marked = this.pieceKey ? stepOfKey(this.pieceKey) : null;
    const wheel = paintWheel(circle, { selected: { ...this.selected, fifths: this.selectedKey.fifths }, marked });
    this.root.add(new PixelImage(this, cx - (wheel.width - 1) / 2, cy - (wheel.height - 1) / 2, wheel));
    for (const step of circle.steps) {
      this.name(step.major, step.majorAt, C.ink, this.dimmed(step));
      this.name(step.minor, step.minorAt, C.featherStreak);
      this.signs(step.signs, step.signAt);
    }

    heading.setPosition(layout.heading.x, layout.heading.y).setScale(layout.heading.scale);
    this.root.add(heading);
    this.button({ ...rectCentre(layout.listen), label: t('circle.listen'), icon: ICONS.ear, iconOnly: true, onClick: () => this.playScale() });
    this.button({ ...rectCentre(layout.close), label: t('circle.close'), icon: TOOL_ICONS.close, iconOnly: true, tooltip: t('circle.close'), onClick: () => this.close() });
    if (layout.swap && swapLabel !== null && otherTitle !== null) {
      // keepCase: the key's name keeps its small letter for a minor and its flat sign
      this.button({ ...rectCentre(layout.swap), label: swapLabel, keepCase: true, tooltip: t('circle.alsoTip', { key: otherTitle }), onClick: () => this.swap() });
    }
    ticks.forEach((tick, i) => {
      const label = t('circle.use', { key: tick.name });
      this.button({ ...rectCentre(layout.ticks[i]!), label, icon: tick.picture, iconOnly: true, tooltip: label, onClick: () => this.take(tick.key) });
    });

    // one staff for every key, so choosing another key never moves or resizes it
    const room = layout.staff;
    const staffLayout = circleScaleLayout(this.selectedKey.fifths, this.selectedKey.mode, {
      viewport: { width: room.w * scale, height: room.h * scale }, ...staffSpaceLimits(this.scale.zoom), barsPerLine: CIRCLE_SCALE_BARS, staffGap: profiles.staffGap, noteNaming: naming,
    });
    this.staff = new StaffView(this, staffLayout, undefined, { noteNames: false, fingers: false }, { x: this.root.x + room.x * scale, y: this.root.y + room.y * scale });
  }

  /** On the chosen two-spelling step, which of its two major names is not the spelling chosen (drawn dim), or none. */
  private dimmed(step: CircleStep): number | null {
    if (step.fifths.length < 2 || step.index !== this.selected.step) return null;
    const at = step.fifths.indexOf(this.selectedKey.fifths);
    return at < 0 ? null : 1 - at;
  }

  /** A key's name with its middle at `at`, as written (`keepCase`: a minor's small letter); two spellings one above the other, a row apart (the helm's major ring is 15 rows deep), the line `dim` paler. */
  private name(value: string, at: { x: number; y: number }, color: number, dim: number | null = null): void {
    const lines = value.split('/');
    lines.forEach((line, i) => {
      const text = new PixelText(this, 0, 0, withFlat(line), { color: i === dim ? C.buffDeep : color, keepCase: true });
      text.setPosition(Math.round(at.x - text.width / 2), Math.round(at.y - 3 + (i - (lines.length - 1) / 2) * 8));
      this.root.add(text);
    });
  }

  /** The count of sharps or flats on its brass plate: the number and the sign, both counts at the bottom side by side; a 0 for C major and a minor, so no plate is empty. */
  private signs(signs: readonly { count: number; alter: number }[], at: { x: number; y: number }): void {
    const parts = signs.map((sign) => ({
      digit: new PixelText(this, 0, 0, String(sign.count), { color: C.ink, keepCase: true }),
      icon: sign.alter === 0 ? null : recolor(sign.alter > 0 ? ACCIDENTAL_ICONS.sharp : ACCIDENTAL_ICONS.flat, { [C.white]: C.ink }),
    }));
    const gap = 4;
    const width = (part: (typeof parts)[number]) => part.digit.width + (part.icon ? 1 + part.icon.width : 0);
    const total = parts.reduce((w, part) => w + width(part), 0) + gap * Math.max(0, parts.length - 1);
    let left = Math.round(at.x - total / 2);
    const top = Math.round(at.y - 3);
    for (const { digit, icon } of parts) {
      digit.setPosition(left, top);
      this.root.add(digit);
      if (icon) this.root.add(new PixelImage(this, left + digit.width + 1, top, icon));
      left += width({ digit, icon }) + gap;
    }
  }

  protected override clear(): void {
    this.staff?.destroy();
    this.staff = null;
    this.layout = null;
  }
}

/** The wheel button that opens the circle (rule 1), the same on the toolbar and in the band's slots. */
export function circleItem(onClick: () => void): ToolbarItem {
  return { label: t('circle.open'), icon: TOOL_ICONS.circle, iconOnly: true, tooltip: t('circle.open'), onClick };
}
