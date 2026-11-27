import { nextPianoSound, type PianoSoundKind } from '../core/sound/pianoSound';
import { t, type StringKey } from '../core/text/strings';
import { contextOf } from './context';
import { C } from './ui/pixel/palette';
import { PixelScene } from './ui/pixel/PixelScene';
import { startScene } from './scenes';
import { guardAdmin } from './adminGuard';

const MARGIN = 12;
const TITLE_Y = 6;
const FIRST_Y = 30;
const ROW_HEIGHT = 18;
const ROW_GAP = 4;
/** Two columns of five rows, so the list fits a screen of 180 rows under the toolbar. */
const ROW_WIDTH = 140;
const COLUMN_GAP = 8;
const ROWS_PER_COLUMN = 5;
const NOTE_Y = FIRST_Y + ROWS_PER_COLUMN * (ROW_HEIGHT + ROW_GAP) + 4;

/** The dev pages (`?demo=…`, `?autoplay=1`) open only in a dev server, so they are left out of a production build. */
const PIANO_LABELS: Record<PianoSoundKind, StringKey> = { full: 'adminPages.pianoFull', light: 'adminPages.pianoLight', keyboard: 'adminPages.pianoKeyboard' };
const PIANO_NOTES: Record<PianoSoundKind, StringKey> = { full: 'adminPages.pianoFullNote', light: 'adminPages.pianoLightNote', keyboard: 'adminPages.pianoKeyboardNote' };

const DEV_PAGES = [
  { key: 'adminPages.demo', query: 'autoplay=1' },
  { key: 'adminPages.preview', query: 'demo=preview' },
  { key: 'adminPages.keys', query: 'demo=keys' },
  { key: 'adminPages.audio', query: 'demo=audio' },
  { key: 'adminPages.profile', query: 'demo=profile' },
] as const;

/**
 * The admin hub's Pages: one press opens another page of the game (the hardware test always, the dev pages only in a
 * dev server), turns the draft pieces on or off for `npm run start` (dev only, takes effect after a reload), and opens
 * the change-password screen. The "Grade note length" switch (d093) is per device, on by default, and applies at once
 * to the next piece. Opening a page leaves the game, which saves nothing extra: progress is already on the device.
 */
export class AdminPagesScene extends PixelScene {
  /** No player here yet (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  protected override keyboardNavigation = true;
  private drafts = false;
  private note = '';

  constructor() {
    super('adminPages');
  }

  /** The note comes in with the restart that makes it (the draft switch), so a redraw keeps it. */
  init(data?: { note?: string }): void {
    this.note = data?.note ?? '';
  }

  protected override back(): void {
    startScene(this, 'admin');
  }

  protected draw(): void {
    const { width } = this.px;
    const { admin, flags } = contextOf(this);
    this.sky();
    this.label(MARGIN, TITLE_Y, t('adminPages.title'), C.gold, { big: true });

    const row = (i: number) => FIRST_Y + (i % ROWS_PER_COLUMN) * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
    const column = (i: number) => MARGIN + Math.floor(i / ROWS_PER_COLUMN) * (ROW_WIDTH + COLUMN_GAP) + ROW_WIDTH / 2;
    const pages: readonly { key: (typeof DEV_PAGES)[number]['key'] | 'adminPages.spike'; query: string }[] = [
      { key: 'adminPages.spike', query: '' },
      ...(flags.devTools ? DEV_PAGES : []),
    ];
    pages.forEach((page, i) => {
      this.button({
        x: column(i), y: row(i), width: ROW_WIDTH, height: ROW_HEIGHT, label: t(page.key),
        onClick: () => this.open(page.query ? `?${page.query}` : 'spike.html'),
      });
    });
    let next = pages.length;
    // The switch only matters in `npm run start`: a plain dev server always shows drafts, so the row is left out there.
    if (flags.devTools && !flags.draftsShown) {
      this.button({
        x: column(next), y: row(next), width: ROW_WIDTH, height: ROW_HEIGHT,
        label: t(this.drafts ? 'adminPages.drafts' : 'adminPages.draftsOff'),
        onClick: () => void admin.setDrafts(!this.drafts)
          .then(() => this.scene.restart({ note: t('adminPages.draftsNote') }))
          .catch(() => this.scene.restart({ note: t('admin.failed') })),
      });
      next += 1;
    }
    const gradeLength = contextOf(this).adminSettings.gradeNoteLength;
    this.button({
      x: column(next), y: row(next), width: ROW_WIDTH, height: ROW_HEIGHT,
      label: t(gradeLength ? 'adminPages.gradeLength' : 'adminPages.gradeLengthOff'),
      onClick: () => void admin.setGradeNoteLength(!gradeLength)
        .then(() => {
          contextOf(this).adminSettings = { ...contextOf(this).adminSettings, gradeNoteLength: !gradeLength };
          this.scene.restart({ note: t('adminPages.gradeLengthNote') });
        })
        .catch(() => this.scene.restart({ note: t('admin.failed') })),
    });
    next += 1;
    // the piano (ft_0_07.AC3, AC4): full samples, light ones (short and mono), or the attached EZ-220; switched while the game runs
    const sound = contextOf(this).adminSettings.pianoSound;
    this.button({
      x: column(next), y: row(next), width: ROW_WIDTH, height: ROW_HEIGHT,
      label: t(PIANO_LABELS[sound]),
      onClick: () => {
        const to = nextPianoSound(sound);
        void contextOf(this).audio.piano.setSound(to);
        void admin.setPianoSound(to)
          .then(() => {
            contextOf(this).adminSettings = { ...contextOf(this).adminSettings, pianoSound: to };
            this.scene.restart({ note: t(PIANO_NOTES[to]) });
          })
          .catch(() => this.scene.restart({ note: t('admin.failed') }));
      },
    });
    next += 1;
    this.button({
      x: column(next), y: row(next), width: ROW_WIDTH, height: ROW_HEIGHT, label: t('admin.password'),
      onClick: () => startScene(this, 'adminPassword'),
    });
    if (this.note) this.label(MARGIN, NOTE_Y, this.note, C.dim, { maxWidth: width - 2 * MARGIN });
  }

  /** Reads the draft setting once the scene is drawn; the buttons then show it. */
  override create(): void {
    super.create();
    guardAdmin(this);
    void contextOf(this).admin.drafts().then((on) => {
      this.drafts = on;
      this.redraw();
    });
  }

  /** Opens a page of the game in this tab (same origin, so the same saves). */
  private open(target: string): void {
    window.open(new URL(target, contextOf(this).flags.pageBase).href, '_self');
  }
}
