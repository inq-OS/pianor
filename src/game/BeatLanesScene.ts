import type Phaser from 'phaser';
import { sliceChart, type Chart } from '../core/chart';
import { learnBeatLanes } from '../core/learn/progress';
import type { PaceMark } from '../core/layout/beat';
import { clampLaneOffset, defaultLaneLook, LANE_LIMITS, LANE_OFFSET_STEP, laneAt, laneDots, type LaneLook } from '../core/layout/beatLane';
import { layoutStaff, type StaffLayout } from '../core/layout/staff';
import { t, type StringKey } from '../core/text/strings';
import { contextOf } from './context';
import type { SettingsData } from './SettingsScene';
import { CANCELLED, closeOverlay, freshData, settleOverlay } from './scenes';
import { LANE_ICONS, type LaneIconId } from './ui/pixel/laneArt';
import { C } from './ui/pixel/palette';
import { PixelScene, type MenuItem, type ToolbarItem } from './ui/pixel/PixelScene';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { StaffView } from './ui/staff/StaffView';

/** Where Back goes: the settings' learning page, or (`overlay`, opened over the practice screen) back to the piece. */
export interface BeatLanesData {
  returnTo?: SettingsData;
  overlay?: boolean;
}

/** The piece the preview plays: two bars of a two-hand piece, so both staves and the space between them show. */
const PREVIEW_PIECE = 'both-hands';
/** The preview's wave runs at this many ms a quarter, round and round its bars. */
const PREVIEW_QUARTER_MS = 600;
/** A press within this many staff spaces of a lane takes hold of it, and a right click there opens its bubble. */
const GRAB = 1.2;
/** A press that moves less than this (screen pixels) before it is let go is a click: it adds a lane. */
const CLICK_SLIP = 6;
/** The title's line in the strip of the door and the gear, below the book's blue top rim, and the room left after the door's plate. */
const TITLE_Y = 8;
const TITLE_ROOM = 4;
/** The hint's left edge, and how far above the sheet's torn foot it ends (art rows). */
const HINT_X = 12;
const HINT_FOOT = 5;
/** How strong the dots of the lane a click would add are drawn while the pointer rests there (d286). */
const GHOST_STRENGTH = 0.35;

type DotPart = keyof LaneLook['dots'];

/** One slider of a lane's bubble: what it tunes, its picture and word, its range and steps (`AX-3 provisional:` the steps). */
interface LaneSlider {
  icon: LaneIconId;
  label: StringKey;
  min: number;
  max: number;
  step: number;
  get: (look: LaneLook) => number;
  set: (look: LaneLook, value: number) => LaneLook;
}

const dotSlider = (part: DotPart, label: StringKey): LaneSlider => ({
  icon: part, label, min: 0, max: 1, step: 0.1,
  get: (look) => look.dots[part],
  set: (look, value) => ({ ...look, dots: { ...look.dots, [part]: value } }),
});

/** The sliders of a lane's bubble, slot by slot after its place (core_13 rule 10). */
const SLIDERS: readonly LaneSlider[] = [
  dotSlider('ghost', 'lanes.ghost'),
  dotSlider('beat', 'lanes.beat'),
  dotSlider('top', 'lanes.top'),
  dotSlider('bottom', 'lanes.bottom'),
  { icon: 'height', label: 'lanes.height', min: 0, max: LANE_LIMITS.height, step: 0.1, get: (l) => l.wave.height, set: (l, v) => ({ ...l, wave: { ...l.wave, height: v } }) },
  { icon: 'reach', label: 'lanes.reach', min: 0.05, max: LANE_LIMITS.reach, step: 0.05, get: (l) => l.wave.reach, set: (l, v) => ({ ...l, wave: { ...l.wave, reach: v } }) },
  { icon: 'move', label: 'lanes.move', min: -LANE_LIMITS.offset, max: LANE_LIMITS.offset, step: LANE_OFFSET_STEP, get: (l) => l.offset, set: (l, v) => ({ ...l, offset: clampLaneOffset(v) }) },
];

/**
 * Tuning the beat lanes (core_13 rule 10): a preview staff over the whole page with the wave running round its two bars.
 * A click on the staff away from a lane adds one there with the defaults (up to three; the lane it would add shows faintly
 * while the pointer rests there), a lane is dragged up or down, and a right click on a lane opens its bubble: where it runs
 * (or remove it), a slider for each kind of dot, the wave's height and width and the lane's place, and the blink. Whatever
 * the pointer rests on or a slider is dragged to shows on the preview at once; every change kept is saved for this player.
 */
export class BeatLanesScene extends PixelScene {
  private returnTo: SettingsData = { page: 1 };
  private overlay = false;
  private lanes: LaneLook[] = [];
  /** The lane the bubble from More or the keyboard tunes: the last one touched. */
  private selected = 0;
  private view: StaffView | null = null;
  private layout: StaffLayout | null = null;
  private chart: Chart | null = null;
  private loopTicks = 1;
  private saveFailed = false;
  /** A lane being dragged on the preview: which one, where the press began (screen y) and its place then. */
  private drag: { lane: number; fromY: number; offset: number } | null = null;
  /** A press away from the lanes, which adds one where it is let go unless it moved. */
  private press: { x: number; y: number } | null = null;
  /** Where the pointer rests on the preview (screen pixels), for the faint lane a click would add; null off it. */
  private hover: { x: number; y: number } | null = null;
  /** What the bubble shows on the preview before it is kept (d286): a lane as it would look; null for none. */
  private trial: { lane: number; look: LaneLook | null } | null = null;

  protected override keyboardNavigation = true;

  constructor() {
    super('beat-lanes');
    // the page's book reaches under the door and the gear: they stand on a plate, as on the other book screens (ft_1_20 rule 3)
    this.cornersOnCard = true;
  }

  init(data?: BeatLanesData): void {
    this.returnTo = data?.returnTo ?? { page: 1 };
    this.overlay = data?.overlay === true;
    // over the practice screen the page has no settings corner: Back is the only way, back to the piece
    this.toolbarPlayer = !this.overlay;
    this.lanes = learnBeatLanes(contextOf(this).profiles.learnSettings).map((l) => structuredClone(l));
    this.selected = 0;
    this.saveFailed = false;
    this.drag = null;
    this.press = null;
    this.hover = null;
    this.trial = null;
  }

  override create(): void {
    if (this.overlay) {
      this.scene.bringToTop();
      this.events.once('shutdown', () => settleOverlay('beat-lanes', CANCELLED, this));
    }
    super.create();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.moved(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.up(p));
  }

  protected override back(): void {
    this.game.canvas.style.cursor = '';
    if (this.overlay) closeOverlay(this, 'beat-lanes', 'closed');
    else this.scene.start('settings', freshData(this.returnTo));
  }

  override update(): void {
    if (!this.view || !this.chart) return;
    // the wave goes round the preview's bars at a steady pace, so each change shows as it will in play
    const wave = ((this.time.now / PREVIEW_QUARTER_MS) * this.chart.ppq) % this.loopTicks;
    this.view.moveLane(wave, this.marks());
  }

  /** Two keys of the preview coloured against a pace, as a learning run colours them: one even, one late. */
  private marks(): ReadonlyMap<number, Pick<PaceMark, 'side' | 'far'>> {
    const ppq = this.chart?.ppq ?? 480;
    return new Map([[2 * ppq, { side: 'even', far: false }], [4 * ppq, { side: 'late', far: false }]]);
  }

  protected draw(): void {
    const { width } = this.px;
    this.sky();
    this.openBook({ x: 3, y: 3, w: width - 6, h: this.px.height - 5 });
    this.inkWriting = true;
    const strip = this.cornerStrip;
    const rows = this.mainRows - strip.rows - 2;
    this.drawPreview(strip.rows + 1, rows);
    // the title below the book's top rim, clear of the door's plate
    this.label(strip.left + TITLE_ROOM, TITLE_Y, t('lanes.title'), C.gold);
    // at the sheet's foot, below where any lane can run: how the page is used, or a failed save
    const hint = this.label(HINT_X, 0, this.saveFailed ? t('settings.saveFailed') : t('lanes.hint'), this.saveFailed ? C.gold : C.dim, { maxWidth: width - 2 * HINT_X });
    hint.y = strip.rows + 1 + rows - hint.height - HINT_FOOT;
    // the preview's sheet is drawn over the page: the hint stands on it
    this.root.remove(hint);
    this.overStaff().add(hint);
  }

  /** The preview staff over the whole width, `top` art rows down and `rows` high, with the lanes as they are now. */
  private drawPreview(top: number, rows: number): void {
    const piece = contextOf(this).pieces.find(PREVIEW_PIECE) ?? contextOf(this).pieces.list().find((p) => p.chart.tracks.filter((tr) => tr.role === 'play').length === 2);
    if (!piece) return;
    const bars = Math.min(2, piece.chart.bars.length);
    const chart = sliceChart(piece.chart, 0, bars - 1);
    this.chart = chart;
    this.loopTicks = chart.bars[bars - 1]!.endTick;
    const scale = this.px.scale;
    const area = { top: this.mainTop + top * scale, width: this.scale.width, height: rows * scale };
    const profiles = contextOf(this).profiles;
    this.layout = layoutStaff(chart, { viewport: { width: area.width, height: area.height }, staffGap: profiles.staffGap, noteNaming: profiles.noteNaming });
    this.view = this.own(new StaffView(this, this.layout, undefined, { noteNames: false, fingers: false }, { x: 0, y: area.top }));
    this.showLanes();
  }

  /** The lanes as the preview shows them: as they are, the one tried in the bubble as it would be, and the one a click would add. */
  private shownLooks(): LaneLook[] {
    const looks = this.lanes.flatMap((look, i) => {
      if (this.trial?.lane !== i) return [look];
      return this.trial.look ? [this.trial.look] : [];
    });
    const add = this.addAt();
    if (add) looks.push({ ...add, dots: { ghost: GHOST_STRENGTH, beat: GHOST_STRENGTH, top: GHOST_STRENGTH, bottom: GHOST_STRENGTH } });
    return looks;
  }

  /** Give the preview the lanes as they are now (also while one is dragged or tried). */
  private showLanes(): void {
    if (!this.view || !this.layout || !this.chart) return;
    const layout = this.layout;
    const chart = this.chart;
    this.view.setLanes(this.shownLooks().map((look) => ({ dots: laneDots(layout, chart, look.place, look.offset), look })), chart.ppq);
  }

  /** The lane a click where the pointer rests would add, or null (off the preview, on a lane, at the most lanes, the bubble open). */
  private addAt(): LaneLook | null {
    const at = this.hover;
    if (!at || this.drag || this.menuOpen || this.lanes.length >= LANE_LIMITS.lanes || this.laneNear(at.y) >= 0 || !this.onPreview(at)) return null;
    return this.newLane(at.y);
  }

  /** A lane with the defaults where a click at screen `y` puts it. */
  private newLane(y: number): LaneLook | null {
    if (!this.layout || !this.view) return null;
    const { place, offset } = laneAt(this.layout, 0, y - this.view.origin.y);
    return { ...defaultLaneLook(place), offset };
  }

  /** Whether screen point `p` is on the preview staff (and, for a press, not on a button over it, such as the bubble's). */
  private onPreview(p: { x: number; y: number }, press = true): boolean {
    if (!this.view || !this.layout) return false;
    return p.y >= this.view.origin.y && p.y <= this.view.origin.y + this.layout.height && !(press && this.pointerOnButton(p));
  }

  /** The y on the screen of each lane on the preview's first line, as drawn now. */
  private laneYs(): number[] {
    const layout = this.layout;
    const chart = this.chart;
    if (!layout || !chart || !this.view) return [];
    return this.lanes.map((look) => (laneDots(layout, chart, look.place, look.offset)[0]?.y ?? -1e9) + this.view!.origin.y);
  }

  /** The lane nearest screen `y` within reach of a press, or -1. */
  private laneNear(y: number): number {
    const S = this.layout?.staffSpace ?? 0;
    if (!(S > 0)) return -1;
    const ys = this.laneYs();
    let best = -1;
    ys.forEach((ly, i) => {
      if (Math.abs(y - ly) <= GRAB * S && (best < 0 || Math.abs(y - ly) < Math.abs(y - ys[best]!))) best = i;
    });
    return best;
  }

  /** A left press near a lane takes hold of it (and chooses it); away from the lanes it may become a click that adds one. */
  private down(p: Phaser.Input.Pointer): void {
    if (this.menuOpen || p.rightButtonDown() || !this.onPreview(p)) return;
    const lane = this.laneNear(p.y);
    if (lane >= 0) {
      this.drag = { lane, fromY: p.y, offset: this.lanes[lane]!.offset };
      this.selected = lane;
      return;
    }
    this.press = { x: p.x, y: p.y };
    // a finger has no hover: the lane a lift would add shows while it is down (d286)
    this.hover = { x: p.x, y: p.y };
    this.showLanes();
  }

  /** While held, the lane follows the pointer up and down; otherwise the faint lane a click would add follows it. */
  private moved(p: Phaser.Input.Pointer): void {
    const drag = this.drag;
    const S = this.layout?.staffSpace ?? 0;
    if (drag && p.isDown && S > 0) {
      const lane = this.lanes[drag.lane];
      if (!lane) return;
      const offset = clampLaneOffset(drag.offset + (p.y - drag.fromY) / S);
      if (offset === lane.offset) return;
      lane.offset = offset;
      this.showLanes();
      return;
    }
    // a lane under the pointer can be dragged up and down
    this.game.canvas.style.cursor = this.drag || (this.onPreview(p) && !this.menuOpen && this.laneNear(p.y) >= 0) ? 'ns-resize' : '';
    const before = this.addAt();
    this.hover = { x: p.x, y: p.y };
    const after = this.addAt();
    if (before?.place !== after?.place || before?.offset !== after?.offset) this.showLanes();
  }

  /** Let go: a dragged lane stays where it was dropped; a click away from the lanes adds one there. */
  private up(p: Phaser.Input.Pointer): void {
    if (this.drag) {
      this.drag = null;
      void this.save();
      return;
    }
    const press = this.press;
    this.press = null;
    if (!press || this.menuOpen || Math.hypot(p.x - press.x, p.y - press.y) > CLICK_SLIP) return;
    this.addLane(press.y);
  }

  /** A new lane with the defaults where screen `y` is (the default place without one), while there is room for it. */
  private addLane(y: number | null): void {
    if (this.lanes.length >= LANE_LIMITS.lanes) return;
    const look = y === null ? defaultLaneLook(this.lanes.some((l) => l.place === 'between') ? 'above' : 'between') : this.newLane(y);
    if (!look) return;
    this.lanes.push(look);
    this.selected = this.lanes.length - 1;
    void this.save();
  }

  /** A bubble on the preview: a lane's own, or adding one where the press was. */
  protected override hasBubbleAt(at: { x: number; y: number }): boolean {
    return this.bubbleOptions(at) !== null;
  }

  protected override bubbleOptions(at: { x: number; y: number } | null): (ToolbarItem | null)[] | null {
    if (at === null) return this.lanes[this.selected] ? this.laneOptions(this.selected, true) : [this.addOption(null)];
    const screen = { x: this.root.x + at.x * this.px.scale, y: this.root.y + at.y * this.px.scale };
    // asked again with the bubble open (an option opening its slider), its own buttons are over the place
    if (!this.onPreview(screen, false)) return null;
    const lane = this.laneNear(screen.y);
    if (lane >= 0) {
      this.selected = lane;
      return this.laneOptions(lane);
    }
    return this.lanes.length < LANE_LIMITS.lanes ? [this.addOption(screen.y)] : null;
  }

  private addOption(y: number | null): ToolbarItem {
    return { label: t('lanes.add'), icon: LANE_ICONS.add, onClick: () => this.addLane(y) };
  }

  /**
   * The bubble of lane `i` (core_13 rule 10): 0 where it runs (above, between, or taken away), 1 to 4 a slider for each kind
   * of dot, 5 the wave's height, 6 the blink; More turns to the wave's width and the lane's place up or down, and (from More
   * or the keyboard) a new lane and the next lane to tune.
   */
  private laneOptions(i: number, fromMore = false): (ToolbarItem | null)[] {
    const look = this.lanes[i]!;
    const tryLook = (next: LaneLook | null) => (on: boolean) => this.tryOut(i, on ? next : undefined);
    const placeItem = (place: LaneLook['place'], key: StringKey): MenuItem => ({
      label: t(key), icon: LANE_ICONS[place], active: look.place === place, preview: tryLook({ ...look, place, offset: 0 }),
      onPick: () => this.keep(i, { ...look, place, offset: 0 }),
    });
    const place: ToolbarItem = {
      label: t('lanes.place'), icon: LANE_ICONS[look.place], onClick: () => undefined,
      menu: {
        items: () => [placeItem('above', 'settings.beatLaneAbove'), placeItem('between', 'settings.beatLaneBetween'), { label: t('lanes.remove'), icon: TOOL_ICONS.trash, preview: tryLook(null), onPick: () => this.removeLane(i) }],
        cell: { w: 18, h: 18 }, columns: 3,
      },
    };
    const sliders = SLIDERS.map((s): ToolbarItem => ({
      label: t(s.label), icon: LANE_ICONS[s.icon], onClick: () => undefined,
      // the lane as it is when the knob moves: a slider kept stays open for another try
      slider: {
        value: s.get(look), min: s.min, max: s.max, step: s.step,
        change: (v) => this.tryOut(i, s.set(this.lanes[i] ?? look, v)), commit: (v) => this.keep(i, s.set(this.lanes[i] ?? look, v), false), cancel: () => this.tryOut(i, undefined),
      },
    }));
    const blinking = look.blink === true;
    const blink: ToolbarItem = {
      label: t('lanes.blink'), icon: LANE_ICONS.blink, active: blinking, preview: tryLook({ ...look, blink: !blinking }),
      onClick: () => this.keep(i, { ...look, blink: !blinking }),
    };
    // what the wave follows: the student's own pace, or the metronome's beats while it clicks (core_13.AC9)
    const followItem = (follow: LaneLook['follow'], key: StringKey, icon: keyof typeof TOOL_ICONS): MenuItem => ({
      label: t(key), icon: TOOL_ICONS[icon], active: look.follow === follow, preview: tryLook({ ...look, follow }),
      onPick: () => this.keep(i, { ...look, follow }),
    });
    const follow: ToolbarItem = {
      label: t('lanes.follow'), icon: TOOL_ICONS[look.follow === 'click' ? 'click' : 'fingers'], onClick: () => undefined,
      menu: { items: () => [followItem(undefined, 'lanes.followPace', 'fingers'), followItem('click', 'lanes.followClick', 'click')], cell: { w: 18, h: 18 }, columns: 2 },
    };
    const [ghost, beat, top, bottom, height, reach, move] = sliders;
    // from More or the keyboard (no lane under a pointer): a new lane, and the next lane to tune
    const keyboard: (ToolbarItem | null)[] = fromMore
      ? [
          this.lanes.length < LANE_LIMITS.lanes ? this.addOption(null) : null,
          this.lanes.length > 1 ? { label: t('lanes.next'), icon: LANE_ICONS.next, onClick: () => this.nextLane() } : null,
        ]
      : [];
    return [place, ghost!, beat!, top!, bottom!, height!, blink, reach!, move!, follow, ...keyboard].filter((o, k) => o !== null || k < 7);
  }

  /** Tune the next lane: the bubble opens again for it (from More or the keyboard). */
  private nextLane(): void {
    this.selected = (this.selected + 1) % Math.max(1, this.lanes.length);
    this.time.delayedCall(0, () => this.openBubble(null, { page: 0 }));
  }

  /** Show lane `i` as `look` would draw it (null: without it) while the bubble tries it; undefined shows it as it is again. */
  private tryOut(i: number, look: LaneLook | null | undefined): void {
    this.trial = look === undefined ? null : { lane: i, look };
    this.showLanes();
  }

  /** Keep `look` for lane `i` and save it; `redraw` false leaves the screen (and an open slider) as it is. */
  private keep(i: number, look: LaneLook, redraw = true): void {
    if (!this.lanes[i]) return;
    this.trial = null;
    this.lanes[i] = look;
    void this.save(redraw);
  }

  private removeLane(i: number): void {
    this.trial = null;
    this.lanes.splice(i, 1);
    this.selected = Math.max(0, Math.min(this.selected, this.lanes.length - 1));
    void this.save();
  }

  /** Save the lanes for this player, then draw the screen again with them (or only the preview's lanes, unless the save failed). */
  private async save(redraw = true): Promise<void> {
    const saved = await contextOf(this).profiles.updateLearnSettings({ beatLanes: this.lanes });
    this.saveFailed = !saved;
    if (redraw || !saved) this.redraw();
    else this.showLanes();
  }
}
