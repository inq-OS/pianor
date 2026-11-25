import type Phaser from 'phaser';
import { sliceChart, type Chart } from '../core/chart';
import { learnBeatLanes } from '../core/learn/progress';
import type { PaceMark } from '../core/layout/beat';
import { defaultLaneLook, LANE_LIMITS, laneDots, type LaneLook } from '../core/layout/beatLane';
import { layoutStaff, type StaffLayout } from '../core/layout/staff';
import { t, type StringKey } from '../core/text/strings';
import { contextOf } from './context';
import type { SettingsData } from './SettingsScene';
import { freshData } from './scenes';
import type { Bitmap } from './ui/pixel/bitmap';
import { ICONS } from './ui/pixel/iconArt';
import { C } from './ui/pixel/palette';
import { PixelScene } from './ui/pixel/PixelScene';
import { beatLaneSymbol, laneDotsSymbol, laneWaveSymbol, SYMBOL_HEIGHT, SYMBOL_WIDTH, type LaneDotPart } from './ui/pixel/settingArt';
import { StaffView } from './ui/staff/StaffView';

/** Where Back goes: the settings' learning page, or the screen it was opened from. */
export interface BeatLanesData {
  returnTo?: SettingsData;
}

/** The piece the preview plays: two bars of a two-hand piece, so both staves and the space between them show. */
const PREVIEW_PIECE = 'both-hands';
/** The preview's wave runs at this many ms a quarter, round and round its bars. */
const PREVIEW_QUARTER_MS = 600;
/** The preview staff takes the rows the two rows of buttons leave, and at least these. */
const PREVIEW_MIN_ROWS = 48;
const BUTTON_WIDTH = SYMBOL_WIDTH + 6;
const BUTTON_HEIGHT = SYMBOL_HEIGHT + 2;
const TAB_WIDTH = 16;
const GAP = 3;
/** The lane is moved in quarter staff spaces. */
const OFFSET_STEP = 0.25;
/** A press within this many staff spaces of a lane takes hold of it. */
const GRAB = 1.2;

const STRENGTHS = [1, 0.5, 0] as const;
const HEIGHTS = [0.4, 0.8, 1.2] as const;
const REACHES = [0.15, 0.25, 0.5] as const;

/** The next value after `value` in `list` (round), the nearest one standing for a value that is not in it. */
function nextOf<T extends number>(list: readonly T[], value: number): T {
  let at = 0;
  list.forEach((v, i) => {
    if (Math.abs(v - value) < Math.abs(list[at]! - value)) at = i;
  });
  return list[(at + 1) % list.length]!;
}
const levelOf = (list: readonly number[], value: number): 0 | 1 | 2 => {
  let at = 0;
  list.forEach((v, i) => {
    if (Math.abs(v - value) < Math.abs(list[at]! - value)) at = i;
  });
  return at as 0 | 1 | 2;
};

/**
 * Tuning the beat lanes (core_13 rule 10): up to three lanes, each with which dots it shows and how strongly, the wave's
 * height and width, and where it runs. A preview staff at the top shows every change at once, with the wave running round
 * its two bars; a lane is moved by dragging it on the preview or with the arrows. Every change is saved for this player.
 */
export class BeatLanesScene extends PixelScene {
  private returnTo: SettingsData = { page: 1 };
  private lanes: LaneLook[] = [];
  private selected = 0;
  private view: StaffView | null = null;
  private layout: StaffLayout | null = null;
  private chart: Chart | null = null;
  private loopTicks = 1;
  private saveFailed = false;
  /** A lane being dragged on the preview: which one, where the press began (screen y) and its place then. */
  private drag: { lane: number; fromY: number; offset: number } | null = null;

  protected override keyboardNavigation = true;

  constructor() {
    super('beat-lanes');
  }

  init(data?: BeatLanesData): void {
    this.returnTo = data?.returnTo ?? { page: 1 };
    this.lanes = learnBeatLanes(contextOf(this).profiles.learnSettings).map((l) => structuredClone(l));
    this.selected = 0;
    this.saveFailed = false;
    this.drag = null;
  }

  override create(): void {
    super.create();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.grab(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.pull(p));
    this.input.on('pointerup', () => this.letGo());
  }

  protected override back(): void {
    this.scene.start('settings', freshData(this.returnTo));
  }

  override update(): void {
    if (!this.view || !this.chart) return;
    // the wave goes round the preview's bars at a steady pace, so each change shows as it will in play
    const now = this.time.now;
    const wave = ((now / PREVIEW_QUARTER_MS) * this.chart.ppq) % this.loopTicks;
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
    this.label(strip.left + 2, 6, this.saveFailed ? t('settings.saveFailed') : t('lanes.title'), this.saveFailed ? C.gold : C.gold);
    const controls = 2 * (BUTTON_HEIGHT + GAP) + 12;
    const rows = Math.max(PREVIEW_MIN_ROWS, this.mainRows - strip.rows - 2 - controls);
    this.drawPreview(strip.rows + 1, rows);
    this.drawControls(strip.rows + 2 + rows);
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

  /** Give the preview the lanes as they are now (also while one is dragged). */
  private showLanes(): void {
    if (!this.view || !this.layout || !this.chart) return;
    const layout = this.layout;
    const chart = this.chart;
    this.view.setLanes(this.lanes.map((look) => ({ dots: laneDots(layout, chart, look.place, look.offset), look })), chart.ppq);
  }

  /** The lane tabs and their buttons, `top` art rows down: two rows of pictures. */
  private drawControls(top: number): void {
    const rowA = top + BUTTON_HEIGHT / 2;
    const rowB = rowA + BUTTON_HEIGHT + GAP;
    let x = 8;
    // one tab a lane, + while there is room for another, and − for the lane chosen
    this.lanes.forEach((_, i) => {
      const tab = this.button({ x: x + TAB_WIDTH / 2, y: rowA, width: TAB_WIDTH, height: BUTTON_HEIGHT, label: String(i + 1), tooltip: t('lanes.lane', { n: i + 1 }), look: 'tab', onClick: () => this.choose(i) });
      tab.setActive(i === this.selected);
      x += TAB_WIDTH + GAP;
    });
    if (this.lanes.length < LANE_LIMITS.lanes) {
      this.button({ x: x + TAB_WIDTH / 2, y: rowA, width: TAB_WIDTH, height: BUTTON_HEIGHT, label: '+', tooltip: t('lanes.add'), look: 'ink', inkBox: true, onClick: () => this.addLane() });
      x += TAB_WIDTH + GAP;
    }
    const lane = this.lanes[this.selected];
    if (!lane) {
      this.label(x + 4, rowA - 4, t('lanes.none'), C.ink);
      return;
    }
    this.button({ x: x + TAB_WIDTH / 2, y: rowA, width: TAB_WIDTH, height: BUTTON_HEIGHT, label: '-', tooltip: t('lanes.remove'), look: 'ink', inkBox: true, onClick: () => this.removeLane() });
    x += TAB_WIDTH + GAP * 3;
    const picture = (at: number, y: number, label: string, icon: Bitmap, onClick: () => void) => {
      this.button({ x: at + BUTTON_WIDTH / 2, y, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, look: 'ink', inkBox: true, label, icon, iconOnly: true, onClick });
    };
    picture(x, rowA, t(lane.place === 'between' ? 'settings.beatLaneBetween' : 'settings.beatLaneAbove'), beatLaneSymbol(lane.place), () => this.change({ place: lane.place === 'between' ? 'above' : 'between', offset: 0 }));
    x += BUTTON_WIDTH + GAP;
    for (const [dir, icon, key] of [[-1, ICONS.up, 'lanes.up'], [1, ICONS.down, 'lanes.down']] as const) {
      this.button({ x: x + TAB_WIDTH / 2, y: rowA, width: TAB_WIDTH, height: BUTTON_HEIGHT, look: 'ink', inkBox: true, label: t(key), icon, iconOnly: true, onClick: () => this.change({ offset: this.clampOffset(lane.offset + dir * OFFSET_STEP * 2) }) });
      x += TAB_WIDTH + GAP;
    }
    // the second row: each kind of dot, then the wave
    let bx = 8;
    const parts: [LaneDotPart, StringKey][] = [['ghost', 'lanes.ghost'], ['beat', 'lanes.beat'], ['top', 'lanes.top'], ['bottom', 'lanes.bottom']];
    for (const [part, key] of parts) {
      const strength = lane.dots[part];
      picture(bx, rowB, t(key, { amount: t(strength >= 1 ? 'lanes.full' : strength > 0 ? 'lanes.faint' : 'lanes.hidden') }), laneDotsSymbol(part, strength), () => this.change({ dots: { ...lane.dots, [part]: nextOf(STRENGTHS, strength) } }));
      bx += BUTTON_WIDTH + GAP;
    }
    picture(bx, rowB, t('lanes.height'), laneWaveSymbol('height', levelOf(HEIGHTS, lane.wave.height)), () => this.change({ wave: { ...lane.wave, height: nextOf(HEIGHTS, lane.wave.height) } }));
    bx += BUTTON_WIDTH + GAP;
    picture(bx, rowB, t('lanes.reach'), laneWaveSymbol('reach', levelOf(REACHES, lane.wave.reach)), () => this.change({ wave: { ...lane.wave, reach: nextOf(REACHES, lane.wave.reach) } }));
  }

  private clampOffset(offset: number): number {
    return Math.max(-LANE_LIMITS.offset, Math.min(LANE_LIMITS.offset, Math.round(offset / OFFSET_STEP) * OFFSET_STEP));
  }

  private choose(lane: number): void {
    this.selected = lane;
    this.redraw();
  }

  /** A new lane, as the default one is, above the staff when the first one runs between (so the two are apart). */
  private addLane(): void {
    const first = this.lanes[0];
    this.lanes.push(defaultLaneLook(first?.place === 'between' ? 'above' : 'between'));
    this.selected = this.lanes.length - 1;
    void this.save();
  }

  private removeLane(): void {
    this.lanes.splice(this.selected, 1);
    this.selected = Math.max(0, Math.min(this.selected, this.lanes.length - 1));
    void this.save();
  }

  private change(change: Partial<LaneLook>): void {
    const lane = this.lanes[this.selected];
    if (!lane) return;
    this.lanes[this.selected] = { ...lane, ...change };
    void this.save();
  }

  /** Save the lanes for this player, then draw the screen again with them. */
  private async save(): Promise<void> {
    const saved = await contextOf(this).profiles.updateLearnSettings({ beatLanes: this.lanes });
    this.saveFailed = !saved;
    this.redraw();
  }

  /** The y on the screen of each lane on the preview's first line, as drawn now. */
  private laneYs(): number[] {
    const layout = this.layout;
    const chart = this.chart;
    if (!layout || !chart || !this.view) return [];
    return this.lanes.map((look) => (laneDots(layout, chart, look.place, look.offset)[0]?.y ?? -1e9) + this.view!.origin.y);
  }

  /** A press on the preview near a lane takes hold of it (and chooses it). */
  private grab(p: Phaser.Input.Pointer): void {
    const S = this.layout?.staffSpace ?? 0;
    if (!(S > 0)) return;
    const ys = this.laneYs();
    let best = -1;
    ys.forEach((y, i) => {
      if (Math.abs(p.y - y) <= GRAB * S && (best < 0 || Math.abs(p.y - y) < Math.abs(p.y - ys[best]!))) best = i;
    });
    if (best < 0) return;
    this.drag = { lane: best, fromY: p.y, offset: this.lanes[best]!.offset };
    this.selected = best;
  }

  /** While held, the lane follows the pointer up and down on the preview. */
  private pull(p: Phaser.Input.Pointer): void {
    const drag = this.drag;
    const S = this.layout?.staffSpace ?? 0;
    if (!drag || !p.isDown || !(S > 0)) return;
    const lane = this.lanes[drag.lane];
    if (!lane) return;
    lane.offset = this.clampOffset(drag.offset + (p.y - drag.fromY) / S);
    this.showLanes();
  }

  /** Let go: the lane stays where it was dropped, and is saved. */
  private letGo(): void {
    if (!this.drag) return;
    this.drag = null;
    void this.save();
  }
}
