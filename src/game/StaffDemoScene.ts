import Phaser from 'phaser';
import type { Chart } from '../core/chart';
import { layoutStaff } from '../core/layout/staff';
import { t } from '../core/text/strings';
import { contextOf, type StaffDemoView } from './context';
import { DEFAULT_THEME, StaffView } from './ui/staff/StaffView';

/** Dev-only scene (`?demo=staff`): look at the staff renderer, switch pieces, hints and sizes, step the cursor. */
export class StaffDemoScene extends Phaser.Scene {
  private view: StaffView | null = null;
  private help: Phaser.GameObjects.Text | null = null;
  private pieceIndex = 0;
  private cursor = 0;
  private hints = { noteNames: false, fingers: false };
  private staffSpace: number | 'auto' = 'auto';
  private settings: StaffDemoView | null = null;
  private charts: Chart[] = [];

  constructor() {
    super('staff-demo');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(DEFAULT_THEME.paper);
    // Dev inspection: ?piece=3&hints=nf&vw=1366&vh=768 lays out for a virtual screen; &zoom=1&cx=400&cy=200 looks at a region.
    const context = contextOf(this);
    this.settings = context.flags.staffDemo;
    this.charts = context.pieces.devSamples();
    const piece = this.settings.piece ?? 0;
    if (piece >= 1 && this.charts[piece - 1]) this.pieceIndex = piece - 1;
    const hints = this.settings.hints;
    this.hints = { noteNames: hints.includes('n'), fingers: hints.includes('f') };
    const keys = this.input.keyboard;
    keys?.on('keydown', (e: KeyboardEvent) => this.onKey(e.key));
    const rebuild = () => this.rebuild();
    this.scale.on('resize', rebuild);
    this.events.once('shutdown', () => this.scale.off('resize', rebuild));
    this.rebuild();
  }

  private onKey(key: string): void {
    const chart = this.charts[this.pieceIndex];
    if (/^[1-9]$/.test(key) && this.charts[Number(key) - 1]) {
      this.pieceIndex = Number(key) - 1;
      this.cursor = 0;
    } else if (key === 'n') this.hints = { ...this.hints, noteNames: !this.hints.noteNames };
    else if (key === 'f') this.hints = { ...this.hints, fingers: !this.hints.fingers };
    else if (key === ' ' && chart) {
      this.view?.setNoteState(this.cursor, 'correct');
      this.cursor = Math.min(this.cursor + 1, chart.notes.length - 1);
    } else if (key === 'w' && chart) this.view?.setNoteState(this.cursor, 'wrong');
    else if (key === 'r') this.cursor = 0;
    else if (key === '+' || key === '=') this.staffSpace = Math.min(40, this.lastSpace + 2);
    else if (key === '-') this.staffSpace = Math.max(8, this.lastSpace - 2);
    else if (key === '0') this.staffSpace = 'auto';
    else return;
    this.rebuild();
  }

  private lastSpace = 20;

  private rebuild(): void {
    const chart = this.charts[this.pieceIndex];
    if (!chart) return;
    this.view?.destroy();
    this.help?.destroy();
    const at = this.settings;
    const vw = at?.vw ?? this.scale.width;
    const vh = at?.vh ?? this.scale.height;
    const layout = layoutStaff(chart, { viewport: { width: vw, height: vh }, staffSpace: this.staffSpace });
    const zoom = at?.zoom ?? Math.min(this.scale.width / vw, this.scale.height / vh);
    this.cameras.main.setZoom(zoom).centerOn(at?.cx ?? vw / 2, at?.cy ?? vh / 2);
    this.lastSpace = layout.staffSpace;
    this.view = new StaffView(this, layout, undefined, this.hints);
    this.view.setCursor(this.cursor);
    this.help = this.add
      .text(12, 8, `${chart.title}${layout.fits ? '' : '  (does not fit)'}  |  ${t('demo.help')}`, { fontFamily: 'monospace', fontSize: '14px', color: '#555555' });
  }
}
