import { circleHit, circleLayout, keyAt, moveStep, spellingsOf, stepOfKey, tonicStep, withFlat, type CircleKey, type CircleLayout, type CircleRing } from '../core/layout/circleOfFifths';
import { pitchClass } from '../core/chart/pitch';
import { keyNames } from '../core/editor/key';
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
/** The panel's margin inside the main area, and the room inside the panel, in art pixels. */
const PANEL_MARGIN = 3;
const PAD = 5;
/** One note of the scale as the game plays it: about 100 beats a minute (AX-3 provisional). */
const NOTE_MS = 600;
const VELOCITY = 80;
/** The scale's staff starts this far under the panel's top, below the key's name. */
const STAFF_TOP = 30;

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
      if (event.kind === 'on' && event.velocity > 0) this.choose(tonicStep(pitchClass(event.midi), this.selected.ring), this.selected.ring, false);
    }));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || !this.layout) return;
      const hit = circleHit(this.layout, (pointer.x - this.root.x) / this.px.scale, (pointer.y - this.root.y) / this.px.scale);
      if (hit) this.choose(hit.step, hit.ring, true);
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
      ArrowLeft: () => this.choose(moveStep(step, -1), ring, true),
      ArrowRight: () => this.choose(moveStep(step, 1), ring, true),
      ArrowUp: () => this.choose(step, 'major', true),
      ArrowDown: () => this.choose(step, 'minor', true),
      Enter: () => this.playScale(),
      ' ': () => this.playScale(),
    };
    const action = act[e.key];
    if (!action) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) action();
  }

  /** The fifths counts whose spelling wins where a step has two: the piece's key, then the key chosen. */
  private get prefer(): number[] {
    return [this.pieceKey?.fifths, this.selectedKey.fifths].filter((f): f is number => f !== undefined);
  }

  /** Choose a key: its name, signature and scale are drawn; `play` plays the scale (a click or an arrow, not a key the student played). */
  private choose(step: number, ring: CircleRing, play: boolean): void {
    this.stopScale();
    this.selected = { step, ring };
    const prefer = this.pieceKey ? [this.pieceKey.fifths] : [];
    this.selectedKey = keyAt(step, ring, prefer);
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
    const panel = { x: PANEL_MARGIN, y: PANEL_MARGIN, w: width - 2 * PANEL_MARGIN, h: this.mainRows - 2 * PANEL_MARGIN };
    this.parchmentCard(panel);

    // the wheel on the left, as big as the panel's height allows
    const radius = Math.floor((panel.h - 2 * PAD) / 2) - WHEEL_MARGIN;
    const cx = panel.x + PAD + WHEEL_MARGIN + radius;
    const cy = panel.y + Math.floor(panel.h / 2);
    const layout = circleLayout({ cx, cy, radius }, naming, this.prefer);
    this.layout = layout;
    const marked = this.pieceKey ? stepOfKey(this.pieceKey) : null;
    const wheel = paintWheel(layout, { selected: this.selected, marked });
    this.root.add(new PixelImage(this, cx - (wheel.width - 1) / 2, cy - (wheel.height - 1) / 2, wheel));
    for (const step of layout.steps) {
      this.name(step.major, step.majorAt, C.ink);
      this.name(step.minor, step.minorAt, C.featherStreak);
      this.signs(step.signs, step.signAt);
    }

    // beside it: the chosen key's name, a Listen button, and its scale on a staff with its signature
    const right = cx + radius + WHEEL_MARGIN + PAD + 4;
    const rightW = panel.x + panel.w - PAD - right;
    const names = keyNames(this.selectedKey.fifths, naming);
    const title = this.selectedKey.mode === 'major' ? t('circle.major', { key: withFlat(names.major) }) : t('circle.minor', { key: withFlat(names.minor.toLowerCase()) });
    // keepCase: the key's name is written as on the circle, the b of a flat and the small letter of a minor key included
    const heading = new PixelText(this, right, panel.y + PAD + 2, title, { color: C.ink, keepCase: true }).setScale(2);
    this.root.add(heading);
    const buttonY = panel.y + PAD + 8;
    const closeX = panel.x + panel.w - PAD - 11;
    // opened to choose (rule 8): a tick with the signature for each spelling of the step chosen, before Close; two where the
    // step has two (F sharp or G flat), so every one of the fifteen signatures can be set
    const spellings = this.choosing ? spellingsOf(this.selected.step).sort((x, y) => y - x) : [];
    let left = closeX - 11;
    for (const fifths of [...spellings].reverse()) {
      const key: CircleKey = { fifths, mode: this.selectedKey.mode };
      const spelled = keyNames(fifths, naming);
      const name = key.mode === 'major' ? t('circle.major', { key: withFlat(spelled.major) }) : t('circle.minor', { key: withFlat(spelled.minor.toLowerCase()) });
      // C major and a minor have no signs to show: a tick says the same
      const picture = fifths === 0 ? TOOL_ICONS.tick : signatureIcon(fifths);
      const w = Math.max(22, picture.width + 8);
      left -= w + 2;
      this.button({ x: left + w / 2, y: buttonY, width: w, height: BAR_BUTTON_HEIGHT, label: t('circle.use', { key: name }), icon: picture, iconOnly: true, tooltip: t('circle.use', { key: name }), onClick: () => this.take(key) });
    }
    const listenX = Math.min(right + heading.width * 2 + 6 + 11, left - 2 - 11);
    this.button({ x: listenX, y: buttonY, width: 22, height: BAR_BUTTON_HEIGHT, label: t('circle.listen'), icon: ICONS.ear, iconOnly: true, onClick: () => this.playScale() });
    this.button({ x: closeX, y: buttonY, width: 22, height: BAR_BUTTON_HEIGHT, label: t('circle.close'), icon: TOOL_ICONS.circle, iconOnly: true, onClick: () => this.close() });

    const staffTop = panel.y + STAFF_TOP;
    const staffRows = panel.h - STAFF_TOP - PAD;
    // one staff for every key, so choosing another key never moves or resizes it
    const staffLayout = circleScaleLayout(this.selectedKey.fifths, this.selectedKey.mode, {
      viewport: { width: rightW * scale, height: staffRows * scale }, ...staffSpaceLimits(this.scale.zoom), barsPerLine: 2, staffGap: profiles.staffGap, noteNaming: naming,
    });
    this.staff = new StaffView(this, staffLayout, undefined, { noteNames: false, fingers: false }, { x: this.root.x + right * scale, y: this.root.y + staffTop * scale });
  }

  /** A key's name with its middle at `at`, as written (`keepCase`: a minor's small letter); two spellings one above the other, a row apart (the helm's major ring is 15 rows deep). */
  private name(value: string, at: { x: number; y: number }, color: number): void {
    const lines = value.split('/');
    lines.forEach((line, i) => {
      const text = new PixelText(this, 0, 0, withFlat(line), { color, keepCase: true });
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
