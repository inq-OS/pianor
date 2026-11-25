import type { PlaySettings } from '../core/judge/playSettings';
import { learnBeatLanes, learnLiveTempo, learnPaceClick, type LearnSettings } from '../core/learn/progress';
import { BAR_NUMBER_MODES, type BarNumberMode } from '../core/layout/barNumbers';
import type { DurationMark } from '../core/layout/durationHelp';
import type { StaffSettings } from '../core/layout/staffSettings';
import { bugReportUrl, screenFacts } from '../core/report/bugReportLink';
import { language } from '../core/text/language';
import { t } from '../core/text/strings';
import { contextOf } from './context';
import type { ProfileService } from './profile/ProfileService';
import type { Bitmap } from './ui/pixel/bitmap';
import { C } from './ui/pixel/palette';
import { Mascot } from './ui/pixel/PixelObjects';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { SYMBOL_HEIGHT, SYMBOL_WIDTH, barNumbersSymbol, beatLaneSymbol, durationSymbol, fingersSymbol, learnHandsSymbol, learnStepSymbol, linesSymbol, liveTempoSymbol, markersFromSymbol, markersSymbol, namingSymbol, paceClickSymbol, scoreSymbol, staffGapSymbol } from './ui/pixel/settingArt';
import { freshData, startScene } from './scenes';
import { TOOL_ICONS } from './ui/pixel/toolArt';

const MARGIN = 12;
/** Under the top left corner vine's arm, as on the main menu. */
const TITLE_Y = 14;
/** Kiur in the top right corner (24 art pixels wide), under and left of the corner vine. */
const MASCOT_WIDTH = 24;
const MASCOT_Y = 16;
const MASCOT_RIGHT = 20;
const OPTION_GAP = 4;
/**
 * One button per setting, which shows the current choice and moves to the next one when pressed; the setting's name sits right
 * of it. Two columns of rows, the first row centred on FIRST_ROW_Y, one every ROW_STEP; a name may take two lines.
 */
const SETTING_WIDTH = SYMBOL_WIDTH + 6;
const SETTING_HEIGHT = SYMBOL_HEIGHT + 4;
const NAME_GAP = 6;
/** The shaded fold down the middle of the open book: no name runs into it. */
const FOLD_ROOM = 8;
// AX-3 provisional (d110): a normal-size title and the rows and hint moved up, so the four rows, the hint and the bottom
// corner vines fit the 320 x 157 main area
const FIRST_ROW_Y = 39;
const ROW_STEP = 26;
/** The second column starts at the middle of the screen. */
/** The first column sits two pixels in from the margin, so its last row's focus ring clears the bottom left vine. */
const columnX = (column: 0 | 1, width: number) => (column === 0 ? MARGIN + 2 : Math.floor(width / 2) + OPTION_GAP);
/** The line under the rows: the hint (or, once Space between staves is tapped, what it changes), or that saving failed. */
const HINT_Y = 132;
/** With the band: the buttons two rows shorter and edge to edge, so the four rows end inside the book above the band. */
const BAND_SETTING_HEIGHT = SYMBOL_HEIGHT + 2;
const BAND_ROW_STEP = BAND_SETTING_HEIGHT;
/** With the band: the title's and the hint's line in the strip of the door and the gear. */
const STRIP_TEXT_Y = 6;

interface Choice<T> {
  value: T;
  /** The choice's name: the tooltip, and what tests read. */
  label: string;
  /** What the button shows: the choice as the student sees it in play (`settingArt.ts`), or a short text such as a number. */
  symbol?: Bitmap;
  text?: string;
}

/**
 * The active player's settings: how many lines of music the practice screen shows at once and how many bars a line holds.
 * Each choice is saved at once for this player (`ProfileService.updateStaffSettings`); the rules for what they mean live in
 * `core/layout/staffSettings.ts`.
 */
/** Where Back goes: the screen the toolbar's settings button was pressed on (d088), with its data; the piece list by default. */
export interface SettingsData {
  returnTo?: { key: string; data?: object };
  /** The page to open at: 0 how the staff looks (the default), 1 how a piece is learned. */
  page?: 0 | 1;
}

export class SettingsScene extends PixelScene {
  private saveFailed = false;
  /** The first row's centre: under the title, or under the strip of the door and the gear with the band (ft_1_20). */
  private firstRowY = FIRST_ROW_Y;
  /** The rows' step and the buttons' height: a little tighter under the band, whose main area has 124 rows (ft_1_20). */
  private rowStep = ROW_STEP;
  private settingHeight = SETTING_HEIGHT;
  /** Space between staves was tapped: the hint line says it only changes two-staff pieces. */
  private gapTapped = false;
  private returnTo: { key: string; data?: object } = { key: 'menu' };
  /**
   * The page of settings shown: 0 how the staff looks, 1 how a piece is learned (ft_1_32). AX-3 provisional: a second page,
   * since the first one's four rows are full with the band; a toolbar item (a band action) turns to it and back, lit while it shows.
   */
  private page: 0 | 1 = 0;

  protected override keyboardNavigation = true;
  /** The on-screen keyboard switch lives on this screen's toolbar only (d099). */
  protected override toolbarKeys = true;

  constructor() {
    super('settings');
  }

  init(data?: SettingsData): void {
    this.saveFailed = false;
    this.gapTapped = false;
    this.page = data?.page ?? 0;
    this.returnTo = data?.returnTo ?? { key: 'menu' };
  }

  protected override back(): void {
    this.scene.start(this.returnTo.key, freshData(this.returnTo.data));
  }

  /**
   * The piece list and the bug report (ft_1_16) are the settings screen's own toolbar items (d088). The report opens
   * GitHub's new-issue page in a browser window, filled in with the screen the settings were opened from; the person
   * submits it there, so the game sends nothing itself.
   */
  protected override toolbarItems(): ToolbarItem[] {
    return [
      // A release build (`tools/release/pack.sh` sets VITE_PIANOR_RELEASE) has no bug report (ft_1_16.AC4); the test is written
      // out here, not in a helper, so the bundler drops the report's code and the repository's address with it.
      ...(import.meta.env.VITE_PIANOR_RELEASE === '1' ? [] : [{ label: t('settings.reportBug'), onClick: () => this.reportBug() }]),
      { label: t('settings.pieces'), icon: TOOL_ICONS.pieces, onClick: () => startScene(this, 'pieces') },
      { label: t('settings.pageLearn'), active: this.page === 1, onClick: () => this.turnPage() },
    ];
  }

  /** Between the staff's settings and the learning settings; a hint of the other page goes with it. */
  private turnPage(): void {
    this.page = this.page === 0 ? 1 : 0;
    this.gapTapped = false;
    this.redraw();
  }

  private reportBug(): void {
    if (import.meta.env.VITE_PIANOR_RELEASE === '1') return;
    const url = bugReportUrl({
      screen: this.returnTo.key, ...screenFacts(this.returnTo.data),
      page: contextOf(this).flags.pageBase, devServer: contextOf(this).flags.devTools, language: language(), browser: navigator.userAgent,
      window: { width: window.innerWidth, height: window.innerHeight },
    });
    window.open(url, '_blank', 'noopener');
  }

  /**
   * One setting in column `column`, row `row`: a button showing the current choice's picture and, right of it, the setting's name. A press
   * saves the next choice (after the last comes the first again) for this player with `save` and draws the screen again.
   */
  private setting<T>(column: 0 | 1, row: number, name: string, choices: Choice<T>[], current: T, save: (value: T) => Promise<boolean>): void {
    const x = columnX(column, this.px.width);
    const y = this.firstRowY + row * this.rowStep;
    const index = Math.max(0, choices.findIndex((c) => c.value === current));
    const next = choices[(index + 1) % choices.length]!;
    const shown = choices[index]!;
    this.button({
      x: x + SETTING_WIDTH / 2, y, width: SETTING_WIDTH, height: this.settingHeight, look: 'ink', inkBox: true,
      // a number reads better than a picture for some settings: then the button shows it and the name is the tooltip
      ...(shown.symbol ? { label: shown.label, icon: shown.symbol, iconOnly: true } : { label: shown.text ?? shown.label, tooltip: shown.label, big: (shown.text ?? '').length === 1 }),
      onClick: () => {
        void save(next.value).then((saved) => {
          this.saveFailed = !saved;
          this.redraw();
        });
      },
    });
    const nameX = x + SETTING_WIDTH + NAME_GAP;
    // a name on the left page wraps short of the book's fold
    const end = column === 0 ? Math.floor(this.px.width / 2) - FOLD_ROOM : this.px.width - MARGIN;
    const text = this.label(nameX, y, name, C.white, { maxWidth: end - nameX });
    // the name's letters (tails left out) centred on the button
    text.y = Math.round(y - text.letterBox.bottom / 2);
  }

  protected draw(): void {
    const { width } = this.px;
    const profiles = (contextOf(this)).profiles;
    this.sky();
    // the settings are written in the open book on the desk, as the song list is
    this.openBook({ x: 3, y: 3, w: width - 6, h: this.px.height - 5 });
    this.inkWriting = true;
    // with the band (ft_1_20) the title, the hint line and Kiur stand in the strip between the door and the gear, so the four
    // rows fit the 124 rows above the band; the player is in the room, Report a bug and the piece list are the band's actions
    const strip = this.bandShown ? this.cornerStrip : null;
    this.settingHeight = strip ? BAND_SETTING_HEIGHT : SETTING_HEIGHT;
    this.rowStep = strip ? BAND_ROW_STEP : ROW_STEP;
    this.firstRowY = strip ? strip.rows - 1 + this.settingHeight / 2 : FIRST_ROW_Y;
    const title = this.label(strip ? strip.left + 2 : MARGIN, strip ? STRIP_TEXT_Y : TITLE_Y, t('settings.title'), C.gold);
    const mascotX = strip ? strip.right - MASCOT_WIDTH : width - MASCOT_RIGHT - MASCOT_WIDTH;
    this.own(new Mascot(this, this.root, mascotX, strip ? 1 : MASCOT_Y));

    if (this.page === 0) this.staffPage(profiles);
    else this.learnPage(profiles);
    // Wait and Tempo moved to the practice screen, and their hint with them; the line is empty until something needs saying
    const hint = this.saveFailed ? t('settings.saveFailed') : this.gapTapped ? t('settings.staffGapHint') : '';
    const hintX = strip ? title.x + title.width + NAME_GAP * 2 : MARGIN;
    const hintEnd = strip ? mascotX - NAME_GAP : width - MARGIN;
    const hintLabel = this.label(hintX, strip ? STRIP_TEXT_Y : HINT_Y, hint, this.saveFailed ? C.gold : C.dim, { maxWidth: hintEnd - hintX });
    // a hint that wraps in the strip is lifted so its last line still ends above the first row
    if (strip) hintLabel.y = Math.max(0, Math.min(STRIP_TEXT_Y, this.firstRowY - this.settingHeight / 2 - hintLabel.height - 1));
  }

  /** The beat lanes' button: the first lane's picture, and a press opens their own page (`BeatLanesScene`). */
  private laneButton(column: 0 | 1, row: number, place: 'above' | 'between' | 'off'): void {
    const x = columnX(column, this.px.width);
    const y = this.firstRowY + row * this.rowStep;
    this.button({
      x: x + SETTING_WIDTH / 2, y, width: SETTING_WIDTH, height: this.settingHeight, look: 'ink', inkBox: true,
      label: t('settings.beatLanesTune'), icon: beatLaneSymbol(place), iconOnly: true,
      onClick: () => this.scene.start('beat-lanes', freshData({ returnTo: { returnTo: this.returnTo, page: 1 } })),
    });
    const nameX = x + SETTING_WIDTH + NAME_GAP;
    const end = column === 0 ? Math.floor(this.px.width / 2) - FOLD_ROOM : this.px.width - MARGIN;
    const text = this.label(nameX, y, t('settings.beatLane'), C.white, { maxWidth: end - nameX });
    text.y = Math.round(y - text.letterBox.bottom / 2);
  }

  /** The first page: how the staff looks. */
  private staffPage(profiles: ProfileService): void {
    const staff = profiles.staffSettings;
    const play = profiles.playSettings;
    const lines = ([[1, '1'], [2, '2'], ['all', t('settings.all')]] as const).map(([value, label]): Choice<StaffSettings['lines']> => ({ value, label, symbol: linesSymbol(value) }));
    this.setting(0, 0, t('settings.lines'), lines, staff.lines, (value) => profiles.updateStaffSettings({ lines: value }));
    // It only changes two-staff pieces, so a tap says so on the hint line.
    const gaps = ([['short', t('settings.staffGapShort')], ['wide', t('settings.staffGapWide')]] as const).map(([value, label]): Choice<'short' | 'wide'> => ({ value, label, symbol: staffGapSymbol(value) }));
    this.setting(1, 0, t('settings.staffGap'), gaps, profiles.staffGap, (value) => {
      this.gapTapped = true;
      return profiles.updateStaffGap(value);
    });
    // A (auto), 2 or 4 bars: a number, not a picture
    const bars = ([['auto', t('settings.auto'), t('settings.autoShort')], [2, '2', '2'], [4, '4', '4']] as const).map(([value, label, text]): Choice<StaffSettings['barsPerLine']> => ({ value, label, text }));
    this.setting(0, 1, t('settings.bars'), bars, staff.barsPerLine, (value) => profiles.updateStaffSettings({ barsPerLine: value }));
    const barNumberLabels: Record<BarNumberMode, string> = {
      off: t('settings.barNumbersOff'), first: t('settings.barNumbersFirst'), every: t('settings.barNumbersEvery'), every2: t('settings.barNumbersEvery2'), every4: t('settings.barNumbersEvery4'),
    };
    // five bars with the numbers the setting shows over them ("1 3 5" for every 2nd bar), none for off
    const barNumbers = BAR_NUMBER_MODES.map((mode) => ({ value: mode, label: barNumberLabels[mode], symbol: barNumbersSymbol(mode) }));
    this.setting(1, 1, t('settings.barNumbers'), barNumbers, profiles.barNumberSettings.mode, (mode) => profiles.updateBarNumberSettings({ mode }));
    // the on-screen keyboard's switch is on this screen's toolbar (d099)
    // finger numbers: off, the top note of a chord, or every note of a chord; one button, so the grid keeps its size
    const fingerNumbers = [
      { value: 'off' as const, label: t('settings.fingerNumbersOff'), symbol: fingersSymbol('off') },
      { value: 'top' as const, label: t('settings.chordFingersTop'), symbol: fingersSymbol('top') },
      { value: 'all' as const, label: t('settings.chordFingersAll'), symbol: fingersSymbol('all') },
    ];
    this.setting(0, 2, t('settings.fingerNumbers'), fingerNumbers, profiles.fingerNumbers, (value) => profiles.updateFingerNumbers(value));
    const scores = ([['off', t('settings.scoreOff')], ['colour', t('settings.scoreColour')], ['number', t('settings.scoreNumber')]] as const)
      .map(([value, label]): Choice<PlaySettings['scoreView']> => ({ value, label, symbol: scoreSymbol(value) }));
    this.setting(1, 2, t('settings.score'), scores, play.scoreView, (value) => profiles.updatePlaySettings({ scoreView: value }));
    // how long notes sound (ft_1_11), one setting per hand: off, A ghost heads, B the band, A+B; the left hand (bass) on the
    // left, the right hand on the right, as at the piano
    const marks = [['off', t('settings.durationHelpOff')], ['ghost', t('settings.durationHelpGhost')], ['band', t('settings.durationHelpBand')], ['both', t('settings.durationHelpBoth')]] as const;
    const help = profiles.durationHelp;
    for (const [column, hand, name] of [[0, 'LH', t('settings.durationHelpLH')], [1, 'RH', t('settings.durationHelpRH')]] as const) {
      const choices = marks.map(([value, label]): Choice<DurationMark> => ({ value, label, symbol: durationSymbol(value, hand) }));
      this.setting(column, 3, name, choices, help[hand], (value) => profiles.updateDurationHelp({ [hand]: value }));
    }
  }

  /**
   * The second page: how a piece is learned bar by bar (ft_1_32 rules 2 and 6): the bars a step adds, which applies to the
   * next piece begun (a piece in progress keeps its own, `learnStepBars`), the mistake markers with the miss they come at, and
   * both hands together or hands apart for the next two-hand piece begun (`learnHandsApart`).
   */
  private learnPage(profiles: ProfileService): void {
    const learn = profiles.learnSettings;
    // every choice is a picture, its words in the tooltip (d285)
    const steps = ([1, 2] as const).map((value): Choice<LearnSettings['stepBars']> => ({ value, label: t(value === 1 ? 'settings.learnStepOne' : 'settings.learnStepTwo'), symbol: learnStepSymbol(value) }));
    this.setting(0, 0, t('settings.learnStep'), steps, learn.stepBars, (value) => profiles.updateLearnSettings({ stepBars: value }));
    const markers = ([[true, t('settings.learnMarkersOn')], [false, t('settings.learnMarkersOff')]] as const)
      .map(([value, label]): Choice<boolean> => ({ value, label, symbol: markersSymbol(value) }));
    this.setting(1, 0, t('settings.learnMarkers'), markers, learn.markers, (value) => profiles.updateLearnSettings({ markers: value }));
    const from = ([1, 2, 3, 4, 5] as const).map((n): Choice<number> => ({ value: n, label: t('settings.learnMarkersFromN', { n }), symbol: markersFromSymbol(n) }));
    this.setting(0, 1, t('settings.learnMarkersFrom'), from, learn.markersFrom, (value) => profiles.updateLearnSettings({ markersFrom: value }));
    // a two-hand piece: both hands together (the default) or each step by one hand, then the other, then both (rule 13)
    const hands = ([[false, t('settings.learnHandsTogether')], [true, t('settings.learnHandsApart')]] as const)
      .map(([value, label]): Choice<boolean> => ({ value, label, symbol: learnHandsSymbol(value) }));
    this.setting(1, 1, t('settings.learnHands'), hands, learn.handsApart ?? false, (value) => profiles.updateLearnSettings({ handsApart: value }));
    // the run's live tempo in the top bar: a parent's or teacher's tool, off unless turned on (rule 18)
    const live = ([[false, t('settings.learnLiveTempoOff')], [true, t('settings.learnLiveTempoOn')]] as const)
      .map(([value, label]): Choice<boolean> => ({ value, label, symbol: liveTempoSymbol(value) }));
    this.setting(1, 2, t('settings.learnLiveTempo'), live, learnLiveTempo(learn), (value) => profiles.updateLearnSettings({ liveTempo: value }));
    // the letter naming, B or H (ft_0_17.AC4): the note names, the circle of fifths and the key names follow it
    const namings = (['H', 'B'] as const).map((value): Choice<'B' | 'H'> => ({ value, label: t(value === 'H' ? 'settings.namingH' : 'settings.namingB'), symbol: namingSymbol(value) }));
    this.setting(0, 2, t('settings.naming'), namings, profiles.noteNaming, (value) => profiles.updateNoteNaming(value));
    // the beat lanes on the staff (core_13 rules 2 and 10): the button shows the first lane's place, or off, and opens the
    // page where the lanes are tuned with a preview; the click at the student's own pace while learning (rule 6), off unless
    // turned on, so the pace measured stays the student's own (ft_1_32 rule 8)
    this.laneButton(0, 3, learnBeatLanes(learn)[0]?.place ?? 'off');
    const click = ([[false, t('settings.paceClickOff')], [true, t('settings.paceClickOn')]] as const)
      .map(([value, label]): Choice<boolean> => ({ value, label, symbol: paceClickSymbol(value) }));
    this.setting(1, 3, t('settings.paceClick'), click, learnPaceClick(learn), (value) => profiles.updateLearnSettings({ paceClick: value }));
  }

}
