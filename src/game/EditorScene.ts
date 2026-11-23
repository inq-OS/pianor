import { handShiftMap } from '../core/fingering/shifts';
import { repeatAround, toggleRepeatEnd, toggleRepeatStart } from '../core/editor/repeats';
import { mouseAction, type MouseAction } from '../core/editor/mouse';
import { HELP_CARDS, KEY_CAP, KEY_TOUR, type HeldKey, type KeyTourSpot } from '../core/editor/help';
import { helpGridLayout } from '../core/layout/helpCards';
import { BAND_ROWS } from '../core/layout/band';
import type { Rect } from '../core/layout/rect';
import { moveBar, moveInTime, movePitch, otherStaff, startKeyCursor, withPitch, type KeyCursor } from '../core/editor/keyCursor';
import { nextLength } from '../core/editor/nextLength';
import { beatsFit, confirmBeats, firstBarFull, guessBeats, type Beats } from '../core/editor/meterGuess';
import { chordKeyPress, moveNoteKeepingLegato, repeatTied } from '../core/editor/keyEdits';
import { clearBars, copyBars, cutBars, insertBars, insertBlankBars, moveBars, pasteAt, type BarRange, type Clip } from '../core/editor/bars';
import { samePitchNotAdjacent, tieAll } from '../core/editor/ties';
import { arcInto, toggleArc } from '../core/editor/arcs';
import { graceFromKey, graceFromPlace, graceItem } from '../core/editor/graces';
import { barNumbersToShow } from '../core/layout/barNumbers';
import { addedMarks, pendingArc, slurPoints, tiePoints, type AddedMarks } from '../core/layout/preview';
import Phaser from 'phaser';
import { strokePolyline } from './ui/staff/polyline';
import { firstPrintedBar, levelsFileSchema, playbackLengthMs, playbackNotes, staffPosition, type Chart, type LevelDefinition, type Step } from '../core/chart';
import { toChart } from '../core/editor/chart';
import { autoFingers } from '../core/editor/fingers';
import levelsJson from '../../content/curriculum/levels.json';
import type { KeyMode } from '../core/editor/key';
import { canRedo, canUndo, push, redo, startHistory, undo, type History } from '../core/editor/history';
import { debugLog } from '../core/debug/debugLog';
import { entryBackspace, entryDown, entryTick, entryUp, moveCursor, startEntry, type EntryKey, type EntryOptions, type EntryState } from '../core/editor/entryMachine';
import { DEFAULT_ENTRY_PREFS, ENTRY_PREFS_KEY, parseEntryPrefs, serializeEntryPrefs } from '../core/editor/entryPrefs';
import { cursorAfter, cursorOf, type StaffMode } from '../core/editor/playEntry';
import type { NoteEvent } from '../core/judge/types';
import { hitTest, placeClick, pointOf, targetOf, type ActionTarget, type EntryMode, type Hit } from '../core/editor/hitTest';
import { barBoxes, barsInRect, drawnWhileWriting, editorStaff, pageOfBar, repeatPreview, shadowsFor, targetBox } from '../core/editor/staff';
import { onRepeatHandle, repeatCopies, repeatHandleBox } from '../core/editor/repeatHandle';
import chordsJson from '../../content/trainer/chords.json';
import { nameChord } from '../core/trainer/chordNamer';
import { chordLabel, loadChordContent } from '../core/trainer/chordTrainer';
import {
  BARS_DEFAULT, BPM_MAX, soundingMidi, EDITOR_LENGTHS, cycleLength, emptyPiece, findNote, lengthen, lengthenRest, lengthsFor, stepChord, placeNote, placeRest, placedRests, removeNote, removeRest, setAlter, nextAlter, longestFit, setDynamic, nextDynamic, setBeats, setPickup, onBothStaves, setKey, setFinger, bpmOf, stepBpm, setLength, setTitle, shorten, shortenRest, stepBars,
  type Edit, type EditorHand, type EditorLength, type EditorPiece, type NoteRef,
} from '../core/editor/model';
import type { Alter } from '../core/chart/key';
import { DYNAMICS, type Dynamic } from '../core/chart/dynamics';
import { row } from '../core/layout/row';
import { SHEET } from '../core/layout/sheet';
import type { StaffLayout } from '../core/layout/staff';
import { fitsLabel, problemLabel } from '../core/text/labels';
import { strings, t, type StringKey } from '../core/text/strings';
import { contextOf } from './context';
import { compileOwn } from './editor/OwnPieces';
import { digitOf, EDITOR_KEYS, editorKeyOf, type EditorKeyName } from './editor/shortcuts';
import { ChartPlayer } from './preview/ChartPlayer';
import { panelBitmap } from './ui/pixel/frames';
import { ACCIDENTAL_ICONS, NOTE_ICONS, REST_ICONS } from './ui/pixel/lengthArt';
import { C, hexCss } from './ui/pixel/palette';
import { GESTURE_SIZE, HELP_ARROW, SKETCH_SIZE, gesturePicture, keyCap, staffSketch } from './ui/pixel/mouseArt';
import { PixelImage, PixelText, type PixelButton, type PixelButtonOptions } from './ui/pixel/PixelObjects';
import { SpeechBubble } from './ui/pixel/SpeechBubble';
import { drawnText, measure } from './ui/pixel/font';
import { BAR_BUTTON_HEIGHT, BAR_EDGE } from './ui/pixel/playBars';
import { PixelScene, type MenuItem, type ToolbarItem } from './ui/pixel/PixelScene';
import { itemPicture, type ItemSign } from './ui/pixel/itemArt';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { ICONS } from './ui/pixel/iconArt';
import type { Bitmap } from './ui/pixel/bitmap';
import { DEFAULT_THEME, StaffView } from './ui/staff/StaffView';
import { PhotoOverlay, barsToFill, photoServer, sendPhoto, type PhotoReply } from './editor/photoImport';
import { PhotoTool } from './editor/photoTool';
import { CANCELLED, openOverlay, startScene } from './scenes';
import { circleItem } from './CircleOfFifthsScene';

/**
 * Heights in art pixels of the options rows and the bottom bar. No top bar: the staff needs every row it can get, as a
 * grand staff takes about 30 staff spaces and the smallest view (320x180) leaves only 157 rows under the toolbar.
 * Two option rows: meter, bars, the title, Listen and Try it; then the tempo, the sharp, flat and natural tools, the key,
 * Notes or Rests and the pages. Each fits the smallest 320-wide view, in Estonian too.
 */
// AX-3 provisional: which rows give way at 320x180; chose dropping the top bar and merging rows, keeping every button
const OPTIONS = 48;
/** One row (lengths, delete, undo, redo) and the checker's message under it, across the screen: it may take two lines. */
const BOTTOM = 37;
/** Gaps between buttons: inside a group of choices, between groups and around the - and + of a number. */
const CHOICE_GAP = 2;
/** A cell of the paste menu (x1, x2, x4). */
const PASTE_ITEM_WIDTH = 16;
const GROUP_GAP = 4;
/** The rows of buttons: centre lines under the vine (options) and under the bottom bar's top. */
const OPTIONS_ROW_Y = 9;
const KEY_ROW_Y = 23;
/** The second row of tools, under the keys: copy a bar and paste it at the end. */
const COPY_ROW_Y = 40;
const EDIT_ROW_Y = 9;
/** The checker's message starts this far under the bottom bar's top, just under its buttons. */
const STATUS_DROP = 16;
/** A line of text centred on a button row starts this far above the row's centre. */
const TEXT_RISE = 4;
const STEP_WIDTH = 16;
/** The |: and :| buttons: narrower than the steps, so the key row still fits at 320 pixels. */
const REPEAT_WIDTH = 12;
/** A meter button of the A time's question. */
const KEY_WIDTH = 26;
/** A button with a note or a rest on it. */
const ICON_BUTTON_WIDTH = 20;
/** A menu cell that holds an item's picture (`itemArt.ts`, 28 x 20 cells) inside its frame. */
const ITEM_MENU_CELL = { w: 32, h: 24 } as const;
/** The finger buttons 1 to 5 and AUTO on the copy row (ft_1_02d.AC13). */
const FINGER_WIDTH = 16;
const AUTO_WIDTH = 34;
/** The curriculum's levels, for AUTO fingers: the hand positions of each level (content/curriculum/levels.json). */
const LEVEL_TABLE: readonly LevelDefinition[] = levelsFileSchema.parse(levelsJson).levels;
const FLASH_MS = 500;
const MESSAGE_MS = 3000;
/** The chord dictionary the piece maker names a column's chord from (ft_1_29 slice D). */
const CHORDS = loadChordContent(chordsJson);
/** The id an unsaved piece is drawn under. */
const DRAFT_ID = 'own-draft';

/** The staff button's label for each mode, and the short-tap toggle's two labels; the widest of each sets its button's width. */
const STAFF_LABEL: Readonly<Record<StaffMode, StringKey>> = { auto: 'editor.staff.auto', RH: 'editor.staff.treble', LH: 'editor.staff.bass' };
const STAFF_ORDER: readonly StaffMode[] = ['auto', 'RH', 'LH'];
/** The F1 help (ft_1_33): its cards in this many columns; a held key's cap, its height and the room round its word. */
const HELP_COLUMNS = 2;
const HELP_CAP = { h: 11, pad: 6 } as const;
const SHORT_TAP_LABEL = { on: 'editor.shortTap.on', off: 'editor.shortTap.off' } as const;
/** Room round a label inside its button, in art pixels: a label gets the button's width less 8, so this keeps it on one line. */
const LABEL_PAD = 10;
/**
 * With the band (ft_1_20): the time panel (time, pick-up, tempo) opens along the staff's foot, this many rows high; the
 * message bubble's top and the page buttons stand this far above the foot. The finger menu's cells.
 */
const PIECE_PANEL = 20;
const FINGER_MENU_CELL = { w: 16, h: BAR_BUTTON_HEIGHT } as const;
/** The lengths in the order the Length item cycles them (ft_1_20: one item that shows its note). */
const LENGTH_ORDER: readonly EditorLength[] = EDITOR_LENGTHS;

/** A left press that moves more than this many art pixels (320 across) is a lasso drag, not a click. */
const LASSO_START = 4;

/**
 * The keys the computer-keyboard piano reads (src/io/mock/QwertyKeyboard.ts): in the piece maker they are the editor's
 * keys, and the piano never hears them (the computer keyboard as a piano is for testing). Matched by
 * physical key, as the piano reads them.
 */
const PIANO_KEYS = /^(Key[A-Z]|Digit[0-9]|Comma|Period|Semicolon|Slash|ArrowLeft|ArrowRight)$/;

/** The band's pictures of a dynamic (a blank scrap for none) and of a repeat sign (`itemArt.ts`). */
const dynamicPicture = (mark: Dynamic | undefined): Bitmap => itemPicture(mark ? `dynamic.${mark}` : 'blank');
/** The accidental item's sign for each alter. */
const ACCIDENTAL_SIGN: Readonly<Record<Alter, 'sharp' | 'flat' | 'natural'>> = { 1: 'sharp', [-1]: 'flat', 0: 'natural' };

const KEY_LENGTHS: Readonly<Record<string, EditorLength>> = {
  Digit1: 'whole', Digit3: 'dottedHalf', Digit2: 'half', Digit5: 'dottedQuarter', Digit4: 'quarter', Digit9: 'dottedEighth', Digit8: 'eighth', Digit6: 'sixteenth',
  Numpad1: 'whole', Numpad3: 'dottedHalf', Numpad2: 'half', Numpad5: 'dottedQuarter', Numpad4: 'quarter', Numpad9: 'dottedEighth', Numpad8: 'eighth', Numpad6: 'sixteenth',
};

interface Session {
  id: string | null;
  history: History<EditorPiece>;
  saved: EditorPiece | null;
  length: EditorLength;
  meterAuto: boolean;
}

export interface EditorData {
  id?: string;
}

/**
 * The piece editor (preliminary; `?editor=0` hides it): click notes onto the staff. The edit rules live in `core/editor`
 * (they refuse what the staff cannot draw, with a reason); this scene turns clicks, the wheel and keys into those edits,
 * draws the piece with the game's own staff, and saves it as an own piece (ABC plus meta, licence "NaN") on this device.
 */
export class EditorScene extends PixelScene {
  /** The piece being written survives a "Try it" visit to the practice screen. */
  private static returning: Session | null = null;
  /** What the piece maker says when it opens a piece a photo import just made: the bars to fill by hand (ft_Y_04 slice 4). */
  private static photoNote: string | null = null;
  /** The photo of the piece behind the staff, when a photo import made it (ft_Y_04.AC16). */
  private photo: PhotoOverlay | null = null;
  /** The game's server here reads photos (a PC with Audiveris): Import then takes a photo as well as a piece file. */
  private photoReady = false;
  /** The photo tool, while it is open over the piece maker (ft_Y_04.AC18). */
  private photoTool: PhotoTool | null = null;
  /** Which create the photo being loaded belongs to. */
  private photoToken = 0;

  private id: string | null = null;
  /** The save in progress, if any: saves run in order (see `save`). */
  private saving: Promise<void> = Promise.resolve();
  private history!: History<EditorPiece>;
  /** The piece as it was last saved, to tell whether there are changes. */
  private saved: EditorPiece | null = null;
  private length: EditorLength = 'quarter';
  private selected: NoteRef | null = null;
  /**
   * The first note of a tie or slur waiting for its end note (core_09.AC13, AC30): the next note clicked is where it goes, a
   * tie when that is the same key right after, else a slur. Only one pick waits at a time.
   */
  private arcFrom: NoteRef | null = null;
  /** The last pick preview laid out (d286): the piece it was made on, its target and the marks the click would add. */
  private previewCache: { piece: EditorPiece; key: string; marks: AddedMarks } | null = null;
  /** The repeat item's pick: waiting for the bar the repeat starts on, then for the bar it ends on. */
  private repeatPick: { startBar: number | null } | null = null;
  /** The accidental item (with the band): it shows the selected note's sharp, flat or natural. */
  private accidentalButton: PixelButton | null = null;
  /** The repeat item (with the band): lit while it asks for a bar. */
  private repeatButton: PixelButton | null = null;
  /** The note a pre-note pick is armed for (core_09.AC35, d121): the next pitch picked, on the staff or a key, is its grace. */
  private graceFor: NoteRef | null = null;
  /** The bar last copied with COPY, pasted at the end of the piece with PASTE. */
  private barClip: Clip | null = null;
  /** The bars selected with Shift and a click, first to last. */
  private barSel: BarRange | null = null;
  /** The bar the last click started from: a paste with no selection goes before it. */
  private barAnchor: number | null = null;
  /** The bars the clip was copied or pasted to: while the selection stays on them, a paste goes after them. */
  private clipRange: BarRange | null = null;
  private band: Phaser.GameObjects.Graphics | null = null;
  /** Where a left press started, for the lasso; null when no left button is down on the staff. */
  private lassoFrom: { x: number; y: number } | null = null;
  /** True once the press moved more than LASSO_START art pixels: it is a drag, not a click. */
  private lassoActive = false;
  private lassoBox: Phaser.GameObjects.Graphics | null = null;
  /** The drag-repeat handle is held (ft_1_02d.AC24): the bars it repeats and the copies the drag asks for so far. */
  private repeatDrag: { range: BarRange; copies: number } | null = null;
  /** The column (bar, start and keys) whose chord was last named (ft_1_29 slice D), so the name is said once for it. */
  private namedColumn: string | null = null;
  /** The ghost copies of a drag-repeat, over the bars they will take. */
  private repeatGhost: Phaser.GameObjects.Graphics | null = null;
  /** The keyboard cursor (ft_1_02d.AC15): where Enter, the chord key and Shift + arrows act; null until a key or a left click sets it. */
  private keyCursor: KeyCursor | null = null;
  /** Kiur's tour of the keys runs over the screen (ft_1_33.AC3): the F1 panel is hidden under it. */
  private touring = false;
  private cursorMark: Phaser.GameObjects.Graphics | null = null;
  /** A menu opened by its key (ft_1_02d.AC19): a digit picks a choice; any other key takes `fallback` and then does its own work. */
  private keyMenu: { items: MenuItem[]; fallback: number } | null = null;
  private chart: Chart | null = null;
  private layout: StaffLayout | null = null;
  private staffView: StaffView | null = null;
  private staffTop = 0;
  /** The staff's left side on the screen: moved in from the screen's side so its sheet of parchment shows its torn sides (d119). */
  private staffLeft = 0;
  private staffHeight = 0;
  private ghost: Phaser.GameObjects.Graphics | null = null;
  /** The shadow notes: every place a note can go. */
  private shadows: Phaser.GameObjects.Graphics | null = null;
  /** The part of a bar the pointer's action would change. */
  private target: Phaser.GameObjects.Graphics | null = null;
  /** Writing notes or rests. */
  private entry: EntryMode = 'note';
  private entryButton: PixelButton | null = null;
  /** The page of lines on screen, and the bar whose page to show after the next edit. */
  private page = 0;
  private follow: number | null = null;
  private pageText: PixelText | null = null;
  private ghostLabel: Phaser.GameObjects.Text | null = null;
  private status: PixelText | null = null;
  private titleInput: HTMLInputElement | null = null;
  /** Save asked for a title (a new piece without a name of its own): Enter in the title field saves once it has one. */
  private titleAsked = false;
  private player: ChartPlayer | null = null;
  private listenButton: PixelButton | null = null;
  private lengthButtons = new Map<EditorLength, PixelButton>();
  private bpmText: PixelText | null = null;
  /**
   * The A time (ft_1_02d.AC21): the first bar the parent writes sets the time. While true the piece is
   * written in 4/4 and no length is guessed; `meterAsk` is the time the piece maker asks to confirm, its panel open.
   */
  private meterAuto = false;
  private meterAsk: Beats | null = null;
  /** Esc closed the question on a full first bar: it asks again when a later bar is entered. */
  private meterDismissed = false;
  private message = '';
  private messageTimer: Phaser.Time.TimerEvent | null = null;
  private flashTimer: Phaser.Time.TimerEvent | null = null;
  /** The notes and rests written by playing keys. Its piece is the working piece (`this.piece`); while keys are held it is ahead of history. */
  private entryState!: EntryState;
  /** Which staff the played notes go on. Not saved: Auto each time the editor opens. */
  private staffMode: StaffMode = 'auto';
  /** A short tap writes an eighth note; kept on this device (ENTRY_PREFS_KEY). */
  private shortTapEighth = DEFAULT_ENTRY_PREFS.shortTapEighth;
  private staffButton: PixelButton | null = null;
  /** The dynamic mark of the selected note, cycled pp to ff then none (core_09.AC16). */
  private dynamicButton: PixelButton | null = null;
  /** With the band (ft_1_20): the notes' item, the Save button (its tooltip says which levels the piece fits) and the Kiur-less message bubble under the top strip. */
  private lengthItem: PixelButton | null = null;
  /** With the band: the rests' item beside the notes' one (two items, each scrolled like the other). */
  private restItem: PixelButton | null = null;
  private saveButton: PixelButton | null = null;
  private barsText: PixelText | null = null;
  private pickupText: PixelText | null = null;
  private meterText: PixelText | null = null;
  /** The time panel's three groups across the screen (art pixels), for the wheel over them. */
  private timeGroups: { from: number; to: number; step: (direction: 1 | -1) => void }[] = [];
  private bubble: SpeechBubble | null = null;
  /**
   * The panel open over the staff's foot (the start screen gone): the time, the pick-up and the tempo,
   * from a click on the time signature (or I). Closed by Esc or another click there. A click on a clef opens the circle of
   * fifths, which sets the key (ft_1_28 rule 8).
   */
  private panel: 'time' | null = null;
  /** With the band: whether the page buttons over the staff were drawn (only while the piece has more than one page). */
  private pageButtonsDrawn = false;
  /** Where the bar buttons after the last bar were drawn, to draw them again when it moves. */
  private barEndKey = '';
  private shortTapButton: PixelButton | null = null;
  /** The piece the staff was last drawn with, so live growth redraws it only when the piece changed. */
  private drawnPiece: EditorPiece | null = null;

  constructor() {
    super('editor');
  }

  /** `id` opens a saved own piece; nothing starts a new one; coming back from "Try it" continues where it was. */
  init(data: EditorData): void {
    const context = contextOf(this);
    const back = EditorScene.returning;
    EditorScene.returning = null;
    this.selected = null;
    this.arcFrom = null;
    this.repeatPick = null;
    this.barSel = null;
    this.barAnchor = null;
    this.clipRange = null;
    this.lassoFrom = null;
    this.lassoActive = false;
    this.lassoBox = null;
    this.repeatDrag = null;
    this.namedColumn = null;
    this.repeatGhost = null;
    this.keyCursor = null;
    this.cursorMark = null;
    this.keyMenu = null;
    this.shortcutsShown = false;
    this.touring = false;
    this.graceFor = null;
    this.entry = 'note';
    this.meterAsk = null;
    this.meterDismissed = false;
    this.titleAsked = false;
    this.page = 0;
    this.follow = null;
    this.message = '';
    this.staffMode = 'auto';
    this.shortTapEighth = this.loadEntryPrefs();
    if (back) {
      ({ id: this.id, history: this.history, saved: this.saved, length: this.length, meterAuto: this.meterAuto } = back);
      this.message = '';
      return;
    }
    const record = data.id ? context.ownPieces.get(data.id) : null;
    this.id = record?.id ?? null;
    // always both staves; an own piece saved for one hand opens with its notes on that hand's staff
    const opened = record ? onBothStaves(record.piece) : null;
    this.saved = opened;
    this.history = startHistory(opened ?? emptyPiece({ title: t('editor.untitled'), hands: 'both', beats: 4, bars: BARS_DEFAULT }));
    this.length = 'quarter';
    this.meterAuto = false;
  }

  override create(): void {
    const context = contextOf(this);
    this.entryState = startEntry(this.history.present);
    this.player = new ChartPlayer(context.audio.piano, context.audio.clock);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hover(p);
      this.dragLasso(p);
      this.dragRepeat(p);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.endPointerDrag(p));
    // a release off the canvas comes as pointerupoutside: it ends the lasso too, so no half lasso waits for the next click
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.endPointerDrag(p));
    // the middle button places notes: Chrome would start its autoscroll on it, so the canvas keeps its mousedown
    // (not its pointerdown: that would stop the mousedown Phaser reads)
    const noAutoscroll = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    const canvas = this.game.canvas;
    for (const type of ['mousedown', 'auxclick'] as const) canvas.addEventListener(type, noAutoscroll as EventListener);
    this.events.once('shutdown', () => {
      for (const type of ['mousedown', 'auxclick'] as const) canvas.removeEventListener(type, noAutoscroll as EventListener);
    });
    // off the canvas (into the toolbar): no shadow note or highlighted chord stays behind
    this.input.on('gameout', () => {
      this.ghost?.clear();
      this.ghostLabel?.setVisible(false);
      this.drawTarget(null);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Phaser keeps a click on the canvas from moving the focus, so a click anywhere ends typing the title
      this.titleInput?.blur();
      // a press while a menu is open only closes the menu
      // with the band, a press on a button or the open time panel over the staff is theirs, not the staff's
      // an armed pre-note takes the click's pitch first (core_09.AC35)
      if (!this.menuOpen && !this.overStaffControls(p) && !this.graceClick(p)) this.press(p);
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => this.wheel(p, dy));
    // The editor's keys are read before the computer-keyboard piano (which treats 2 as a black key and marks the event
    // handled, so Phaser would never see it), and a key the editor uses is kept from playing a note too.
    this.onWindowKey((e) => this.key(e));
    // the notes written by playing: any keyboard (EZ-220, on-screen, computer) comes through here, and the scene only forwards it
    this.events.once('shutdown', context.keyboard.onNote((event) => this.played(event)));
    // the spacebar is a rest while held: its release is read here, its press in `key`
    const released = (e: KeyboardEvent) => {
      if (e.code === 'Space') this.keyUp('space', this.nowMs());
      if (e.key === 'Alt' && this.scene.isActive()) e.preventDefault();
    };
    window.addEventListener('keyup', released, true);
    this.events.once('shutdown', () => window.removeEventListener('keyup', released, true));
    this.events.once('shutdown', () => {
      this.player?.stop();
      this.removeTitleInput();
      this.photo?.destroy();
      this.photo = null;
      this.photoTool?.destroy();
      this.photoTool = null;
    });
    super.create();
    this.startPhoto();
  }

  /**
   * The photo import's start (ft_Y_04 slice 4): ask whether the server here reads photos, lay the photo of this piece
   * behind the staff if it has one, and say what a photo import just left to fill by hand.
   */
  private startPhoto(): void {
    const note = EditorScene.photoNote;
    EditorScene.photoNote = null;
    if (note) this.say(note, MESSAGE_MS * 4);
    void photoServer().then((answer) => (this.photoReady = answer.ok));
    // every create starts its own listeners and takes them away on shutdown: the scene's emitter outlives a restart
    const redraw = () => this.drawPhoto();
    // a screen over the piece maker (the circle of fifths, a menu scene) pauses it: the photo goes with the staff
    const hide = () => this.photo?.setVisible(false);
    window.addEventListener('resize', redraw);
    this.events.on('pause', hide);
    this.events.on('resume', redraw);
    const token = (this.photoToken += 1);
    this.events.once('shutdown', () => {
      window.removeEventListener('resize', redraw);
      this.events.off('pause', hide);
      this.events.off('resume', redraw);
    });
    const id = this.id;
    if (!id) return;
    void PhotoOverlay.load(id, DEFAULT_THEME.cursor).then((photo) => {
      if (!photo) return;
      // a load that a newer create (a restart, the return from Try it) has overtaken is dropped
      if (token !== this.photoToken || !this.scene.isActive() || this.id !== id) return photo.destroy();
      this.photo?.destroy();
      this.photo = photo;
      this.drawPhoto();
    });
  }

  /** The photo behind the bars of the page shown. */
  private drawPhoto(): void {
    if (!this.photo || !this.layout) return;
    const hand = this.piece.notes.length > 0 && this.piece.notes.every((n) => n.hand === 'LH') ? 'LH' : 'RH';
    this.photo.draw(this.layout, { page: this.page, hand, origin: { x: this.staffLeft, y: this.staffTop }, gameCanvas: this.game.canvas, gameWidth: this.scale.width });
    // the photo lies over the canvas: a drop-down menu or the time panel drawn over the staff would be under it
    this.photo.setVisible(!this.menuOpen && this.panel === null && !this.scene.isPaused());
  }

  protected override openMenu(...args: Parameters<PixelScene['openMenu']>): void {
    super.openMenu(...args);
    this.photo?.setVisible(false);
  }

  /** G shows or hides the photo; comma and full stop move it a bar back or on against the piece's bars. */
  private photoKey(action: 'toggle' | -1 | 1): void {
    const photo = this.photo;
    if (!photo) return this.say(t('editor.photo.none'), MESSAGE_MS);
    if (action === 'toggle') photo.shown = !photo.shown;
    else photo.shift = Math.max(-photo.bars, Math.min(photo.bars, photo.shift + action));
    this.drawPhoto();
    if (action !== 'toggle') this.say(t('editor.photo.shift', { shift: photo.shift > 0 ? `+${photo.shift}` : String(photo.shift) }), MESSAGE_MS);
  }

  /** The piece as written now: the working piece of the entry state (history only lags behind while keys are held). */
  private get piece(): EditorPiece {
    return this.entryState.piece;
  }

  protected override clear(): void {
    this.lengthItem = null;
    this.restItem = null;
    this.saveButton = null;
    this.barsText = null;
    this.pickupText = null;
    this.meterText = null;
    this.timeGroups = [];
    this.bubble = null;
    this.staffButton = null;
    this.shortTapButton = null;
    this.dynamicButton = null;
    this.accidentalButton = null;
    this.repeatButton = null;
    this.drawnPiece = null;
    this.staffView?.destroy();
    this.staffView = null;
    this.ghost?.destroy();
    this.ghost = null;
    this.ghostLabel?.destroy();
    this.ghostLabel = null;
    this.shadows?.destroy();
    this.shadows = null;
    this.target?.destroy();
    this.target = null;
    this.cursorMark?.destroy();
    this.cursorMark = null;
    this.entryButton = null;
    this.pageText = null;
    this.status = null;
    this.listenButton = null;
    this.lengthButtons.clear();
    this.bpmText = null;
    this.removeTitleInput();
  }

  // ------------------------------------------------------------------------------------------------------------ input

  private hit(p: Phaser.Input.Pointer): Hit | null {
    if (!this.layout || !this.chart) return null;
    const y = p.y - this.staffTop;
    if (y < 0 || y > this.staffHeight) return null;
    return hitTest(this.layout, this.chart, { x: p.x - this.staffLeft, y }, this.page);
  }

  private handOf(trackId: string): EditorHand {
    return trackId === 'lh' ? 'LH' : 'RH';
  }

  private refOf(noteIndex: number): NoteRef | null {
    const note = this.chart?.notes[noteIndex];
    if (!note || !this.chart) return null;
    const bar = this.chart.bars[note.bar]!;
    return { hand: this.handOf(note.track), bar: note.bar, start: note.tick - bar.startTick, step: note.spelling.step, octave: note.spelling.octave };
  }

  private hover(p: Phaser.Input.Pointer): void {
    // an open menu covers the staff: no shadow note under it
    const hit = this.menuOpen ? null : this.hit(p);
    this.ghost?.clear();
    this.ghostLabel?.setVisible(false);
    // while a pick waits, the click under the pointer makes the pick's mark, not a note: that mark is what shows (d286)
    const picking = this.arcFrom !== null || this.graceFor !== null || this.repeatPick !== null;
    this.drawTarget(picking ? null : this.targetAt(hit));
    if (picking) return this.previewPick(p, hit);
    if (!hit || hit.kind !== 'place' || !this.layout || !this.chart || !this.ghost || !this.ghostLabel) return;
    const at = pointOf(this.layout, this.chart, hit)!;
    const S = this.layout.staffSpace;
    this.ghost.fillStyle(DEFAULT_THEME.cursor, 0.35).fillEllipse(at.x, this.staffTop + at.y, 1.3 * S, S);
    this.ghostLabel.setText(this.entry === 'rest' ? t('editor.entry.rest') : `${hit.step}${hit.octave}`).setPosition(this.staffLeft + at.x, this.staffTop + at.y - 1.6 * S).setVisible(true);
  }

  /**
   * The result of the click a waiting pick would take, drawn faint over the staff before the click (d286): a tie or slur from
   * its first note to the note under the pointer, or to the pointer itself while it is on no note it can end on
   * (ft_1_02d.AC25); the pre-note at the pointed pitch (ft_1_02d.AC26); the repeat's bars and signs (ft_1_02d.AC27).
   */
  private previewPick(p: Phaser.Input.Pointer, hit: Hit | null): void {
    if (!this.ghost || !this.layout || this.menuOpen) return;
    if (this.arcFrom) this.previewArc(this.ghost, this.layout, this.arcFrom, p, hit);
    else if (this.graceFor) this.previewGrace(this.ghost, this.layout, this.graceFor, hit);
    else if (this.repeatPick) this.previewRepeat(this.ghost, this.layout, this.repeatPick.startBar, hit);
  }

  /** A waiting tie or slur (ft_1_02d.AC25): its first note ringed, and the curve to the note under the pointer or to the pointer. */
  private previewArc(g: Phaser.GameObjects.Graphics, layout: StaffLayout, fromRef: NoteRef, p: Phaser.Input.Pointer, hit: Hit | null): void {
    const S = layout.staffSpace;
    const ink = DEFAULT_THEME.cursor;
    const onPage = (system: number) => layout.systems[system]?.page === this.page;
    const from = layout.notes.find((n) => n.index === this.indexOf(fromRef));
    if (!from || !onPage(from.system)) return;
    const into = hit?.kind === 'note' ? this.refOf(hit.noteIndex) : null;
    const marks = into ? this.marksOf(`arc:${hit?.kind === 'note' ? hit.noteIndex : ''}`, () => arcInto(this.piece, fromRef, into)) : null;
    const arcs = marks ? [...marks.ties.filter((m) => onPage(m.system)).map(tiePoints), ...marks.slurs.filter((m) => onPage(m.system)).map(slurPoints)] : [];
    // the first note is ringed, so the author sees which note the curve leaves
    g.lineStyle(Math.max(1, S * 0.12), ink, 0.9).strokeEllipse(from.x, this.staffTop + from.y, from.headRx * 2 + S * 0.6, from.headRy * 2 + S * 0.6);
    if (arcs.length > 0) {
      for (const arc of arcs) strokePolyline(g.lineStyle(Math.max(2, S * 0.16), ink, 0.85), arc.map((pt) => ({ x: pt.x, y: this.staffTop + pt.y })));
      return;
    }
    // on no note it can end on: a thin curve follows the pointer; the slur's side is away from the stem
    const up = !(from.stem?.up ?? true);
    const start = { x: from.x, y: this.staffTop + from.y + (up ? -1 : 1) * from.headRy };
    const end = { x: p.x - this.staffLeft, y: p.y };
    strokePolyline(g.lineStyle(Math.max(1, S * 0.1), ink, 0.45), pendingArc(start, end, up, S * 2));
  }

  /** A waiting pre-note (ft_1_02d.AC26): the small head the click would write, at the pitch under the pointer. */
  private previewGrace(g: Phaser.GameObjects.Graphics, layout: StaffLayout, graceRef: NoteRef, hit: Hit | null): void {
    const S = layout.staffSpace;
    const ink = DEFAULT_THEME.cursor;
    const pitch = hit?.kind === 'place' ? hit : hit?.kind === 'note' ? this.refOf(hit.noteIndex) : null;
    if (!pitch) return;
    for (const grace of this.marksOf(`grace:${pitch.step}${pitch.octave}`, () => graceFromPlace(this.piece, graceRef, pitch.step, pitch.octave)).graces) {
      if (layout.systems[grace.system]?.page !== this.page) continue;
      g.fillStyle(ink, 0.7).fillEllipse(grace.x, this.staffTop + grace.y, grace.headRx * 2, grace.headRy * 2);
      g.lineStyle(Math.max(1, S * 0.1), ink, 0.7).lineBetween(grace.stem.x, this.staffTop + grace.stem.y1, grace.stem.x, this.staffTop + grace.stem.y2);
      for (const ledger of grace.ledgerLines) g.lineBetween(ledger.x1, this.staffTop + ledger.y, ledger.x2, this.staffTop + ledger.y);
    }
  }

  /** The repeat item asking for its bars (ft_1_02d.AC27): the bars lit and the two signs where the click would put them. */
  private previewRepeat(g: Phaser.GameObjects.Graphics, layout: StaffLayout, startBar: number | null, hit: Hit | null): void {
    const S = layout.staffSpace;
    const ink = DEFAULT_THEME.cursor;
    const bar = hit ? this.barOf(hit) : null;
    if (bar === null) return;
    const { boxes, signs } = repeatPreview(layout, startBar, bar, this.page);
    for (const box of boxes) g.fillStyle(ink, 0.14).fillRect(box.x1, this.staffTop + box.y1, box.x2 - box.x1, box.y2 - box.y1);
    // the thick bar and its two dots of each sign, the dots on the side of the repeated bars
    for (const sign of signs) {
      const x = sign.side === 'start' ? sign.x + S * 0.25 : sign.x - S * 0.25;
      const mid = this.staffTop + (sign.y1 + sign.y2) / 2;
      const dx = (sign.side === 'start' ? 1 : -1) * S * 0.8;
      g.fillStyle(ink, 0.8).fillRect(x - S * 0.25, this.staffTop + sign.y1, S * 0.5, sign.y2 - sign.y1);
      g.fillCircle(x + dx, mid - S * 0.5, S * 0.22).fillCircle(x + dx, mid + S * 0.5, S * 0.22);
    }
  }

  /**
   * The marks an edit would add to the staff as it is drawn now (none when it is refused), laid out once per target: kept
   * while the pointer stays on the same note or pitch and the piece is unchanged, so a moving pointer lays out nothing.
   */
  private marksOf(key: string, edit: () => Edit): AddedMarks {
    if (this.previewCache?.piece === this.piece && this.previewCache.key === key) return this.previewCache.marks;
    const made = edit();
    const marks = made.ok && this.layout ? addedMarks(this.layout, editorStaff(made.piece, toChart(made.piece, { id: this.id ?? DRAFT_ID }), this.staffViewport())) : { ties: [], slurs: [], graces: [] };
    this.previewCache = { piece: this.piece, key, marks };
    return marks;
  }

  /** What an action at `hit` changes: the chord under it or in its column, a placed rest, or the room a new note takes. */
  private targetAt(hit: Hit | null): ActionTarget | null {
    if (hit?.kind === 'note') {
      const ref = this.refOf(hit.noteIndex);
      return ref ? targetOf(this.piece, ref, this.length, this.entry) : null;
    }
    return hit?.kind === 'place' ? targetOf(this.piece, hit, this.length, this.entry) : null;
  }

  /** A soft box over the part of the bar the pointer's action would change, on its hand's staff. */
  private drawTarget(target: ActionTarget | null): void {
    this.target?.clear();
    const box = target && this.layout ? targetBox(this.layout, target) : null;
    if (!box || !this.target || box.page !== this.page) return;
    const y = this.staffTop + box.y1;
    this.target.fillStyle(DEFAULT_THEME.cursor, 0.12).fillRect(box.x1, y, box.x2 - box.x1, box.y2 - box.y1);
    this.target.lineStyle(1, DEFAULT_THEME.cursor, 0.5).strokeRect(box.x1, y, box.x2 - box.x1, box.y2 - box.y1);
  }

  /**
   * A press on the staff: the middle button (or Alt + left) places and changes notes, the left
   * button selects, Shift + left extends the bar selection, a left drag is the lasso, and the right button removes.
   */
  private press(p: Phaser.Input.Pointer): void {
    const event = p.event as MouseEvent | undefined;
    const action = mouseAction({ button: event?.button ?? p.button, altKey: !!event?.altKey, shiftKey: !!event?.shiftKey });
    // every press starts afresh; only a left press on the staff can become a lasso
    this.endLassoState();
    if (action === 'select' && this.grabRepeatHandle(p)) return;
    const hit = this.hit(p);
    if (!hit || action === 'none' || this.meterAsk !== null) return;
    if (this.repeatPick) {
      const bar = this.barOf(hit);
      if (action === 'remove' || bar === null) {
        this.disarm();
        return this.refreshStaff();
      }
      return this.pickRepeatBar(bar);
    }
    if (action !== 'remove' && this.askMeter(this.barOf(hit) ?? 0)) return;
    if (action === 'select') this.lassoFrom = { x: p.x, y: p.y };
    if (this.barPress(hit, action)) return;
    const ctrl = !!event?.ctrlKey || !!event?.metaKey;
    if (hit.kind === 'note') return this.pressNote(hit.noteIndex, action, ctrl);
    if (action === 'remove') {
      // a right click on a rest the author placed takes it away
      if (hit.kind === 'place') this.apply(removeRest(this.piece, { hand: this.handOf(hit.trackId), bar: hit.bar, start: hit.start }), null);
      return;
    }
    // a press on a clef or the key signature opens the circle of fifths to set the key, on the time signature the time panel
    if (hit.kind === 'key') return this.openCircle();
    if (hit.kind === 'time') return this.openPanel('time');
    if (action === 'select') return this.selectSpot(hit);
    this.placeAt(this.length, hit);
  }

  /** A press on a note head: remove (right), end a waiting pick, select it (left), or lengthen it, Ctrl shortens (middle). */
  private pressNote(noteIndex: number, action: MouseAction, ctrl: boolean): void {
    const ref = this.refOf(noteIndex);
    if (!ref) return;
    if (action === 'remove') return this.apply(removeNote(this.piece, ref), null);
    if (this.pickWaits()) return this.endPick(ref);
    this.keyCursor = ref;
    this.select(ref);
    if (action === 'place') this.apply(ctrl ? shorten(this.piece, ref) : lengthen(this.piece, ref), ref);
  }

  /** A left click on an empty spot: nothing stays selected, and the next played key goes there (the entry cursor). */
  private selectSpot(hit: Extract<Hit, { kind: 'place' }>): void {
    this.selected = null;
    this.keyCursor = this.cursorAtHit(hit);
    this.entryState = moveCursor(this.entryState, this.handOf(hit.trackId), hit.bar, hit.start);
    this.refreshStaff();
  }

  /** The middle button on a place: a note or rest of the current length, joining a chord or taking a placed rest's place. */
  private placeAt(length: EditorLength, hit: Extract<Hit, { kind: 'place' }>): void {
    this.keyCursor = this.cursorAtHit(hit);
    // a length that does not fit gives way to the longest that does (autoLength): Alt + Enter asks for a whole
    const click = placeClick(this.piece, hit, length, this.entry);
    if (click.kind === 'select') {
      this.selected = click.ref;
      this.refreshStaff();
      return;
    }
    this.follow = hit.bar;
    const before = this.piece;
    if (click.kind === 'addRest') {
      this.apply(placeRest(this.piece, click.rest), null);
      this.placeCursor(click.rest);
      if (this.piece !== before) this.guessLength(click.rest);
      return;
    }
    // a new note is not selected: a length key after it sets the length of the next note, not of this one; on a place
    // where notes already start it joins them as a chord, and on a rest the author placed it takes the rest's place
    const base = click.over ? removeRest(this.piece, click.over) : null;
    this.apply(placeNote(base?.ok ? base.piece : this.piece, click.note), null);
    this.placeCursor(click.note);
    if (this.piece !== before) this.guessLength(click.note);
  }

  /** After a note or rest is written, the length of the next one is guessed from it (ft_1_02d.AC20). */
  private guessLength(placed: { start: number; length: EditorLength }): void {
    // only once the time signature is set, so not while the A time waits for its first bar
    if (this.meterAuto) return;
    const next = nextLength(this.piece, placed);
    if (next === this.length) return;
    this.length = next;
    for (const [l, button] of this.lengthButtons) button.setActive(l === next);
    this.showLength();
  }

  /** A press on the bar selection's drag-repeat handle takes hold of it (ft_1_02d.AC24); true when it did. */
  private grabRepeatHandle(p: Phaser.Input.Pointer): boolean {
    if (!this.barSel || !this.layout || this.repeatPick || this.meterAsk !== null) return false;
    if (!onRepeatHandle(this.layout, this.barSel, this.page, { x: p.x - this.staffLeft, y: p.y - this.staffTop })) return false;
    this.repeatDrag = { range: this.barSel, copies: 0 };
    return true;
  }

  /** While the handle is held: the copies the drag reaches, as ghost bars and a count; dragged back, none. */
  private dragRepeat(p: Phaser.Input.Pointer): void {
    const drag = this.repeatDrag;
    if (!drag || !this.layout || !p.leftButtonDown()) return;
    const copies = repeatCopies(this.layout, drag.range, this.page, { x: p.x - this.staffLeft, y: p.y - this.staffTop });
    if (copies === drag.copies) return;
    drag.copies = copies;
    this.repeatGhost ??= this.add.graphics().setDepth(5);
    this.repeatGhost.clear().setX(this.staffLeft);
    const length = drag.range.to - drag.range.from + 1;
    for (const box of barBoxes(this.layout, { from: drag.range.to + 1, to: drag.range.to + copies * length })) {
      if (box.page === this.page) this.repeatGhost.lineStyle(1, DEFAULT_THEME.cursor, 0.7).strokeRect(box.x1, this.staffTop + box.y1, box.x2 - box.x1, box.y2 - box.y1);
    }
    this.say(copies > 0 ? t('editor.dragRepeat.copies', { n: copies }) : t('editor.dragRepeat.none'), MESSAGE_MS);
  }

  /** The handle is let go: its copies go in right after the selection, as paste puts them (one undo step); none, nothing. */
  private endRepeat(): void {
    const drag = this.repeatDrag;
    this.repeatDrag = null;
    this.repeatGhost?.clear();
    if (!drag || drag.copies === 0) return;
    this.apply(insertBars(this.piece, drag.range.to + 1, copyBars(this.piece, drag.range), drag.copies), null);
  }

  /**
   * The chord under the selected note (ft_1_29 slice D): the notes of both hands that start with it, named once when the
   * selection comes to a column or its notes change. A column that is no chord the dictionary knows says nothing.
   */
  private nameSelectedChord(): void {
    const at = this.selected;
    const keys = at ? this.piece.notes.filter((n) => n.bar === at.bar && n.start === at.start).map(soundingMidi) : [];
    // a new column, or a note added to or taken from this one
    const column = at ? `${at.bar}:${at.start}:${[...keys].sort((a, b) => a - b).join(',')}` : null;
    if (column === this.namedColumn) return;
    this.namedColumn = column;
    if (!at) return;
    const chord = nameChord(CHORDS, keys);
    if (chord) this.say(t('editor.chordName', { chord: chordLabel(chord, contextOf(this).profiles.noteNaming) }), MESSAGE_MS);
  }

  /** The left button comes up: it ends a drag of the repeat handle or of the lasso. */
  private endPointerDrag(p: Phaser.Input.Pointer): void {
    if (this.repeatDrag) return this.endRepeat();
    this.endLasso(p);
  }

  /** No lasso waits: no start point, not dragging, no frame drawn. */
  private endLassoState(): void {
    this.lassoFrom = null;
    this.lassoActive = false;
    this.lassoBox?.clear();
  }

  /** While the left button is down: past LASSO_START art pixels the press is a lasso, drawn as a frame. */
  private dragLasso(p: Phaser.Input.Pointer): void {
    if (!this.lassoFrom || !p.leftButtonDown()) return;
    const art = this.scale.width / 320;
    if (!this.lassoActive && Math.hypot(p.x - this.lassoFrom.x, p.y - this.lassoFrom.y) <= LASSO_START * art) return;
    this.lassoActive = true;
    this.lassoBox ??= this.add.graphics();
    const { x, y } = this.lassoFrom;
    this.lassoBox.clear().lineStyle(1, DEFAULT_THEME.cursor, 0.9).strokeRect(Math.min(x, p.x), Math.min(y, p.y), Math.abs(p.x - x), Math.abs(p.y - y));
  }

  /** The left button comes up: a lasso selects every bar it touched (both staves), and a click stays a click. */
  private endLasso(p: Phaser.Input.Pointer): void {
    const from = this.lassoFrom;
    const active = this.lassoActive;
    this.endLassoState();
    if (!from || !active || !this.layout) return;
    const range = barsInRect(this.layout, this.page, { x1: from.x - this.staffLeft, y1: from.y - this.staffTop, x2: p.x - this.staffLeft, y2: p.y - this.staffTop });
    if (!range) return;
    this.barSel = range;
    this.barAnchor = range.from;
    this.selected = null;
    this.refreshStaff();
  }

  /** A press with bars around it: Shift + left click extends the bar selection, and any other press clears it first. True when the press only selected bars. */
  private barPress(hit: Hit, action: MouseAction): boolean {
    // a pick waits only for a note; any other press ends it (core_09.AC13)
    if (hit.kind !== 'note') this.disarm();
    const bar = this.barOf(hit);
    if (action === 'extend') {
      if (bar !== null) this.extendBarSelection(bar);
      return true;
    }
    if (bar !== null) this.barAnchor = bar;
    if (this.barSel) {
      this.barSel = null;
      this.refreshStaff();
    }
    return false;
  }

  /** The keys for bars: Ctrl+C, X and V work with or without a selection; with bars selected, the arrows move them, Delete clears them and Esc clears the selection. True when taken. */
  private barKey(e: KeyboardEvent, ctrl: boolean): boolean {
    const take = (action: () => void): boolean => {
      e.preventDefault();
      e.stopPropagation();
      action();
      return true;
    };
    // Alt + left click places: a lone Alt would move the keys to the browser's menu on Windows
    if (e.key === 'Alt') return take(() => undefined);
    if (ctrl && e.code === 'KeyC') return take(() => this.copyBar());
    if (ctrl && e.code === 'KeyX') return take(() => this.cutSelection());
    if (ctrl && e.code === 'KeyV') return take(() => this.pasteSelection());
    if (e.code === 'Insert' && !ctrl) return take(() => this.insertBlank());
    const sel = this.barSel;
    if (!sel) return false;
    // Shift + up or down moves the notes of the selected bars (Ctrl: an octave); the plain arrows move the cursor (ft_1_02d.AC16)
    if (e.shiftKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) return take(() => this.moveSelectedBars(e.code === 'ArrowUp' ? 1 : -1, ctrl ? 'octave' : 'step'));
    if (e.code === 'Backspace' || e.code === 'Delete') return take(() => this.change(clearBars(this.piece, sel)));
    if (e.code === 'Escape') {
      return take(() => {
        this.barSel = null;
        this.refreshStaff();
      });
    }
    return false;
  }

  /**
   * The keys of the keyboard cursor (ft_1_02d.AC15 to AC18): the arrows move it (Ctrl: by bar, or to the
   * other staff), Shift + up or down moves the note under it, Shift + left or right makes that note shorter or longer,
   * Ctrl + Shift + left or right selects bars, Enter places a note or rest, Shift + Enter holds the note on with a tie, and C
   * builds a chord on the cursor's pitch. True when taken.
   */
  private cursorKey(e: KeyboardEvent, ctrl: boolean): boolean {
    const code = e.code;
    const arrow = code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowDown';
    const enter = code === 'Enter' || code === 'NumpadEnter';
    const chord = code === 'KeyC' && !ctrl && !e.shiftKey && !e.altKey;
    // an open menu covers the staff: its keys are the menu's
    if ((!arrow && !enter && !chord) || this.menuOpen) return false;
    e.preventDefault();
    e.stopPropagation();
    // the first arrow only shows the cursor, where writing goes on
    const shown = this.keyCursor;
    const c = shown ?? this.defaultCursor();
    if (chord) this.chordKey(c);
    else if (enter) this.enterKey(c, e.shiftKey, ctrl, e.altKey);
    else if (!shown) this.setKeyCursor(c);
    else this.arrowKey(c, code, ctrl, e.shiftKey);
    return true;
  }

  /** An arrow with the cursor shown: a move of the cursor, a change of the note under it, or (Ctrl + Shift) bar selection. */
  private arrowKey(c: KeyCursor, code: string, ctrl: boolean, shift: boolean): void {
    const vertical = code === 'ArrowUp' || code === 'ArrowDown';
    const direction = code === 'ArrowUp' || code === 'ArrowRight' ? 1 : -1;
    if (shift && vertical) return this.moveNoteAtCursor(c, direction, ctrl);
    if (shift && ctrl) {
      // Ctrl + Shift + left or right: the bar selection grows bar by bar from the cursor's bar
      if (!this.barSel) this.barAnchor = c.bar;
      const next = moveBar(this.piece, { ...c, start: 0 }, direction);
      this.keyCursor = next;
      this.extendBarSelection(next.bar);
      return;
    }
    if (shift) return this.lengthAtCursor(c, direction);
    // a plain arrow ends the bar selection, and its band goes from the staff
    const hadBars = this.barSel !== null;
    this.barSel = null;
    if (vertical) return this.setKeyCursor(ctrl ? otherStaff(this.piece, c, this.length, direction) : movePitch(c, direction), hadBars);
    this.setKeyCursor(ctrl ? moveBar(this.piece, c, direction) : moveInTime(this.piece, c, direction, this.length), hadBars);
  }

  /** Where the cursor appears first: on the selected note, else where the next note of the first staff goes. */
  private defaultCursor(): KeyCursor {
    if (this.selected) return this.selected;
    const start = startKeyCursor(this.piece);
    const at = cursorOf(this.piece, start.hand);
    return at ? { ...start, ...at } : start;
  }

  private cursorAtHit(hit: Extract<Hit, { kind: 'place' }>): KeyCursor {
    return { hand: this.handOf(hit.trackId), bar: hit.bar, start: hit.start, step: hit.step, octave: hit.octave };
  }

  /**
   * Moves the cursor: on a note it selects it (so F, the accidentals, Delete and the lengths act on it); on a free place the
   * next played key goes there. The staff is drawn again only when the selection or the page changes.
   */
  private setKeyCursor(c: KeyCursor, redraw = false): void {
    if (this.meterAsk !== null || this.askMeter(c.bar)) return;
    this.keyCursor = c;
    this.barAnchor = c.bar;
    const on = findNote(this.piece, c) ? c : null;
    if (!on) this.entryState = moveCursor(this.entryState, c.hand, c.bar, c.start);
    const page = this.layout ? pageOfBar(this.layout, c.bar) : this.page;
    const same = (a: NoteRef | null, b: NoteRef | null) => a === b || (!!a && !!b && a.hand === b.hand && a.bar === b.bar && a.start === b.start && a.step === b.step && a.octave === b.octave);
    if (!redraw && same(on, this.selected) && page === this.page) return this.drawKeyCursor();
    this.selected = on;
    this.follow = c.bar;
    this.refreshStaff();
  }

  /**
   * Enter places a note or rest of the selected length at the cursor and the cursor stays on it, selecting it; Ctrl + Enter
   * places it and moves on to the next place; Shift + Enter holds the note under it on with a tie (ft_1_02d.AC17).
   * Enter on a note already there makes it a step longer; Alt + Enter writes the longest note that fits before the next
   * note or the bar line, or makes the note there that long (ft_1_02d.AC22).
   */
  private enterKey(c: KeyCursor, shift: boolean, ctrl: boolean, alt = false): void {
    if (!shift && !ctrl && findNote(this.piece, c)) {
      this.keyCursor = c;
      return this.apply(alt ? longestFit(this.piece, c) : lengthen(this.piece, c), c);
    }
    if (!shift) {
      const clef = c.hand === 'LH' ? 'bass' : 'treble';
      const before = this.piece;
      this.placeAt(alt ? 'whole' : this.length, { kind: 'place', staff: 0, trackId: c.hand.toLowerCase(), clef, bar: c.bar, start: c.start, position: staffPosition({ step: c.step, alter: 0, octave: c.octave }, clef), step: c.step, octave: c.octave });
      // a refused place leaves the cursor where it was; Ctrl + Enter on the same note already there moves on too
      const there = findNote(this.piece, c);
      if (ctrl && (this.piece !== before || there)) return this.setKeyCursor(moveInTime(this.piece, c, 1, this.length), true);
      // the cursor stays on what Enter wrote; the next played key still goes after it (placeAt set that)
      this.keyCursor = c;
      this.barAnchor = c.bar;
      if (there) return this.select(c);
      return this.drawKeyCursor();
    }
    if (!findNote(this.piece, c)) return this.say(t('editor.cursor.none'), MESSAGE_MS);
    const made = repeatTied(this.piece, c, this.length);
    if (!made.ok) return this.apply(made, c);
    this.follow = made.into.bar;
    this.apply({ ok: true, piece: made.piece }, null);
    this.setKeyCursor(made.into);
  }

  /** The chord key (ft_1_02d.AC18): a chord on the cursor's pitch; pressed again on the same root it cycles through the shapes. */
  private chordKey(c: KeyCursor): void {
    const made = chordKeyPress(this.piece, c, this.length);
    if (!made.ok) return this.apply(made, null);
    this.follow = c.bar;
    this.keyCursor = c;
    this.apply({ ok: true, piece: made.piece }, c);
    this.say(t('editor.chord.shape', { shape: made.shape.join('-') }), MESSAGE_MS);
  }

  /** Shift + up or down: the note under the cursor (one head of a chord) a step or, with Ctrl, an octave; a tie that no longer holds becomes a slur (ft_1_02d.AC16). */
  private moveNoteAtCursor(c: KeyCursor, direction: 1 | -1, octave: boolean): void {
    if (!findNote(this.piece, c)) return this.say(t('editor.cursor.none'), MESSAGE_MS);
    const made = moveNoteKeepingLegato(this.piece, c, direction, octave);
    if (!made.ok) return this.apply(made, c);
    this.keyCursor = withPitch(c, made.to);
    this.apply({ ok: true, piece: made.piece }, made.to);
  }

  /** Shift + left or right: the note under the cursor, with its chord, one length shorter or longer. */
  private lengthAtCursor(c: KeyCursor, direction: 1 | -1): void {
    if (!findNote(this.piece, c)) return this.say(t('editor.cursor.none'), MESSAGE_MS);
    this.apply(direction > 0 ? lengthen(this.piece, c) : shorten(this.piece, c), c);
  }

  /** The cursor on the staff: a thin line across its staff at its time, and a ring at its pitch (on the page shown). */
  private drawKeyCursor(): void {
    this.cursorMark ??= this.add.graphics();
    this.cursorMark.clear().setDepth(9);
    const c = this.keyCursor;
    if (c && c.bar >= this.piece.bars) this.keyCursor = null;
    if (!c || !this.layout || c.bar >= this.piece.bars) return;
    const bar = this.layout.bars[c.bar];
    const system = bar ? this.layout.systems[bar.system] : undefined;
    const staff = system?.staves.find((st) => st.trackId === c.hand.toLowerCase());
    const at = this.pointForNote(c);
    if (!system || !staff || !at || system.page !== this.page) return;
    const S = this.layout.staffSpace;
    const art = this.scale.width / 320;
    this.cursorMark.lineStyle(Math.max(1, art), DEFAULT_THEME.cursor, 0.6);
    this.cursorMark.lineBetween(at.x, this.staffTop + staff.topLineY - S, at.x, this.staffTop + staff.bottomLineY + S);
    this.cursorMark.lineStyle(Math.max(1, art), DEFAULT_THEME.cursor, 0.9).strokeEllipse(at.x, at.y, 1.6 * S, 1.2 * S);
  }

  /** The bar a hit is in, for the bar selection; null where there is no bar (the key signature). */
  private barOf(hit: Hit): number | null {
    if (hit.kind === 'note') return this.chart?.notes[hit.noteIndex]?.bar ?? null;
    return hit.kind === 'place' ? hit.bar : null;
  }

  /** Shift + click: the bars from the anchor to `bar`, both included. */
  private extendBarSelection(bar: number): void {
    const from = this.barAnchor ?? bar;
    this.barSel = { from: Math.min(from, bar), to: Math.max(from, bar) };
    this.refreshStaff();
  }

  /** A click on a shadow note also sets where the next played key goes (the entry cursor of its hand). */
  private placeCursor(at: { hand: EditorHand; bar: number; start: number }): void {
    // the cursor goes to the end of what the click wrote, so the next key fills the gap after it (not a chord with it)
    const next = cursorAfter(this.piece, at.hand, at.bar, at.start);
    if (next) this.entryState = moveCursor(this.entryState, at.hand, next.bar, next.start);
  }

  /**
   * Over a note, or in the column of a chord, the wheel moves all the chord's notes and Ctrl + wheel changes its length;
   * Ctrl + wheel on a placed rest changes its length too; elsewhere the wheel cycles the current length (ft_1_02d.AC3) and
   * Ctrl + wheel does nothing.
   */
  private wheel(p: Phaser.Input.Pointer, dy: number): void {
    // over the band's inventory the wheel is the band's (ft_1_20.AC16), the notes' and the rests' items too
    if (this.menuOpen || this.pointerOnInventory(p)) return;
    if (this.wheelOverControls(p, dy)) return;
    const target = this.targetAt(this.hit(p));
    const ref = target?.notes[0] ?? null;
    const ctrl = p.event.ctrlKey || p.event.metaKey;
    // a placed rest under the pointer: Ctrl + wheel changes its length as on a note; it has no pitch to move
    const rest = !ref && target && placedRests(this.piece).some((r) => r.hand === target.hand && r.bar === target.bar && r.start === target.start) ? target : null;
    if (rest && ctrl) {
      if (dy === 0) return;
      const at = { hand: rest.hand, bar: rest.bar, start: rest.start };
      this.apply(dy < 0 ? lengthenRest(this.piece, at) : shortenRest(this.piece, at), null);
      return;
    }
    if (ref) {
      if (dy === 0) return;
      if (ctrl) this.apply(dy < 0 ? lengthen(this.piece, ref) : shorten(this.piece, ref), ref);
      else this.apply(stepChord(this.piece, ref, dy < 0 ? 1 : -1), ref);
      return;
    }
    if (ctrl) return;
    if (dy === 0) return;
    // stops at the longest length the bar holds (no whole note in 3/4), like the length buttons, and at the eighth
    const next = cycleLength(this.length, dy < 0 ? 'longer' : 'shorter');
    if (lengthsFor(this.piece).includes(next)) this.chooseLength(next);
  }

  private key(e: KeyboardEvent): void {
    if (!this.scene.isActive() || document.activeElement === this.titleInput) return; // typing the title
    // the computer keyboard is no piano here (ft_1_02d.AC14): the piano's listener comes after this one and never hears its keys
    if (PIANO_KEYS.test(e.code)) e.stopPropagation();
    if (this.keyMenu && this.keyMenuKey(e)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (this.menuOrPanelKey(e) || this.shortcutKey(e)) return;
    if (ctrl && (e.code === 'KeyZ' || e.code === 'KeyY')) {
      handled();
      if (e.code === 'KeyY' || e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (this.toolKey(e, ctrl)) return;
    if (e.code === 'PageUp' || e.code === 'PageDown') {
      handled();
      this.turnPage(e.code === 'PageUp' ? -1 : 1);
      return;
    }
    if (this.barKey(e, ctrl) || this.cursorKey(e, ctrl)) return;
    if (e.code === 'Backspace') {
      handled();
      this.backspace();
    } else if (e.code === 'Delete') {
      handled();
      this.deleteSelected();
    } else if (e.code === 'Escape') {
      handled();
      // a waiting pick (a tie or slur, a pre-note, the repeat's bars) ends first; a second Esc leaves
      if (this.arcFrom || this.graceFor || this.repeatPick) {
        this.disarm();
        this.refreshStaff();
      } else this.leave();
    }
  }

  /**
   * A key of the band's tools (ft_1_02d.AC19; the table is `EDITOR_KEYS`): F1 shows every key on the band,
   * a tool with choices opens its menu with a number on each choice, the others act at once. Undo, redo, Delete, copy and
   * the chord keep their own handlers. True when taken.
   */
  private shortcutKey(e: KeyboardEvent): boolean {
    const name = editorKeyOf(e);
    if (!name) return false;
    const act = this.shortcutActs(name);
    if (!act) return false;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) act();
    return true;
  }

  /** What a tool's key does, or null for the keys handled elsewhere. */
  private shortcutActs(name: EditorKeyName): (() => void) | null {
    const acts: Partial<Record<EditorKeyName, () => void>> = {
      help: () => this.toggleShortcuts(),
      listen: () => this.listen(),
      tryIt: () => this.tryIt(),
      save: () => void this.save(),
      exportFile: () => void this.exportFile(),
      importFile: () => void this.importFile(),
      photo: () => this.photoKey('toggle'),
      photoBack: () => this.photoKey(-1),
      photoOn: () => this.photoKey(1),
      piece: () => this.openPanel('time'),
      notes: () => this.lengthKey('note'),
      rests: () => this.lengthKey('rest'),
      accidentals: () => this.cycleAccidental(),
      ties: () => this.openKeyMenu('ties', this.arcItems(), 0, ITEM_MENU_CELL, 3),
      dynamics: () => this.openKeyMenu('dynamics', this.dynamicItems(), this.nextDynamicIndex(), ITEM_MENU_CELL, 7),
      fingers: () => this.fingerKey(),
      repeats: () => this.pressRepeat(),
      staff: () => this.openKeyMenu('staff', this.staffItems(), (STAFF_ORDER.indexOf(this.staffMode) + 1) % STAFF_ORDER.length, { w: 40, h: BAR_BUTTON_HEIGHT }, 3),
      shortTap: () => this.toggleShortTap(),
      paste: () => this.openKeyMenu('paste', this.pasteItems(), 0, { w: PASTE_ITEM_WIDTH, h: BAR_BUTTON_HEIGHT }, 3, ['1', '2', '4']),
    };
    return acts[name] ?? null;
  }

  /** N or R: notes or rests, then the length menu, numbered as the length keys are (3 is the dotted half); the quarter is the default. */
  private lengthKey(entry: EntryMode): void {
    const items = this.lengthItems(entry);
    const digits = LENGTH_ORDER.map((l) => Object.entries(KEY_LENGTHS).find(([code, v]) => v === l && code.startsWith('Digit'))![0].slice('Digit'.length));
    this.openKeyMenu(entry === 'note' ? 'notes' : 'rests', items, LENGTH_ORDER.indexOf('quarter'), ITEM_MENU_CELL, LENGTH_ORDER.length, digits);
  }

  /**
   * Opens the choices of a tool's key from its band item (or over the band when the item is on another page), a number on
   * each choice (1 up, or `digits`).
   */
  private openKeyMenu(name: EditorKeyName, items: MenuItem[], fallback: number, cell: { w: number; h: number }, columns: number, digits?: readonly string[]): void {
    const numbered = items.map((item, i) => ({ ...item, shortcut: digits?.[i] ?? String(i + 1) }));
    const { width } = this.px;
    const anchor = this.shortcutButtons.get(EDITOR_KEYS[name].label) ?? { rect: { x: width / 2 - 10, y: this.mainRows, width: 20, height: 1 } };
    this.openMenu(anchor, numbered, { cell, columns, open: 'above' });
    this.keyMenu = { items: numbered, fallback: Math.max(0, fallback) };
  }

  /**
   * A key while a key's menu is open: a digit picks its choice, Esc closes it, and any other key takes the default choice
   * and closes it, then does its own work (Enter writes, an arrow moves). True when the key is used up.
   */
  /** A menu closed any way (a click off it, a pick) takes its key's choices with it, so a later mouse menu is not read as one. */
  protected override closeMenu(): void {
    this.keyMenu = null;
    super.closeMenu();
    if (this.photo) this.drawPhoto();
  }

  private keyMenuKey(e: KeyboardEvent): boolean {
    const menu = this.keyMenu!;
    const take = () => {
      e.preventDefault();
      e.stopPropagation();
      return true;
    };
    // a modifier alone, or the menu's own key held down (its auto-repeat), is no choice
    if (e.repeat || e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt') return take();
    const close = () => this.closeMenu();
    if (e.code === 'Escape') {
      close();
      return take();
    }
    const digit = digitOf(e.code);
    if (digit !== null) {
      const item = menu.items.find((i) => i.shortcut === String(digit));
      if (item && !item.disabled) {
        close();
        item.onPick();
      }
      return take();
    }
    const fallback = menu.items[menu.fallback];
    close();
    if (fallback && !fallback.disabled) fallback.onPick();
    return false;
  }

  /**
   * F1 (ft_1_33.AC1, AC2): over the staff from `top` (art rows) a panel of cards, one per simple mouse action: the held key,
   * the small mouse with what is pressed, the staff before, an arrow, the staff after; under them the Keys button that starts
   * Kiur's tour (ft_1_33.AC3). Each tool shows its own key on its button (ft_1_02d.AC19). Hidden while the tour runs.
   * Placement is `helpGridLayout`.
   */
  private drawKeyHelp(top: number): void {
    if (!this.shortcutsShown || this.touring) return;
    const { width } = this.px;
    const layer = this.overStaff();
    // a key's name as it is printed on the key (keepCase): small capitals would not fit the cap
    const capWord = (key: HeldKey) => new PixelText(this, 0, 0, t(KEY_CAP[key]), { color: C.ink, keepCase: true });
    const capWidth = (word: PixelText) => word.width + HELP_CAP.pad;
    const widest = Math.max(...(Object.keys(KEY_CAP) as HeldKey[]).map((key) => {
      const word = capWord(key);
      const w = capWidth(word);
      word.destroy();
      return w;
    }));
    const keysWidth = measure(drawnText(t('editor.help.keys'))) + LABEL_PAD;
    const plan = helpGridLayout({
      panel: { x: 0, y: top, w: width, h: this.mainRows - top },
      count: HELP_CARDS.length,
      columns: HELP_COLUMNS,
      parts: { cap: { w: widest, h: HELP_CAP.h }, mouse: GESTURE_SIZE, sketch: SKETCH_SIZE, arrow: { w: HELP_ARROW.width, h: HELP_ARROW.height } },
      keys: { w: keysWidth, h: BAR_BUTTON_HEIGHT },
    });
    layer.add(new PixelImage(this, 0, top, panelBitmap(Math.max(5, width), plan.height, 'panel')));
    HELP_CARDS.forEach((card, i) => {
      const at = plan.cards[i]!;
      if (card.key) {
        const word = capWord(card.key);
        const cap = keyCap(capWidth(word), HELP_CAP.h);
        const capImage = new PixelImage(this, at.capRight - cap.width, at.capY, cap);
        layer.add(capImage);
        layer.add(word.setPosition(capImage.x + Math.floor(HELP_CAP.pad / 2), capImage.y + 2));
      }
      layer.add(new PixelImage(this, at.mouse.x, at.mouse.y, gesturePicture(card.gesture)).setName(`helpMouse.${i}`));
      layer.add(new PixelImage(this, at.before.x, at.before.y, staffSketch(card.before)));
      layer.add(new PixelImage(this, at.arrow.x, at.arrow.y, HELP_ARROW));
      layer.add(new PixelImage(this, at.after.x, at.after.y, staffSketch(card.after)));
    });
    const k = plan.keys;
    this.buttonOn(layer, { x: k.x + k.w / 2, y: k.y + k.h / 2, width: k.w, height: k.h, label: t('editor.help.keys'), tooltip: t('editor.help.keys.tip'), onClick: () => this.startKeyTour() });
  }

  /**
   * Kiur's tour of the keys on the staff (ft_1_33.AC3), through the first-run intro's spotlight (ft_1_31): the cursor is
   * shown first, where writing goes on; the help panel is hidden while it runs and is there again after it. The piece is not
   * touched.
   */
  private startKeyTour(): void {
    if (this.touring || this.menuOpen || !this.scene.isActive()) return;
    if (!this.keyCursor) this.setKeyCursor(this.defaultCursor());
    this.touring = true;
    this.redraw();
    const steps = KEY_TOUR.map((step) => ({ spot: this.tourSpot(step.spot), text: t(step.line) }));
    // the screen runs again a frame after the overlay closes: the help comes back then
    this.events.once('resume', () => {
      this.touring = false;
      this.redraw();
    });
    void openOverlay(this, 'intro', { steps, skippable: false });
  }

  /** Where a thing the keys tour shows is, in art pixels of the whole screen; null when it is not drawn. */
  private tourSpot(spot: KeyTourSpot): Rect | null {
    const scale = this.px.scale;
    const fromScreen = (x1: number, y1: number, x2: number, y2: number): Rect => ({ x: Math.floor(x1 / scale), y: Math.floor(y1 / scale), w: Math.ceil((x2 - x1) / scale), h: Math.ceil((y2 - y1) / scale) });
    if (spot === 'band') {
      const bandTop = this.bandTop;
      if (this.bandShown && bandTop !== null) return { x: 0, y: this.mainTopRows + bandTop, w: this.px.width, h: BAND_ROWS };
      return { x: 0, y: this.mainTopRows, w: this.px.width, h: OPTIONS };
    }
    const c = this.keyCursor;
    const bar = c && this.layout ? this.layout.bars[c.bar] : undefined;
    const system = bar && this.layout ? this.layout.systems[bar.system] : undefined;
    if (!c || !bar || !system || system.page !== this.page) return null;
    const S = this.layout!.staffSpace;
    if (spot === 'bar') return fromScreen(this.staffLeft + bar.x, this.staffTop + system.topLineY - 2 * S, this.staffLeft + bar.x + bar.width, this.staffTop + system.bottomLineY + 2 * S);
    const staff = system.staves.find((st) => st.trackId === c.hand.toLowerCase());
    const at = this.pointForNote(c);
    if (!staff || !at) return null;
    return fromScreen(at.x - 1.5 * S, this.staffTop + staff.topLineY - 2 * S, at.x + 1.5 * S, this.staffTop + staff.bottomLineY + 2 * S);
  }

  /** F1: the keys on every band item and the mouse picture over the staff (ft_1_33), or neither. */
  private toggleShortcuts(): void {
    this.shortcutsShown = !this.shortcutsShown;
    this.redraw();
  }

  /** The dynamic the button would set next (pp to ff, then none, at 6): D then Enter does what a click does. */
  private nextDynamicIndex(): number {
    const next = nextDynamic(this.selected ? findNote(this.piece, this.selected)?.dynamic : undefined);
    return next === undefined ? DYNAMICS.length : DYNAMICS.indexOf(next);
  }

  /** The dynamics for the selected note, pp to ff and none; the one it has is lit. */
  private dynamicItems(): MenuItem[] {
    const current = this.selected ? findNote(this.piece, this.selected)?.dynamic : undefined;
    const set = (mark: (typeof DYNAMICS)[number] | undefined) => () => {
      if (!this.selected) return this.say(t('editor.dyn.none'), MESSAGE_MS);
      this.apply(setDynamic(this.piece, this.selected, mark), this.selected);
      this.showDynamic(mark);
    };
    return [...DYNAMICS, undefined].map((mark) => ({ label: mark ?? '-', keepCase: true, icon: dynamicPicture(mark), fineIcon: true, active: mark === current, onPick: set(mark) }));
  }

  /** The staff the played notes go on: Auto, treble, bass, the one in use lit; the default is the next, so M then Enter does what a click does. */
  private staffItems(): MenuItem[] {
    return STAFF_ORDER.map((mode) => ({ label: t(STAFF_LABEL[mode]), active: mode === this.staffMode, onPick: () => {
      this.staffMode = mode;
      this.showEntryOptions();
    } }));
  }

  /** The keys of single tools: the lengths, 0 (notes or rests) and the spacebar (a rest while held). True when taken. */
  private toolKey(e: KeyboardEvent, ctrl: boolean): boolean {
    const take = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    const length = KEY_LENGTHS[e.code];
    if (length && !ctrl) {
      take();
      if (!e.repeat) this.chooseLength(length);
      return true;
    }
    if ((e.code === 'Digit0' || e.code === 'Numpad0') && !ctrl) {
      take();
      if (!e.repeat) this.toggleEntry();
      return true;
    }
    if (e.code === 'Space' && !ctrl) {
      take();
      if (!e.repeat) this.keyDown('space', this.nowMs());
      return true;
    }
    return false;
  }

  /**
   * Esc closes an open menu first, then the time panel.
   * True when the key is taken here.
   */
  private menuOrPanelKey(e: KeyboardEvent): boolean {
    const take = () => {
      e.preventDefault();
      e.stopPropagation();
      return true;
    };
    if (e.code === 'Escape' && this.menuOpen) {
      this.closeMenu();
      return take();
    }
    // Esc closes the F1 help before anything else on the screen; Enter there starts Kiur's tour of the keys (ft_1_33.AC3)
    if (e.code === 'Escape' && this.shortcutsShown) {
      this.toggleShortcuts();
      return take();
    }
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && this.shortcutsShown) {
      take();
      this.startKeyTour();
      return true;
    }
    // the A time's question: Enter takes the guess, Esc closes it (it asks again when the cursor leaves the first bar)
    if (this.meterAsk !== null) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') this.confirmMeter(this.meterAsk);
      else if (e.code === 'Escape') {
        this.meterAsk = null;
        // a full first bar asks again only once the cursor or a click has left it
        this.meterDismissed = true;
        this.redraw();
      }
      // every other key waits while the question is open: nothing is written behind it
      return take();
    }
    // Esc closes the key or time panel before it leaves
    if (e.code === 'Escape' && this.panel !== null) {
      this.openPanel(this.panel);
      return take();
    }
    return false;
  }

  /**
   * Where on the canvas a note of `hand` at `start` ticks into `bar` with this pitch is drawn (screen pixels): the inverse of
   * a click, for tests and later for a guided tour.
   */
  pointForNote(place: { hand: EditorHand; bar: number; start: number; step: Step; octave: number }): { x: number; y: number } | null {
    if (!this.layout || !this.chart) return null;
    const bar = this.layout.bars[place.bar];
    const staff = bar ? this.layout.systems[bar.system]?.staves.findIndex((s) => s.trackId === place.hand.toLowerCase()) : -1;
    if (!bar || staff === undefined || staff < 0) return null;
    const clef = this.layout.systems[bar.system]!.staves[staff]!.clef;
    const position = staffPosition({ step: place.step, alter: 0, octave: place.octave }, clef);
    const at = pointOf(this.layout, this.chart, { bar: place.bar, start: place.start, staff, position });
    return at ? { x: this.staffLeft + at.x, y: this.staffTop + at.y } : null;
  }

  // ------------------------------------------------------------------------------------------------------------ edits

  /** Keep an edit (and select `select`), or say why it was refused and flash the note it was about. */
  private apply(edit: Edit, select: NoteRef | null): void {
    // ft_Y_15: one test of `on` while the debug log is off
    if (debugLog.on) debugLog.log('edit', `${edit.ok ? 'ok' : `refused ${edit.reason}`}${select ? ` ${select.hand} bar ${select.bar} at ${select.start}` : ''}`);
    if (!edit.ok) {
      this.say(t(`editor.why.${edit.reason}` as StringKey), MESSAGE_MS);
      const index = select ? this.indexOf(select) : -1;
      if (index >= 0) {
        this.staffView?.flashWrong(index);
        this.flashTimer?.remove();
        this.flashTimer = this.time.delayedCall(FLASH_MS, () => this.staffView?.flashWrong(null));
      }
      return;
    }
    // a pick waits for the next note click (core_09.AC13); an edit keeps it while its note still exists
    // any other edit (an item pressed) ends the repeat's pick, so later clicks write again
    if (this.repeatPick) this.disarm();
    if ((this.arcFrom && !findNote(edit.piece, this.arcFrom)) || (this.graceFor && !findNote(edit.piece, this.graceFor))) this.disarm();
    this.history = push(this.history, edit.piece);
    this.resync();
    this.selected = select && findNote(this.piece, select) ? select : null;
    this.say(this.pickMessage());
    // the A time: a first bar written to its end asks for its time at once
    if (this.askMeter(0)) return;
    this.refreshStaff();
  }

  private change(next: EditorPiece): void {
    this.apply({ ok: true, piece: next }, null);
  }

  private stepBars(direction: 1 | -1): void {
    const next = stepBars(this.piece, direction);
    if (next !== this.piece) this.change(next);
  }

  /**
   * One press of a pick-up button (core_09.AC30): one beat longer or shorter, from none up to one beat less than the bar,
   * stopping at the ends. An edit: the first bar's notes keep where they sound, refused where they or the last bar's do not fit.
   */
  private stepPickup(direction: 1 | -1): void {
    const now = this.piece.pickup ?? 0;
    const beats = Math.max(0, Math.min(this.piece.beats - 1, now + direction));
    if (beats === now) return;
    this.apply(setPickup(this.piece, beats), null);
  }

  /** The piece in progress, kept for when the editor opens again: after Try it, and after a visit to Settings. */
  private stash(): void {
    this.player?.stop();
    this.flushEntry();
    EditorScene.returning = { id: this.id, history: this.history, saved: this.saved, length: this.length, meterAuto: this.meterAuto };
  }

  protected override beforeSettings(): void {
    this.stash();
  }

  /** The selected note's alter (1 sharp, -1 flat, 0 natural), or null when no note is selected. */
  private selectedAlter(): Alter | null {
    return this.selected ? findNote(this.piece, this.selected)?.alter ?? null : null;
  }

  /** The accidental item: the selected note goes sharp, then flat, then natural, then sharp again (core_09.AC8). */
  private cycleAccidental(): void {
    const alter = this.selectedAlter();
    if (alter === null) return this.say(t('editor.acc.none'), MESSAGE_MS);
    this.accidental(nextAlter(alter));
  }

  /** The accidental item shows the selected note's sign (a sharp while none is selected). */
  private showAccidental(): void {
    const sign = ACCIDENTAL_SIGN[this.selectedAlter() ?? 1];
    this.accidentalButton?.setIcon(itemPicture(sign));
    this.accidentalButton?.setLabel(t(`editor.acc.${sign}`));
  }

  /** The sharp, flat or natural tool: it changes the selected note only (core_09.AC8). */
  private accidental(alter: Alter): void {
    if (!this.selected) return this.say(t('editor.acc.none'), MESSAGE_MS);
    this.apply(setAlter(this.piece, this.selected, alter), this.selected);
  }

  private stepBpm(direction: 1 | -1): void {
    const next = stepBpm(this.piece, direction);
    if (next !== this.piece) this.change(next);
  }

  private chooseLength(length: EditorLength): void {
    if (!lengthsFor(this.piece).includes(length)) {
      this.say(t('editor.why.bar-line'), MESSAGE_MS);
      return;
    }
    this.length = length;
    for (const [l, button] of this.lengthButtons) button.setActive(l === length);
    this.showLength();
    if (this.selected) this.apply(setLength(this.piece, this.selected, length), this.selected);
  }

  /**
   * The wheel over a group of the time panel steps that value (the notes' and the rests' items are the band's:
   * the wheel there picks the next length of the item's menu and writes with that item, ft_1_20.AC16).
   * True when the wheel was over the panel.
   */
  private wheelOverControls(p: Phaser.Input.Pointer, dy: number): boolean {
    const x = (p.x - this.root.x) / this.px.scale;
    const y = (p.y - this.root.y) / this.px.scale;
    const foot = (this.mainTop - this.root.y) / this.px.scale + this.mainRows;
    if (this.panel !== 'time' || y < foot - PIECE_PANEL || y >= foot) return false;
    const group = this.timeGroups.find((g) => x >= g.from && x < g.to);
    if (group && dy !== 0) group.step(dy < 0 ? 1 : -1);
    return true;
  }

  /** The Note / Rest switch: a click on a shadow writes a note or a rest of the selected length. */
  private toggleEntry(): void {
    this.entry = this.entry === 'note' ? 'rest' : 'note';
    if (this.bandShown) {
      // with the band, the item a click writes with is on a purple ground
      this.lengthItem?.setArmed(this.entry === 'note');
      this.restItem?.setArmed(this.entry === 'rest');
    } else {
      this.entryButton?.setLabel(t(`editor.entry.${this.entry}`));
      this.entryButton?.setIcon(this.entry === 'rest' ? REST_ICONS.quarter : NOTE_ICONS.quarter);
    }
    // the length buttons show what a click writes: notes, or rests of those lengths
    for (const [l, button] of this.lengthButtons) button.setIcon((this.entry === 'rest' ? REST_ICONS : NOTE_ICONS)[l]);
    this.showLength();
  }

  /** The band's picture of a length: the note or the rest a click writes, on its scrap of parchment (`itemArt.ts`). */
  private lengthPicture(length: EditorLength, kind: EntryMode = this.entry): Bitmap {
    return itemPicture(`${kind}.${length}` as ItemSign);
  }

  /** Notes or rests from now on (the item pressed, its key or its wheel). */
  private setEntry(kind: EntryMode): void {
    if (this.entry !== kind) this.toggleEntry();
  }

  /** The dynamic item or button shows the selected note's mark: with the band its scrap (blank for none), else its letters. */
  private showDynamic(mark: Dynamic | undefined): void {
    if (this.bandShown) this.dynamicButton?.setIcon(dynamicPicture(mark));
    this.dynamicButton?.setLabel(mark ?? '-');
  }

  /** The Length item (with the band) shows the length a click writes, as a note or a rest. */
  private showLength(): void {
    if (this.bandShown) {
      this.lengthItem?.setIcon(this.lengthPicture(this.length, 'note'));
      this.restItem?.setIcon(this.lengthPicture(this.length, 'rest'));
      return;
    }
    this.lengthItem?.setIcon(this.lengthPicture(this.length));
    this.lengthItem?.setLabel(t(`editor.length.${this.length}` as StringKey));
  }

  /**
   * The Length item's menu (the inventory holds one note and pressing it opens the choice of every
   * duration): every length as the note or rest a click writes, the one in use lit, those the bar cannot hold greyed.
   */
  private lengthItems(kind: EntryMode): MenuItem[] {
    // opening the notes' or the rests' menu writes with that item from now on
    this.setEntry(kind);
    const allowed = lengthsFor(this.piece);
    return LENGTH_ORDER.map((l) => ({
      label: t(`editor.length.${l}` as StringKey), icon: this.lengthPicture(l, kind), fineIcon: true, active: l === this.length, disabled: !allowed.includes(l), onPick: () => this.chooseLength(l),
    }));
  }

  /** Opens the time panel over the staff's foot, or closes it when it is open. */
  private openPanel(kind: 'time'): void {
    this.panel = this.panel === kind ? null : kind;
    this.titleInput?.blur();
    this.redraw();
  }

  /** Whether the pointer is on a button or the open time panel over the staff (with the band only). */
  private overStaffControls(p: Phaser.Input.Pointer): boolean {
    if (!this.bandShown) return false;
    if (this.pointerOnButton(p)) return true;
    const foot = this.mainTop + this.mainRows * this.px.scale;
    return this.panel !== null && p.y >= foot - PIECE_PANEL * this.px.scale && p.y < foot;
  }

  /** Another page of lines, when the bars take more lines than the screen shows. */
  private turnPage(direction: 1 | -1): void {
    const pages = this.layout?.pageCount ?? 1;
    const page = Math.max(0, Math.min(pages - 1, this.page + direction));
    if (page === this.page) return;
    this.page = page;
    this.refreshStaff(true);
  }

  /**
   * A finger button: the selected note gets this finger (ft_1_02d.AC4), and the fingers AUTO wrote in that bar of its hand
   * are fitted again around it (ft_1_02d.AC23), in one undo step. The author's own fingers never change.
   */
  private setFingerTo(finger: 1 | 2 | 3 | 4 | 5 | null): void {
    if (!this.selected) return this.say(t('editor.finger.none'), MESSAGE_MS);
    const edit = setFinger(this.piece, this.selected, finger);
    if (!edit.ok) return this.apply(edit, this.selected);
    const scope = { hand: this.selected.hand, bar: this.selected.bar };
    this.apply({ ok: true, piece: autoFingers(edit.piece, this.fingerLevel(), scope).piece }, this.selected);
  }

  /** The player's level, for AUTO fingers: its hand positions (content/curriculum/levels.json). */
  private fingerLevel(): LevelDefinition {
    return LEVEL_TABLE.find((l) => l.level === contextOf(this).profiles.progress.level.level) ?? LEVEL_TABLE[0]!;
  }

  /**
   * AUTO: the fingers of the notes that have none, and the ones AUTO wrote before fitted again around the author's, the
   * easiest fingering with the player's level's hand position first (ft_1_02d.AC13, AC23, ft_1_30).
   */
  private autoFillFingers(): void {
    const result = autoFingers(this.piece, this.fingerLevel());
    if (result.filled + result.changed === 0) return this.say(t('editor.finger.auto.none'), MESSAGE_MS);
    this.change(result.piece);
    if (result.unfilled > 0) this.say(t('editor.finger.auto.some', { n: result.unfilled }), MESSAGE_MS);
  }

  /** The finger of the selected note: none, then 1 to 5, then none again (ft_1_02d.AC4). Only that note changes. */
  /**
   * F (ft_1_02d.AC4, AC19): the finger menu numbered 1 to 5, 6 for AUTO and 0 for no finger. Its default is the next finger
   * after the note's own (none, 1 to 5, none), so F then Enter or an arrow steps the finger as F used to.
   */
  private fingerKey(): void {
    const current = this.selected ? findNote(this.piece, this.selected)?.finger ?? 0 : 0;
    const items = [...this.fingerItems(), { label: '-', keepCase: true, tooltip: t('editor.finger.tip'), onPick: () => this.setFingerTo(null) }];
    this.openKeyMenu('fingers', items, current === 5 ? items.length - 1 : current, FINGER_MENU_CELL, 7, ['1', '2', '3', '4', '5', '6', '0']);
  }

  /** COPY: the selected bars, or else the selected note's bar, go to the bar clip. */
  private copyBar(): void {
    const range = this.barSel ?? (this.selected ? { from: this.selected.bar, to: this.selected.bar } : null);
    if (!range) return this.say(t('editor.copy.none'), MESSAGE_MS);
    this.barClip = copyBars(this.piece, range);
    this.clipRange = range;
    this.say(t('editor.copy.done'), MESSAGE_MS);
  }

  /** PASTE x1, x2 or x4: the copied bar is added at the end of the piece, that many times. */
  private pasteBar(times: 1 | 2 | 4): void {
    if (!this.barClip) return this.say(t('editor.paste.none'), MESSAGE_MS);
    this.apply(insertBars(this.piece, this.piece.bars, this.barClip, times), null);
  }

  /**
   * CUT: the selected bars go to the clip and are taken out, so the later bars move back. The
   * selection goes and the anchor stays on the cut bar, so Ctrl+V puts the bars back there instead of over the bars that moved in.
   */
  private cutSelection(): void {
    if (!this.barSel) return this.say(t('editor.cut.none'), MESSAGE_MS);
    const from = this.barSel.from;
    const { clip, piece } = cutBars(this.piece, this.barSel);
    this.barClip = clip;
    this.clipRange = null;
    this.barSel = null;
    this.barAnchor = from;
    this.apply({ ok: true, piece }, null);
    this.say(t('editor.cut.done'), MESSAGE_MS);
  }

  /** PASTE with Ctrl+V: after a fresh copy or paste, after the selection; over another selection; else before the last click. */
  private pasteSelection(): void {
    if (!this.barClip) return this.say(t('editor.paste.none'), MESSAGE_MS);
    const fresh = !!this.barSel && !!this.clipRange && this.barSel.from === this.clipRange.from && this.barSel.to === this.clipRange.to;
    const { edit, range } = pasteAt(this.piece, this.barSel, fresh, this.barAnchor, this.barClip);
    this.apply(edit, null);
    if (edit.ok && range) {
      this.barSel = range;
      this.barAnchor = range.from;
      this.clipRange = range;
      this.refreshStaff();
    }
  }

  /**
   * Insert: empty bars before the selection, as many as are selected; with none, one empty bar before the selected note's bar
   * or the last clicked bar. The new bars become the selection, so Insert again adds more.
   */
  private insertBlank(): void {
    const at = this.barSel?.from ?? this.selected?.bar ?? this.barAnchor;
    if (at === null) return this.say(t('editor.insert.none'), MESSAGE_MS);
    const count = this.barSel ? this.barSel.to - this.barSel.from + 1 : 1;
    const edit = insertBlankBars(this.piece, at, count);
    this.apply(edit, null);
    if (!edit.ok) return;
    this.barSel = { from: at, to: at + count - 1 };
    this.barAnchor = at;
    this.clipRange = null;
    this.refreshStaff();
  }

  /** Up or Down on the selected bars: every note one staff step, or an octave with Ctrl. */
  private moveSelectedBars(direction: 1 | -1, unit: 'step' | 'octave'): void {
    if (this.barSel) this.apply(moveBars(this.piece, this.barSel, direction, unit), null);
  }

  /** Tie every repeated chord in the piece in one press (core_09.AC13). */
  private tieEverything(): void {
    const edit = tieAll(this.piece);
    // no tie found: say why, since the same pitch may be there but not right after its note
    if (!edit.ok) return this.say(t(samePitchNotAdjacent(this.piece) ? 'editor.tie.all.gap' : 'editor.tie.all.none'), MESSAGE_MS);
    this.apply(edit, this.selected);
  }

  /** Press pick, then click the note the tie or slur goes to (core_09.AC13, AC30). */
  private armArc(): void {
    if (!this.selected) return this.say(t('editor.arc.none'), MESSAGE_MS);
    const from = this.selected;
    this.disarm();
    this.arcFrom = from;
    // the message stays while the pick waits for its note
    this.say(t('editor.arc.pick'));
    this.hover(this.input.activePointer);
  }

  /** The tie or slur on the selected note (core_09.AC13, AC30): a tie to the same key right after, else a slur; a second press takes it away. */
  private toggleArcOnSelected(): void {
    if (!this.selected) return this.say(t('editor.arc.none'), MESSAGE_MS);
    this.apply(toggleArc(this.piece, this.selected), this.selected);
  }

  /**
   * The pre-note item on the selected note (core_09.AC35, d121): it arms the pick (the next pitch picked is the grace), or on
   * a note that has one takes it away; the rule is `graceItem`.
   */
  private pressGrace(): void {
    if (!this.selected) return this.say(t('editor.grace.none'), MESSAGE_MS);
    const press = graceItem(this.piece, this.selected);
    if (press.kind === 'edit') return this.apply(press.edit, this.selected);
    this.disarm();
    this.graceFor = this.selected;
    this.say(t('editor.grace.pick'));
    this.hover(this.input.activePointer);
  }

  /**
   * A left click while a pre-note is armed (core_09.AC35): a place or a head on the staff gives its letter and octave to the
   * grace. False when none is armed, for a right click, and off the staff's places (the key signature area): the press then
   * goes on as usual and ends the pick.
   */
  private graceClick(p: Phaser.Input.Pointer): boolean {
    if (!this.graceFor || p.rightButtonDown() || (p.event as MouseEvent | undefined)?.button === 2) return false;
    const hit = this.hit(p);
    const pitch = hit?.kind === 'place' ? hit : hit?.kind === 'note' ? this.refOf(hit.noteIndex) : null;
    if (!pitch) return false;
    this.pickGrace((piece, ref) => graceFromPlace(piece, ref, pitch.step, pitch.octave));
    return true;
  }

  /** The pitch picked for an armed pre-note: the pick ends and the grace is set on its note (selected again). */
  private pickGrace(edit: (piece: EditorPiece, ref: NoteRef) => Edit): void {
    const ref = this.graceFor;
    if (!ref) return;
    this.disarm();
    this.apply(edit(this.piece, ref), ref);
  }

  /** The message of the pick that waits (a tie, a slur or a pre-note), or nothing while none waits. */
  private pickMessage(): string {
    if (this.graceFor) return t('editor.grace.pick');
    if (this.repeatPick) return t(this.repeatPick.startBar === null ? 'editor.repeat.pickStart' : 'editor.repeat.pickEnd');
    return this.arcFrom ? t('editor.arc.pick') : '';
  }

  /** Whether a tie or a slur waits for its end note. */
  private pickWaits(): boolean {
    return this.arcFrom !== null;
  }

  /** The click on the note a waiting tie or slur ends on: the pick ends and the edit is made from its first note. */
  private endPick(ref: NoteRef): void {
    const from = this.arcFrom;
    this.disarm();
    if (from) this.apply(arcInto(this.piece, from, ref), from);
  }

  /** Ends a pick: no note is waited for any more, and its message goes. */
  private disarm(): void {
    if (this.arcFrom || this.graceFor || this.repeatPick) this.say('');
    // the repeat's start bar was shown as a selected bar while the end was asked for
    if (this.repeatPick?.startBar !== null && this.repeatPick?.startBar !== undefined) this.barSel = null;
    this.arcFrom = null;
    this.graceFor = null;
    this.repeatPick = null;
    this.repeatButton?.setActive(false);
  }

  /** Selects a note and redraws the staff, so its arrow shows at once, also when the edit is refused. */
  private select(ref: NoteRef | null): void {
    this.selected = ref && findNote(this.piece, ref) ? ref : null;
    this.refreshStaff();
  }

  /**
   * The repeat item: a press asks for the bar the repeat starts on, then the bar it ends on, each a click
   * in that bar; a second press while it asks, or a right click, stops it. With bars selected, the repeat goes round them at
   * once. A repeat already on exactly those bars is taken away (core_09.AC20).
   */
  private pressRepeat(): void {
    if (this.repeatPick) {
      this.disarm();
      this.refreshStaff();
      return;
    }
    if (this.barSel) {
      const { from, to } = this.barSel;
      this.apply({ ok: true, piece: repeatAround(this.piece, from, to) }, this.selected);
      return;
    }
    this.disarm();
    this.repeatPick = { startBar: null };
    this.say(this.pickMessage());
    this.refreshStaff();
  }

  /** A click in a bar while the repeat item asks for one: the start bar first, then the end bar. */
  private pickRepeatBar(bar: number): void {
    const pick = this.repeatPick!;
    if (pick.startBar === null) {
      this.repeatPick = { startBar: bar };
      // the start bar is shown as a selected bar until the end bar is picked
      this.barSel = { from: bar, to: bar };
      this.say(this.pickMessage());
      this.refreshStaff();
      return;
    }
    this.disarm();
    this.apply({ ok: true, piece: repeatAround(this.piece, pick.startBar, bar) }, this.selected);
  }

  /** "Repeat starts here" or "repeat ends here" on the selected note's bar (core_09.AC20). */
  private toggleRepeat(side: 'start' | 'end'): void {
    if (!this.selected) return this.say(t('editor.repeat.none'), MESSAGE_MS);
    const bar = this.selected.bar;
    this.apply({ ok: true, piece: side === 'start' ? toggleRepeatStart(this.piece, bar) : toggleRepeatEnd(this.piece, bar) }, this.selected);
  }

  private deleteSelected(): void {
    if (this.selected) this.apply(removeNote(this.piece, this.selected), null);
  }

  // ------------------------------------------------------------------------------------------- writing by playing keys

  /** The clock the keys are timed on: the same song clock the keyboard events carry (`NoteEvent.timeMs`). */
  private nowMs(): number {
    return contextOf(this).audio.clock.nowMs();
  }

  private entryOptions(): EntryOptions {
    return { staff: this.staffMode, shortTapEighth: this.shortTapEighth, rests: this.entry === 'rest' };
  }

  /** A key from any keyboard. A press writes; a release ends its hold. Presses are ignored while the title is typed. */
  private played(event: NoteEvent): void {
    if (!this.scene.isActive()) return;
    if (event.kind === 'on' && event.velocity > 0) {
      if (document.activeElement === this.titleInput) return;
      // an armed pre-note takes the key played instead of a new note (core_09.AC35); its release writes nothing
      if (this.graceFor) return this.pickGrace((piece, ref) => graceFromKey(piece, ref, event.midi));
      this.keyDown(event.midi, event.timeMs);
    } else {
      this.keyUp(event.midi, event.timeMs);
    }
  }

  private keyDown(key: EntryKey, atMs: number): void {
    this.entryState = entryDown(this.entryState, key, atMs, this.entryOptions());
    this.afterEntry();
  }

  private keyUp(key: EntryKey, atMs: number): void {
    this.entryState = entryUp(this.entryState, key, atMs, this.entryOptions());
    this.afterEntry();
  }

  /** Every frame while a key is held: the note or rest grows with the hold (its length follows the time held). */
  override update(): void {
    if (this.entryState.held.size === 0) return;
    this.entryState = entryTick(this.entryState, this.nowMs());
    this.afterEntry();
  }

  /**
   * After a key or a hold changed the piece: once every key is up, the piece becomes one undo step (a chord is one step).
   * The staff is drawn again when the piece changed, on the page of the bar written last.
   */
  private afterEntry(): void {
    if (this.entryState.held.size === 0) this.flushEntry();
    if (this.entryState.piece === this.drawnPiece) return;
    const last = this.entryState.items[this.entryState.items.length - 1];
    this.follow = last ? last.bar : null;
    this.refreshStaff();
  }

  /** The working piece becomes the present of history, when it differs from it. */
  private flushEntry(): void {
    if (this.entryState.piece !== this.history.present) this.history = push(this.history, this.entryState.piece);
  }

  /** An edit that is not a played key (a mouse edit, undo, redo, the title) starts the entry state again from the piece shown. */
  private resync(): void {
    this.entryState = startEntry(this.history.present);
  }

  /** Backspace takes back the last note or rest written by playing; with none, it deletes the selected note as Delete does. */
  private backspace(): void {
    const next = entryBackspace(this.entryState);
    if (next.piece === this.entryState.piece) return this.deleteSelected();
    this.entryState = next;
    this.flushEntry();
    this.afterEntry();
  }

  private cycleStaff(): void {
    this.staffMode = this.staffMode === 'auto' ? 'RH' : this.staffMode === 'RH' ? 'LH' : 'auto';
    this.showEntryOptions();
  }

  /** Cycles the selected note's dynamic mark (core_09.AC16): pp, p, mp, mf, f, ff, then none. */
  private cycleDynamic(): void {
    if (!this.selected) return this.say(t('editor.dyn.none'), MESSAGE_MS);
    const next = nextDynamic(findNote(this.piece, this.selected)?.dynamic);
    this.apply(setDynamic(this.piece, this.selected, next), this.selected);
    this.showDynamic(next);
    this.say(next === undefined ? t('editor.dyn.clear') : t('editor.dyn.set', { mark: next }), MESSAGE_MS);
  }

  private toggleShortTap(): void {
    this.shortTapEighth = !this.shortTapEighth;
    try {
      window.localStorage.setItem(ENTRY_PREFS_KEY, serializeEntryPrefs({ ...DEFAULT_ENTRY_PREFS, shortTapEighth: this.shortTapEighth }));
    } catch {
      // storage is blocked: the setting holds for this visit only
    }
    this.showEntryOptions();
  }

  /** The writer's short-tap setting on this device; storage that is blocked or broken reads as the default (off). */
  private loadEntryPrefs(): boolean {
    try {
      return parseEntryPrefs(window.localStorage.getItem(ENTRY_PREFS_KEY)).shortTapEighth;
    } catch {
      return DEFAULT_ENTRY_PREFS.shortTapEighth;
    }
  }

  /** Shows the staff mode and the short-tap state on their buttons. */
  private showEntryOptions(): void {
    this.staffButton?.setLabel(t(STAFF_LABEL[this.staffMode]));
    this.shortTapButton?.setLabel(t(this.shortTapEighth ? SHORT_TAP_LABEL.on : SHORT_TAP_LABEL.off));
    this.shortTapButton?.setActive(this.shortTapEighth);
  }

  private undo(): void {
    this.flushEntry();
    debugLog.log('edit', 'undo');
    if (!canUndo(this.history)) return this.say(t('editor.nothingToUndo'), MESSAGE_MS);
    this.history = undo(this.history);
    this.resync();
    this.selected = null;
    this.barSel = null;
    this.clipRange = null;
    this.disarm();
    this.refreshStaff();
  }

  private redo(): void {
    this.flushEntry();
    debugLog.log('edit', 'redo');
    if (!canRedo(this.history)) return this.say(t('editor.nothingToRedo'), MESSAGE_MS);
    this.history = redo(this.history);
    this.resync();
    this.selected = null;
    this.barSel = null;
    this.clipRange = null;
    this.disarm();
    this.refreshStaff();
  }

  private indexOf(ref: NoteRef): number {
    if (!this.chart) return -1;
    const tick = this.chart.bars[ref.bar]?.startTick ?? -1;
    return this.chart.notes.findIndex((n) => n.track === ref.hand.toLowerCase() && n.tick === tick + ref.start && n.spelling.step === ref.step && n.spelling.octave === ref.octave);
  }

  // ------------------------------------------------------------------------------------------------------- actions

  private leave(): void {
    if (this.dirty() && !window.confirm(t('editor.leaveUnsaved'))) return;
    startScene(this, 'menu');
  }

  private dirty(): boolean {
    const now = this.piece;
    if (this.saved) return JSON.stringify(now) !== JSON.stringify(this.saved);
    return now.notes.length > 0;
  }

  private listen(): void {
    if (!this.player) return;
    if (this.player.isPlaying) {
      this.player.stop();
      this.showListen(false);
      return;
    }
    if (!this.chart || this.chart.notes.length === 0) return this.say(t('editor.empty'), MESSAGE_MS);
    this.player.start(playbackNotes(this.chart), playbackLengthMs(this.chart), () => this.showListen(false));
    this.showListen(true);
  }

  /** Listen shows the ear, or a square while the piece plays (a click then stops it). */
  private showListen(playing: boolean): void {
    this.listenButton?.setLabel(t(playing ? 'editor.stop' : 'editor.listen'));
    this.listenButton?.setIcon(playing ? TOOL_ICONS.stop : ICONS.ear);
  }

  private tryIt(): void {
    if (!this.chart || this.chart.notes.length === 0) return this.say(t('editor.empty'), MESSAGE_MS);
    this.stash();
    startScene(this, 'practice', { chart: this.chart, preview: true, returnTo: 'editor' });
  }

  /**
   * Save the piece. Saves run one after the other: a new piece gets its id only when its first save is done, so a second
   * Save (or Export) started before that would have stored a second copy under a new id.
   */
  /**
   * A new piece is saved only with a name of its own (saved without one it seemed forgotten, a "My piece"
   * among others): an empty title, or the one a new piece starts with, puts the typing in the title field of the top strip.
   */
  private needsTitle(): boolean {
    const title = this.piece.title.trim();
    return title === '' || (!this.id && title === t('editor.untitled'));
  }

  /** The title in its field: a new piece's stand-in name is shown as an empty field with its hint, to be typed. */
  private shownTitle(): string {
    return !this.id && this.piece.title === t('editor.untitled') ? '' : this.piece.title;
  }

  private askTitle(): void {
    this.titleAsked = true;
    this.titleInput?.focus();
    this.titleInput?.select();
    this.say(t('editor.title.ask'));
  }

  private save(): Promise<void> {
    if (this.needsTitle()) {
      this.askTitle();
      return Promise.resolve();
    }
    this.saving = this.saving.catch(() => undefined).then(() => this.saveNow());
    return this.saving;
  }

  private async saveNow(): Promise<void> {
    const context = contextOf(this);
    // Keep the piece that is written: an edit made while the write is pending must still count as unsaved.
    const piece = this.piece;
    this.titleAsked = false;
    const result = await context.ownPieces.save(piece, { id: this.id ?? undefined, author: context.profiles.profile.name });
    if (!result.ok) return this.say(result.reason === 'empty' ? t('editor.empty') : t('editor.notDrawable'), MESSAGE_MS);
    this.id = result.id;
    this.saved = piece;
    this.say(result.saved ? t('editor.saved') : t('editor.savedHere'), MESSAGE_MS);
  }

  /** Save the piece if it has changes, then offer it as a file to take to another device. */
  private async exportFile(): Promise<void> {
    const context = contextOf(this);
    if (this.piece.notes.length === 0) return this.say(t('editor.empty'), MESSAGE_MS);
    if (this.dirty() || !this.id) await this.save();
    const file = this.id ? context.ownPieces.exportFile(this.id) : null;
    if (!file) return;
    context.files.download(file.name, file.text);
    this.say(t('editor.exported'), MESSAGE_MS);
  }

  /** Choose a piece file and add its piece to the player's own pieces; the piece being written is left alone. */
  private async importFile(): Promise<void> {
    const context = contextOf(this);
    let text: string | null;
    if (this.photoReady) {
      // on a computer with Audiveris, Import takes a photo or scan of a sheet too (ft_Y_04 slice 4)
      const file = await context.files.pickFile({ accept: '.json,application/json,image/jpeg,image/png', id: 'editor-import-file' });
      if (file && /\.(jpe?g|png)$/i.test(file.name)) return this.importPhoto(file.name, file.bytes);
      text = file ? new TextDecoder().decode(file.bytes) : null;
    } else text = await context.files.pick({ accept: '.json,application/json', id: 'editor-import-file' });
    if (text === null) return this.say(t('editor.importEmpty'), MESSAGE_MS);
    const result = await context.ownPieces.importFile(text, { reservedIds: context.pieces.bundledIds() });
    if (!result.ok) {
      const key = `editor.import.${result.reason}` as StringKey;
      return this.say(key in strings ? t(key) : t('editor.import.cannotSave', { problem: result.message }), MESSAGE_MS * 2);
    }
    this.say(t('editor.imported', { title: result.title }), MESSAGE_MS * 2);
  }

  /**
   * The photo tool over the piece maker (ft_Y_04.AC18): the photo turned and cropped to the piece, read on the computer, its key
   * and clefs checked; the piece then opens as a new own piece with its photo behind the staff and the bars to fill by hand
   * named (AC16, AC17). The piece being written is left alone, as with any import.
   */
  private importPhoto(name: string, bytes: Uint8Array): void {
    if (this.photoTool) return;
    if (this.dirty()) return this.say(t('editor.photo.saveFirst'), MESSAGE_MS * 2);
    const context = contextOf(this);
    // the tool covers the piece maker, paused until it closes: no key or note played behind the tool writes anything
    this.scene.pause();
    const back = () => {
      this.photoTool = null;
      this.scene.resume();
    };
    this.photoTool = new PhotoTool({
      pick: () => context.files.pickFile({ accept: 'image/jpeg,image/png', id: 'photo-tool-file' }),
      send: (file, part, title) => sendPhoto(file, part, title),
      naming: context.profiles.noteNaming,
      colour: DEFAULT_THEME.cursor,
      closed: back,
      open: ({ piece, author, reply }) => {
        back();
        void this.openRead(piece, author, reply);
      },
    }, { name, bytes });
  }

  /** A piece read from a photo and checked in the photo tool, saved as a new own piece and opened. */
  private async openRead(piece: EditorPiece, author: string, reply: Extract<PhotoReply, { ok: true }>): Promise<void> {
    const saved = await contextOf(this).ownPieces.save(piece, { author });
    if (!this.scene.isActive()) return;
    if (!saved.ok) return this.say(t('editor.import.cannotSave', { problem: saved.message }), MESSAGE_MS * 2);
    const bars = barsToFill(reply.problems);
    const note = bars.length === 0 ? t('editor.photo.done') : t('editor.photo.fill', { bars: bars.join(', ') });
    EditorScene.photoNote = reply.stavesUneven ? `${note} ${t('editor.photo.uneven')}` : note;
    this.scene.restart({ id: saved.id });
  }

  // ------------------------------------------------------------------------------------------------------- drawing

  /** What the status line says: a message for a moment, otherwise which levels the piece fits. */
  private say(text: string, forMs = 0): void {
    this.message = text;
    this.messageTimer?.remove();
    this.messageTimer = forMs > 0 ? this.time.delayedCall(forMs, () => {
      // a pick still waiting keeps its message once a message about something else has faded
      this.message = this.pickMessage();
      this.updateStatus();
    }) : null;
    this.updateStatus();
  }

  private updateStatus(): void {
    // with the band: a message in the bubble over the staff's foot, the levels the piece fits in the Save cell's tooltip (no status line, ft_1_20.AC3)
    if (this.bubble) {
      this.bubble.show(this.message);
      const fit = this.fitText();
      this.saveButton?.setTooltip(fit ? `${t('editor.save')}: ${fit}` : t('editor.save'));
      return;
    }
    if (!this.status) return;
    this.status.setText(this.message || this.fitText());
  }

  private fitText(): string {
    // an empty piece says nothing: no instructions on the screen
    if (this.piece.notes.length === 0) return '';
    const compiled = compileOwn(this.piece, { id: this.id ?? DRAFT_ID, author: '' });
    const problem = compiled.problems[0];
    return fitsLabel(compiled.fitsLevels) ?? t('editor.fitsNone', { problem: problem ? problemLabel(problem) : '' });
  }

  /** The room the staff is laid out in: the screen's width less the sheet's inset on both sides, and the staff's height. */
  /** The centre of the bar buttons after the last bar, in art pixels over the main area; null while that bar is on another page. */
  private barEnd(layout: StaffLayout): { x: number; y: number } | null {
    const bar = layout.bars.at(-1);
    const system = bar ? layout.systems[bar.system] : undefined;
    if (!bar || !system || system.page !== this.page) return null;
    const { scale, width } = this.px;
    const x = Math.min(width - STEP_WIDTH / 2 - 1, Math.round((this.staffLeft + bar.x + bar.width) / scale + STEP_WIDTH / 2 + GROUP_GAP));
    const y = Math.round((this.staffTop - this.mainTop + (system.topLineY + system.bottomLineY) / 2) / scale);
    return { x, y };
  }

  private staffViewport(): { width: number; height: number } {
    return { width: this.scale.width - 2 * this.staffLeft, height: this.staffHeight };
  }

  /**
   * Draw the staff again for the current piece (after every edit), keeping the rest of the screen. A page turn keeps its
   * page: a selected note on another page keeps its mark but does not pull the page back to it.
   */
  private refreshStaff(pageTurn = false): void {
    this.nameSelectedChord();
    this.staffView?.destroy();
    this.drawnPiece = this.piece;
    this.chart = toChart(this.piece, { id: this.id ?? DRAFT_ID });
    // a frame that only the bars, hands, meter and key change, so writing a note does not move the staff
    this.layout = editorStaff(this.piece, this.chart, this.staffViewport());
    // the page of the bar just written, or the page shown before (it may have gone, with fewer lines)
    if (this.follow !== null) this.page = pageOfBar(this.layout, this.follow);
    this.follow = null;
    this.page = Math.max(0, Math.min(this.layout.pageCount - 1, this.page));
    if (debugLog.on) debugLog.log('staff', `${this.piece.bars} bars, ${this.chart.notes.length} notes, page ${this.page + 1} of ${this.layout.pageCount}`);
    // every bar has its number while writing, whatever the reading setting says: the person editing has to find bars;
    // a pick-up is bar 0, as printed (core_09.AC25)
    const numbers = barNumbersToShow('every', this.chart.bars.length, 0, firstPrintedBar(this.chart));
    // free time is where the next note goes: only the rests the author placed are drawn
    const drawn = drawnWhileWriting(this.layout, this.chart, this.piece);
    // the selected bars are a band behind the staff, drawn before it; the selection ends where the piece ends
    if (this.barSel && this.barSel.to >= this.piece.bars) this.barSel = null;
    this.band?.destroy();
    this.band = this.add.graphics().setX(this.staffLeft);
    if (this.barSel) {
      for (const box of barBoxes(this.layout, this.barSel)) {
        if (box.page === this.page) this.band.fillStyle(DEFAULT_THEME.cursor, 0.18).fillRect(box.x1, this.staffTop + box.y1, box.x2 - box.x1, box.y2 - box.y1);
      }
      // the drag-repeat handle at the selection's right edge (ft_1_02d.AC24)
      const grip = repeatHandleBox(this.layout, this.barSel, this.page);
      if (grip) this.band.fillStyle(DEFAULT_THEME.cursor, 0.9).fillRect(grip.x1, this.staffTop + grip.y1, grip.x2 - grip.x1, grip.y2 - grip.y1);
    }
    this.staffView = new StaffView(this, drawn, undefined, { noteNames: true, fingers: true, chordFingers: contextOf(this).profiles.chordFingers }, { x: this.staffLeft, y: this.staffTop }, numbers, { x: 0, width: this.scale.width });
    this.staffView.setHandShifts(handShiftMap(this.chart, LEVEL_TABLE.find((l) => l.level === contextOf(this).profiles.progress.level.level)));
    this.staffView.showPage(this.page, false);
    const index = this.selected ? this.indexOf(this.selected) : -1;
    if (index >= 0) {
      this.staffView.setCursor(index);
      if (pageTurn) this.staffView.showPage(this.page, false);
      else this.page = this.staffView.currentPage;
    }
    this.drawShadows();
    this.drawKeyCursor();
    this.drawPhoto();
    // the box and a waiting pick's preview follow the edit: the chord or the room under the pointer may have changed
    this.hover(this.input.activePointer);
    this.ghost?.setDepth(10);
    this.ghostLabel?.setDepth(10);
    // the option buttons are drawn once: show the tempo of the piece now (also after undo and redo)
    this.bpmText?.setText(t('editor.bpm', { bpm: bpmOf(this.piece) }));
    this.pageText?.setText(t('editor.page', { page: this.page + 1, pages: this.layout.pageCount }));
    this.barsText?.setText(t('editor.bars', { bars: this.piece.bars }));
    this.pickupText?.setText(pickupLabel(this.piece));
    this.meterText?.setText(this.meterLabel());
    // with the band, the page buttons over the staff are there only while the piece has more than one page
    if (this.bandShown && ((this.layout.pageCount > 1) !== this.pageButtonsDrawn || this.barEndKey !== spotKey(this.barEnd(this.layout)))) {
      this.redraw();
      return;
    }
    this.showAccidental();
    this.repeatButton?.setActive(this.repeatPick !== null);
    this.updateStatus();
    if (this.titleInput && this.titleInput.value !== this.shownTitle()) this.titleInput.value = this.shownTitle();
  }

  /** A faint note head at the tonic on every place a note can go, on the page shown. */
  private drawShadows(): void {
    this.shadows?.clear();
    if (!this.layout || !this.shadows) return;
    const S = this.layout.staffSpace;
    this.shadows.fillStyle(DEFAULT_THEME.ink, 0.18);
    for (const shadow of shadowsFor(this.piece, this.layout)) {
      if (shadow.page === this.page) this.shadows.fillEllipse(shadow.x, this.staffTop + shadow.y, 1.3 * S, S);
    }
    this.shadows.setDepth(9);
  }

  private removeTitleInput(): void {
    this.titleInput?.remove();
    this.titleInput = null;
  }

  /** The title is typed into a real text field laid over the canvas: the pixel font draws text but cannot take typing. */
  /** Export, import and save, as pictures with their names as tooltips (d088): the editor's own toolbar items. */
  protected override toolbarItems(): ToolbarItem[] {
    const item = (key: StringKey, icon: Bitmap, shortcut: string, onClick: () => void): ToolbarItem => ({ label: t(key), icon, iconOnly: true, tooltip: t(key), shortcut, onClick });
    return [
      item('editor.export', TOOL_ICONS.exportFile, EDITOR_KEYS.exportFile.label, () => void this.exportFile()),
      item('editor.import', TOOL_ICONS.importFile, EDITOR_KEYS.importFile.label, () => void this.importFile()),
      item('editor.save', TOOL_ICONS.save, EDITOR_KEYS.save.label, () => void this.save()),
      circleItem(() => this.openCircle()),
    ];
  }

  /**
   * The circle of fifths over the piece maker (ft_1_28 rules 1 and 8), the piece's key marked; from the wheel or a press on
   * the clef. A key taken there becomes the piece's key. Listen stops first, as the screen pauses.
   */
  private openCircle(): void {
    if (this.player?.isPlaying) this.listen();
    this.panel = null;
    void openOverlay(this, 'circle', { key: { fifths: this.piece.fifths, mode: this.piece.mode }, choose: true }).then((key) => {
      if (key !== 'closed' && key !== CANCELLED) this.chooseKey(key.fifths, key.mode);
      else this.redraw();
    });
  }

  /**
   * The piece maker's actions in the band's grid (ft_1_20 rule 1): Listen, Try it, the circle of fifths; Undo, Redo, Delete;
   * Copy, Paste. Save, Import and Export are in the top strip. Pictures, their words in the tooltips.
   */
  protected override bandActions(): ToolbarItem[] {
    const playing = this.player?.isPlaying === true;
    const action = (key: StringKey, icon: Bitmap, shortcut: string, onClick: () => void, ref?: (b: PixelButton) => void): ToolbarItem => ({ label: t(key), icon, shortcut, onClick, ...(ref ? { ref } : {}) });
    return [
      { label: t(playing ? 'editor.stop' : 'editor.listen'), icon: playing ? TOOL_ICONS.stop : ICONS.ear, shortcut: EDITOR_KEYS.listen.label, onClick: () => this.listen(), ref: (b) => (this.listenButton = b) },
      action('editor.try', TOOL_ICONS.play, EDITOR_KEYS.tryIt.label, () => this.tryIt()),
      // the circle of fifths (ft_1_28 rule 1: easy to reach), with the actions
      circleItem(() => this.openCircle()),
      action('editor.undo', TOOL_ICONS.undo, EDITOR_KEYS.undo.label, () => this.undo()),
      action('editor.redo', TOOL_ICONS.redo, EDITOR_KEYS.redo.label, () => this.redo()),
      action('editor.delete', TOOL_ICONS.trash, EDITOR_KEYS.delete.label, () => this.deleteSelected()),
      action('editor.copy', TOOL_ICONS.copy, EDITOR_KEYS.copy.label, () => this.copyBar()),
      { label: t('editor.paste'), icon: TOOL_ICONS.paste, shortcut: EDITOR_KEYS.paste.label, onClick: () => undefined, menu: { items: () => this.pasteItems(), cell: { w: PASTE_ITEM_WIDTH, h: BAR_BUTTON_HEIGHT }, columns: 3 } },
    ];
  }

  /**
   * The piece maker's items in the band's slots (ft_1_20 rule 2): notes and rests (two items, each showing its length and
   * cycling it; the one a click writes is armed, on purple); sharp, flat, natural; the ties, the slurs and the fingers
   * (each a menu of its choices); the dynamic of the selected note; the repeat signs; the staff the played notes go on and
   * the short tap. Each acts on the selected note at once, as its button did. AX-3 provisional: held items that ride on the
   * pointer (rule 2, AC4) wait for the item model and the painter's cursor; the order of the items.
   */
  protected override bandItems(): ToolbarItem[] {
    const dynamic = this.selected ? findNote(this.piece, this.selected)?.dynamic : undefined;
    const sign = ACCIDENTAL_SIGN[this.selectedAlter() ?? 1];
    return [
      // notes and rests are two items, each showing the length a click writes, its menu and the wheel
      // over it choosing the length; the one a click on the staff writes with is on a purple ground
      ...(['note', 'rest'] as const).map((kind): ToolbarItem => ({
        label: t(`editor.entry.${kind}`), icon: this.lengthPicture(this.length, kind), fineIcon: true, armed: this.entry === kind, tooltip: t(`editor.entry.${kind}.tip`),
        shortcut: (kind === 'note' ? EDITOR_KEYS.notes : EDITOR_KEYS.rests).label, onClick: () => undefined,
        ref: (b) => (kind === 'note' ? (this.lengthItem = b) : (this.restItem = b)),
        menu: { items: () => this.lengthItems(kind), cell: ITEM_MENU_CELL, columns: LENGTH_ORDER.length },
      })),
      // sharp, flat and natural are one item: it shows the selected note's sign, a press gives the next
      { label: t(`editor.acc.${sign}`), icon: itemPicture(sign), fineIcon: true, tooltip: t('editor.acc.tip'), shortcut: EDITOR_KEYS.accidentals.label, onClick: () => this.cycleAccidental(), ref: (b) => (this.accidentalButton = b) },
      // ties and slurs are one item: which curve it draws follows from the notes
      { label: t('editor.arc.menu'), icon: itemPicture('tie'), fineIcon: true, shortcut: EDITOR_KEYS.ties.label, onClick: () => undefined, menu: { items: () => this.arcItems(), cell: ITEM_MENU_CELL, columns: 3 } },
      { label: t('editor.grace'), icon: TOOL_ICONS.grace, tooltip: t('editor.grace.tip'), onClick: () => this.pressGrace() },
      { label: dynamic ?? '-', icon: dynamicPicture(dynamic), fineIcon: true, keepCase: true, tooltip: t('editor.dyn.tip'), shortcut: EDITOR_KEYS.dynamics.label, onClick: () => this.cycleDynamic(), ref: (b) => (this.dynamicButton = b) },
      { label: t('editor.finger.menu'), icon: TOOL_ICONS.fingers, shortcut: EDITOR_KEYS.fingers.label, onClick: () => undefined, menu: { items: () => this.fingerItems(), cell: FINGER_MENU_CELL, columns: 6 } },
      // the two repeat signs are one item: a press asks for the start bar, then the end bar
      { label: t('editor.repeat'), icon: itemPicture('repeat'), fineIcon: true, active: this.repeatPick !== null, tooltip: t('editor.repeat.tip'), shortcut: EDITOR_KEYS.repeats.label, onClick: () => this.pressRepeat(), ref: (b) => (this.repeatButton = b) },
      { label: t(STAFF_LABEL[this.staffMode]), tooltip: t('editor.staff.tip'), shortcut: EDITOR_KEYS.staff.label, onClick: () => this.cycleStaff(), ref: (b) => (this.staffButton = b) },
      {
        label: t(this.shortTapEighth ? SHORT_TAP_LABEL.on : SHORT_TAP_LABEL.off), tooltip: t('editor.shortTap.tip'), active: this.shortTapEighth, shortcut: EDITOR_KEYS.shortTap.label,
        onClick: () => this.toggleShortTap(), ref: (b) => (this.shortTapButton = b),
      },
    ];
  }

  /** The finger menu (with the band): 1 to 5 set the selected note's finger, AUTO fills the notes that have none (ft_1_02d.AC4, AC13). */
  private fingerItems(): MenuItem[] {
    return [
      ...([1, 2, 3, 4, 5] as const).map((finger) => ({ label: String(finger), keepCase: true, tooltip: t('editor.finger.tip'), onPick: () => this.setFingerTo(finger) })),
      { label: t('editor.finger.auto'), keepCase: true, tooltip: t('editor.finger.auto.tip'), onPick: () => this.autoFillFingers() },
    ];
  }

  /**
   * The piece maker over the band (ft_1_20.AC8): no rows of buttons; the staff gets every row above the band, and the rows'
   * buttons are the band's actions and items. In the strip between the door and the gear: Save, the title, the page buttons
   * while the piece has more than one page, Import and Export; the staff starts under that strip, the message bubble just
   * under it. The time panel (time, pick-up, tempo) opens over the staff's foot; + and - after the last bar add or take bars.
   */
  private drawOverBand(): void {
    const { width, scale } = this.px;
    const rows = this.mainRows;
    const piece = this.piece;
    const strip = this.cornerStrip;
    this.staffTop = this.mainTop + strip.rows * scale;
    this.staffHeight = Math.max(1, (rows - strip.rows) * scale);
    // moved in from the sides so its sheet of parchment shows its torn sides (d119); what is drawn over it counts from there
    this.staffLeft = SHEET.staffInset * this.px.fine;
    this.ghost = this.add.graphics().setDepth(10).setX(this.staffLeft);
    this.shadows = this.add.graphics().setDepth(9).setX(this.staffLeft);
    this.target = this.add.graphics().setDepth(8).setX(this.staffLeft);
    this.ghostLabel = this.add.text(0, 0, '', { fontFamily: 'monospace', fontStyle: 'bold', fontSize: `${Math.round(5 * scale)}px`, color: hexCss(DEFAULT_THEME.cursor) }).setOrigin(0.5).setDepth(10).setVisible(false);

    const layer = this.overStaff();
    const make = (options: PixelButtonOptions) => this.buttonOn(layer, options);
    if (this.meterAsk !== null) this.drawMeterAsk(layer, rows);
    else if (this.panel === 'time') this.drawTimePanel(layer, rows);
    this.drawKeyHelp(strip.rows);
    // the top strip between the door and the gear: Save after the door, the title, the page buttons,
    // then Import and Export before the gear
    const y = strip.rows / 2;
    const icon = (at: number, key: StringKey, picture: Bitmap, shortcut: string, onClick: () => void): PixelButton => {
      const b = make({ x: at + ICON_BUTTON_WIDTH / 2, y, width: ICON_BUTTON_WIDTH, height: BAR_BUTTON_HEIGHT, label: t(key), icon: picture, iconOnly: true, tooltip: t(key), onClick });
      this.markKey(b, shortcut, layer);
      return b;
    };
    this.saveButton = icon(strip.left, 'editor.save', TOOL_ICONS.save, EDITOR_KEYS.save.label, () => void this.save());
    const exportAt = strip.right - ICON_BUTTON_WIDTH;
    const importAt = exportAt - CHOICE_GAP - ICON_BUTTON_WIDTH;
    icon(exportAt, 'editor.export', TOOL_ICONS.exportFile, EDITOR_KEYS.exportFile.label, () => void this.exportFile());
    icon(importAt, 'editor.import', TOOL_ICONS.importFile, EDITOR_KEYS.importFile.label, () => void this.importFile());
    // the page buttons, only while there is more than one page; `refreshStaff` draws the screen again when that changes
    // the same viewport as `refreshStaff`: a wider one here once counted one page where the staff had two, and each redraw
    // asked for another until the stack ran out (a minute's freeze)
    const shown = editorStaff(piece, toChart(piece, { id: this.id ?? DRAFT_ID }), this.staffViewport());
    const pages = shown.pageCount;
    this.pageButtonsDrawn = pages > 1;
    // after the last bar, on its page: + adds four bars, - takes four away (instead of the Piece panel)
    const end = this.barEnd(shown);
    this.barEndKey = spotKey(end);
    if (end && this.panel === null) {
      make({ x: end.x, y: end.y - BAR_BUTTON_HEIGHT / 2 - 1, width: STEP_WIDTH, height: BAR_BUTTON_HEIGHT, label: '+', tooltip: t('editor.bars.more'), onClick: () => this.stepBars(1) });
      make({ x: end.x, y: end.y + BAR_BUTTON_HEIGHT / 2 + 1, width: STEP_WIDTH, height: BAR_BUTTON_HEIGHT, label: '-', tooltip: t('editor.bars.fewer'), onClick: () => this.stepBars(-1) });
    }
    let titleRight = importAt - GROUP_GAP;
    if (this.pageButtonsDrawn) {
      const next = titleRight - STEP_WIDTH;
      const previous = next - CHOICE_GAP - STEP_WIDTH;
      make({ x: previous + STEP_WIDTH / 2, y, width: STEP_WIDTH, height: BAR_BUTTON_HEIGHT, label: '<', tooltip: t('editor.pagePrevious'), onClick: () => this.turnPage(-1) });
      make({ x: next + STEP_WIDTH / 2, y, width: STEP_WIDTH, height: BAR_BUTTON_HEIGHT, label: '>', tooltip: t('editor.pageNext'), onClick: () => this.turnPage(1) });
      titleRight = previous - GROUP_GAP;
    }
    const titleAt = strip.left + ICON_BUTTON_WIDTH + GROUP_GAP;
    this.placeTitleInput(titleAt, titleRight - titleAt, y);
    // what the piece maker says goes just under the strip, over the top of the sheet
    this.bubble = new SpeechBubble(this, layer, { x: strip.left, y: strip.rows + 1, width: Math.min(width, strip.right) - strip.left }, '');
    this.refreshStaff();
  }

  /**
   * The A time's question (ft_1_02d.AC21) on a panel over the staff's foot: 2/4, 3/4 and 4/4 with the guess lit (those the
   * first bar does not fit in greyed), and a tick that takes the guess. A press on a time takes that one.
   */
  private drawMeterAsk(layer: Phaser.GameObjects.Container, rows: number): void {
    const bottom = rows - PIECE_PANEL;
    const y = bottom + PIECE_PANEL / 2;
    layer.add(new PixelImage(this, 0, bottom, panelBitmap(Math.max(5, this.px.width), PIECE_PANEL, 'panel')));
    const choices = row(Math.floor((this.px.width - (3 * KEY_WIDTH + ICON_BUTTON_WIDTH + 3 * CHOICE_GAP + GROUP_GAP)) / 2), CHOICE_GAP);
    for (const beats of [2, 3, 4] as const) {
      const at = choices.take(KEY_WIDTH);
      const b = this.buttonOn(layer, { x: at + KEY_WIDTH / 2, y, width: KEY_WIDTH, height: BAR_BUTTON_HEIGHT, label: `${beats}/4`, look: 'tab', disabled: !beatsFit(this.piece, beats), onClick: () => this.confirmMeter(beats) });
      b.setActive(this.meterAsk === beats);
    }
    const tickAt = choices.end + GROUP_GAP;
    this.buttonOn(layer, { x: tickAt + ICON_BUTTON_WIDTH / 2, y, width: ICON_BUTTON_WIDTH, height: BAR_BUTTON_HEIGHT, label: t('editor.meter.confirm'), icon: TOOL_ICONS.tick, iconOnly: true, tooltip: t('editor.meter.confirm'), onClick: () => this.confirmMeter(this.meterAsk!) });
  }

  /**
   * With the A time, the parent leaving the first bar (a click or the cursor in a later bar) or filling it asks for the time
   * its length says. True when the question opened, so the click or move that asked goes no further.
   */
  private askMeter(bar: number): boolean {
    if (bar >= 1) this.meterDismissed = false;
    if (!this.meterAuto || this.meterAsk !== null || (bar < 1 && (this.meterDismissed || !firstBarFull(this.piece)))) return false;
    const guess = guessBeats(this.piece);
    if (guess === null) return false;
    this.meterAsk = guess;
    this.panel = null;
    this.redraw();
    return true;
  }

  /** The time is confirmed (the guess, or another the first bar fits in): the piece is in it from now, an undoable edit. */
  private confirmMeter(beats: Beats): void {
    const edit = confirmBeats(this.piece, beats);
    if (!edit.ok) {
      // the panel takes every key, so this is only a time the bar does not fit in: it stays open for another
      this.say(t(`editor.why.${edit.reason}` as StringKey), MESSAGE_MS);
      this.redraw();
      return;
    }
    this.meterAsk = null;
    this.meterAuto = false;
    this.history = push(this.history, edit.piece);
    this.resync();
    this.redraw();
  }

  private placeTitleInput(x: number, width: number, y = OPTIONS_ROW_Y): void {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const zoom = (rect.width / this.scale.width) * this.px.scale;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'editor-title';
    input.maxLength = 60;
    input.value = this.shownTitle();
    input.placeholder = t('editor.titlePlaceholder');
    input.setAttribute('aria-label', t('editor.titleLabel'));
    input.style.cssText = `position:absolute;left:${rect.left + window.scrollX + x * zoom}px;top:${rect.top + window.scrollY + (this.mainTopRows + y - BAR_BUTTON_HEIGHT / 2) * zoom}px;`
      + `width:${width * zoom}px;height:${BAR_BUTTON_HEIGHT * zoom}px;box-sizing:border-box;font:${Math.round(8 * zoom)}px monospace;`
      + `border:2px solid ${hexCss(DEFAULT_THEME.cursor)};border-radius:4px;background:${hexCss(DEFAULT_THEME.paper)};color:${hexCss(DEFAULT_THEME.ink)};padding:0 6px;z-index:5`;
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      input.blur();
      // a save that asked for the title goes on once the piece has one
      if (this.titleAsked && !this.needsTitle()) {
        this.titleAsked = false;
        void this.save();
      }
    });
    input.addEventListener('input', () => {
      // typing the title is not an edit to undo: it changes the piece in place
      this.history = { ...this.history, present: setTitle(this.piece, input.value) };
      this.resync();
    });
    document.body.append(input);
    this.titleInput = input;
  }

  /** The paste menu: the copied bar once, twice or four times at the end. */
  private pasteItems(): MenuItem[] {
    return ([1, 2, 4] as const).map((times) => ({ label: t(`editor.paste.${times}`), tooltip: t('editor.paste.tip'), keepCase: true, onPick: () => this.pasteBar(times) }));
  }

  /**
   * The tie and slur menu (core_09.AC13, AC30; one item for both): the curve on the selected note (a tie to
   * the same key right after, else a slur; a second press takes it away), pick the note it goes to, tie every repeat.
   */
  private arcItems(): MenuItem[] {
    return [
      { label: t('editor.arc'), icon: itemPicture('tie'), fineIcon: true, tooltip: t('editor.arc.tip'), onPick: () => this.toggleArcOnSelected() },
      { label: t('editor.arc.pick.button'), icon: itemPicture('tieTo'), fineIcon: true, tooltip: t('editor.arc.pick.tip'), onPick: () => this.armArc() },
      { label: t('editor.tie.all'), icon: TOOL_ICONS.tieAll, tooltip: t('editor.tie.all.tip'), onPick: () => this.tieEverything() },
    ];
  }

  private chooseKey(fifths: number, mode: KeyMode): void {
    if (fifths === this.piece.fifths && mode === this.piece.mode) return;
    this.change(setKey(this.piece, fifths, mode));
    this.redraw();
  }

  /**
   * The time panel (a press on the time signature): the time, stepped by its arrows or the wheel through
   * 2/4, 3/4, 4/4 and A; the pick-up (none, then one beat up to one less than the bar); and the tempo. The time changes
   * only while the piece is empty; the pick-up keeps the first bar's notes where they sound.
   */
  private drawTimePanel(layer: Phaser.GameObjects.Container, rows: number): void {
    const bottom = rows - PIECE_PANEL;
    const y = bottom + PIECE_PANEL / 2;
    layer.add(new PixelImage(this, 0, bottom, panelBitmap(Math.max(5, this.px.width), PIECE_PANEL, 'panel')));
    const group = (r: ReturnType<typeof row>, text: string, tooltip: string, step: (direction: 1 | -1) => void): PixelText => {
      const at = r.take(STEP_WIDTH);
      this.buttonOn(layer, { x: at + STEP_WIDTH / 2, y, width: STEP_WIDTH, height: BAR_BUTTON_HEIGHT, label: '-', tooltip, onClick: () => step(-1) });
      const label = new PixelText(this, r.next, y - TEXT_RISE, text, { color: C.white, shadow: C.groove });
      layer.add(label);
      r.take(label.width);
      const plus = r.take(STEP_WIDTH);
      this.buttonOn(layer, { x: plus + STEP_WIDTH / 2, y, width: STEP_WIDTH, height: BAR_BUTTON_HEIGHT, label: '+', tooltip, onClick: () => step(1) });
      return label;
    };
    const meter = row(BAR_EDGE, GROUP_GAP);
    this.meterText = group(meter, this.meterLabel(), t('editor.meter.tip'), (d) => this.stepMeter(d));
    const pickup = row(meter.end + GROUP_GAP * 2, GROUP_GAP);
    this.pickupText = group(pickup, pickupLabel(this.piece), t('editor.pickup.tip'), (d) => this.stepPickup(d));
    const bpm = row(pickup.end + GROUP_GAP * 2, GROUP_GAP);
    this.bpmText = group(bpm, t('editor.bpm', { bpm: bpmOf(this.piece) }), t('editor.bpm.tip'), (d) => this.stepBpm(d));
    this.timeGroups = [{ from: BAR_EDGE, to: meter.end, step: (d) => this.stepMeter(d) }, { from: meter.end, to: pickup.end, step: (d) => this.stepPickup(d) }, { from: pickup.end, to: bpm.end, step: (d) => this.stepBpm(d) }];
  }

  private meterLabel(): string {
    return this.meterAuto ? t('editor.meter.auto') : `${this.piece.beats}/4`;
  }

  /** One step of the time: 2/4, 3/4, 4/4, then A (the first bar written sets it, ft_1_02d.AC21); only while the piece is empty. */
  private stepMeter(direction: 1 | -1): void {
    const order = [2, 3, 4, 'A'] as const;
    const now = order.indexOf(this.meterAuto ? 'A' : this.piece.beats);
    const next = order[Math.max(0, Math.min(order.length - 1, now + direction))]!;
    if (next === order[now]) return;
    const edit = setBeats(this.piece, next === 'A' ? 4 : next);
    if (!edit.ok) return this.apply(edit, null);
    const piece = next === 'A' ? setPickup(edit.piece, 0) : edit;
    this.meterAuto = next === 'A';
    this.apply(piece, null);
    this.meterText?.setText(this.meterLabel());
    this.redraw();
  }

  protected draw(): void {
    const { width, scale } = this.px;
    const rows = this.mainRows;
    this.sky();
    const piece = this.piece;

    // no top bar: the title field is on the first options row; Back, export, import and save are on the toolbar (d088)
    this.backWith(() => this.leave());
    if (this.bandShown) return this.drawOverBand();
    // a button in a row: `at` is its left edge, from `row(...).take(width)`
    const button = (at: number, y: number, width: number, label: string, onClick: () => void) =>
      this.button({ x: at + width / 2, y, width, height: BAR_BUTTON_HEIGHT, label, onClick });
    const iconButton = (at: number, y: number, label: string, icon: Bitmap, onClick: () => void) =>
      this.button({ x: at + ICON_BUTTON_WIDTH / 2, y, width: ICON_BUTTON_WIDTH, height: BAR_BUTTON_HEIGHT, label, icon, iconOnly: true, tooltip: label, onClick });

    // first row: time, bars (no hand choice: the editor always writes on both staves), the title, Listen and Try it
    const optionY = OPTIONS_ROW_Y;
    // the meter and the key are not here: a press on the staff's time signature or clef sets them
    const barsRow = row(BAR_EDGE, GROUP_GAP);
    button(barsRow.take(STEP_WIDTH), optionY, STEP_WIDTH, '-', () => this.stepBars(-1));
    const bars = new PixelText(this, barsRow.next, optionY - TEXT_RISE, t('editor.bars', { bars: piece.bars }), { color: C.white, shadow: C.groove });
    this.root.add(bars);
    barsRow.take(bars.width);
    button(barsRow.take(STEP_WIDTH), optionY, STEP_WIDTH, '+', () => this.stepBars(1));
    const tryAt = width - BAR_EDGE - ICON_BUTTON_WIDTH;
    const listenAt = tryAt - CHOICE_GAP - ICON_BUTTON_WIDTH;
    // Listen (the ear; a square to stop while it plays) and Try it (play): pictures, the words are the tooltips
    const playing = this.player?.isPlaying === true;
    this.listenButton = iconButton(listenAt, optionY, playing ? t('editor.stop') : t('editor.listen'), playing ? TOOL_ICONS.stop : ICONS.ear, () => this.listen());
    // the keys of the tools, shown on them by F1 (ft_1_02d.AC19)
    this.markKey(iconButton(tryAt, optionY, t('editor.try'), TOOL_ICONS.play, () => this.tryIt()), EDITOR_KEYS.tryIt.label);
    this.markKey(this.listenButton, EDITOR_KEYS.listen.label);
    const titleAt = barsRow.end + GROUP_GAP;
    this.placeTitleInput(titleAt, listenAt - GROUP_GAP - titleAt);

    // second row: the tempo of the piece, written into its ABC (Q:) and chart, so the preview, Try it and the game play at it
    const keyY = KEY_ROW_Y;
    const bpmRow = row(BAR_EDGE, GROUP_GAP);
    button(bpmRow.take(STEP_WIDTH), keyY, STEP_WIDTH, '-', () => this.stepBpm(-1));
    this.bpmText = new PixelText(this, bpmRow.next, keyY - TEXT_RISE, t('editor.bpm', { bpm: BPM_MAX }), { color: C.white, shadow: C.groove });
    this.root.add(this.bpmText);
    bpmRow.take(this.bpmText.width);
    button(bpmRow.take(STEP_WIDTH), keyY, STEP_WIDTH, '+', () => this.stepBpm(1));
    // the sharp, flat and natural tools, after the tempo: they change the selected note
    const tools = row(bpmRow.end + GROUP_GAP, CHOICE_GAP);
    for (const [name, alter] of [['sharp', 1], ['flat', -1], ['natural', 0]] as const) {
      const at = tools.take(STEP_WIDTH);
      this.markKey(this.button({ x: at + STEP_WIDTH / 2, y: keyY, width: STEP_WIDTH, height: BAR_BUTTON_HEIGHT, label: t(`editor.acc.${name}`), icon: ACCIDENTAL_ICONS[name], iconOnly: true, onClick: () => this.accidental(alter) }), EDITOR_KEYS.accidentals.label);
    }
    // writing notes or rests (key 0), and the pages of lines (Page Up and Page Down); a note or a rest on the button
    const entryRow = row(tools.end + GROUP_GAP, CHOICE_GAP);
    const entryAt = entryRow.take(ICON_BUTTON_WIDTH);
    this.entryButton = this.button({ x: entryAt + ICON_BUTTON_WIDTH / 2, y: keyY, width: ICON_BUTTON_WIDTH, height: BAR_BUTTON_HEIGHT, label: t(`editor.entry.${this.entry}`), icon: this.entry === 'rest' ? REST_ICONS.quarter : NOTE_ICONS.quarter, iconOnly: true, onClick: () => this.toggleEntry() });
    this.markKey(this.entryButton, EDITOR_KEYS.rests.label);
    // repeat signs on the selected note's bar (core_09.AC20): its first bar line gets |:, its last :|
    const repeat = row(entryRow.end + CHOICE_GAP, CHOICE_GAP);
    for (const side of ['start', 'end'] as const) {
      const label = t(`editor.repeat.${side}`);
      const w = REPEAT_WIDTH;
      const at = repeat.take(w);
      this.markKey(this.button({ x: at + w / 2, y: keyY, width: w, height: BAR_BUTTON_HEIGHT, label, keepCase: true, tooltip: t(`editor.repeat.${side}.tip`), onClick: () => this.toggleRepeat(side) }), EDITOR_KEYS.repeats.label);
    }
    const pageRow = row(repeat.end + CHOICE_GAP, CHOICE_GAP);
    // the third row: copy the selected bar; paste it at the end x1, x2 or x4 times; the tie and slur tools (core_09.AC13, AC30).
    // Pictures with their names as tooltips; paste and the ties open a menu of their choices, so the row keeps room
    // (for the finger buttons)
    const copyRow = row(BAR_EDGE, CHOICE_GAP);
    this.markKey(iconButton(copyRow.take(ICON_BUTTON_WIDTH), COPY_ROW_Y, t('editor.copy'), TOOL_ICONS.copy, () => this.copyBar()), EDITOR_KEYS.copy.label);
    const paste: PixelButton = iconButton(copyRow.take(ICON_BUTTON_WIDTH), COPY_ROW_Y, t('editor.paste'), TOOL_ICONS.paste, () => this.openMenu(paste, this.pasteItems(), { cell: { w: PASTE_ITEM_WIDTH, h: BAR_BUTTON_HEIGHT }, columns: 3 }));
    const ties: PixelButton = iconButton(copyRow.take(ICON_BUTTON_WIDTH), COPY_ROW_Y, t('editor.arc.menu'), TOOL_ICONS.tie, () => this.openMenu(ties, this.arcItems(), { cell: { w: ICON_BUTTON_WIDTH, h: BAR_BUTTON_HEIGHT }, columns: 3 }));
    this.markKey(paste, EDITOR_KEYS.paste.label);
    this.markKey(ties, EDITOR_KEYS.ties.label);
    // the pre-note (core_09.AC35, d121): arms the pick on the selected note, or takes its pre-note away
    iconButton(copyRow.take(ICON_BUTTON_WIDTH), COPY_ROW_Y, t('editor.grace'), TOOL_ICONS.grace, () => this.pressGrace());
    // the finger buttons: 1 to 5 set the selected note's finger; AUTO fills the notes that have none (ft_1_02d.AC13)
    const fingerRow = row(copyRow.end + GROUP_GAP, CHOICE_GAP);
    for (const finger of [1, 2, 3, 4, 5] as const) {
      const at = fingerRow.take(FINGER_WIDTH);
      const b = this.button({ x: at + FINGER_WIDTH / 2, y: COPY_ROW_Y, width: FINGER_WIDTH, height: BAR_BUTTON_HEIGHT, label: String(finger), keepCase: true, tooltip: t('editor.finger.tip'), onClick: () => this.setFingerTo(finger) });
      if (finger === 1) this.markKey(b, EDITOR_KEYS.fingers.label);
    }
    const autoAt = fingerRow.take(AUTO_WIDTH);
    this.button({ x: autoAt + AUTO_WIDTH / 2, y: COPY_ROW_Y, width: AUTO_WIDTH, height: BAR_BUTTON_HEIGHT, label: t('editor.finger.auto'), keepCase: true, tooltip: t('editor.finger.auto.tip'), onClick: () => this.autoFillFingers() });
    // the selected note's dynamic mark, next to its finger: on the bottom bar it ran off the 320-wide screen in Estonian (d110)
    const dynWidth = Math.max(...DYNAMICS.map((d) => measure(drawnText(d)))) + LABEL_PAD;
    const dynAt = row(fingerRow.end + GROUP_GAP, CHOICE_GAP).take(dynWidth);
    this.dynamicButton = this.button({ x: dynAt + dynWidth / 2, y: COPY_ROW_Y, width: dynWidth, height: BAR_BUTTON_HEIGHT, label: '-', tooltip: t('editor.dyn.tip'), onClick: () => this.cycleDynamic() });
    this.markKey(this.dynamicButton, EDITOR_KEYS.dynamics.label);
    button(pageRow.take(STEP_WIDTH), keyY, STEP_WIDTH, '<', () => this.turnPage(-1));
    this.pageText = new PixelText(this, pageRow.next, keyY - TEXT_RISE, t('editor.page', { page: 1, pages: 1 }), { color: C.white, shadow: C.groove });
    this.root.add(this.pageText);
    pageRow.take(this.pageText.width + 2);
    button(pageRow.take(STEP_WIDTH), keyY, STEP_WIDTH, '>', () => this.turnPage(1));

    // the staff, at screen resolution, with the note names shown so the author sees what each note is
    this.staffTop = this.mainTop + OPTIONS * scale;
    this.staffHeight = Math.max(1, (rows - OPTIONS - BOTTOM) * scale);
    this.staffLeft = SHEET.staffInset * this.px.fine;
    // what is drawn over the staff counts from the staff's own left side, as its layout does
    this.ghost = this.add.graphics().setDepth(10).setX(this.staffLeft);
    this.shadows = this.add.graphics().setDepth(9).setX(this.staffLeft);
    this.target = this.add.graphics().setDepth(8).setX(this.staffLeft);
    this.ghostLabel = this.add.text(0, 0, '', { fontFamily: 'monospace', fontStyle: 'bold', fontSize: `${Math.round(5 * scale)}px`, color: hexCss(DEFAULT_THEME.cursor) }).setOrigin(0.5).setDepth(10).setVisible(false);

    // bottom bar: lengths, delete, undo, redo, and under them what the checker says
    const barY = rows - BOTTOM;
    this.root.add(new PixelImage(this, 0, barY, panelBitmap(Math.max(5, width), BOTTOM, 'panel')));
    const allowed = lengthsFor(piece);
    // the lengths start a pixel further in than the other rows, as they always have (kept, so the screen stays as it was)
    const edit = row(BAR_EDGE + 1, CHOICE_GAP);
    const editY = barY + EDIT_ROW_Y;
    // each length is the note or the rest itself; its name (1/4) is the tooltip
    const icons = this.entry === 'rest' ? REST_ICONS : NOTE_ICONS;
    LENGTH_ORDER.forEach((l) => {
      const at = edit.take(ICON_BUTTON_WIDTH);
      const length = this.button({ x: at + ICON_BUTTON_WIDTH / 2, y: editY, width: ICON_BUTTON_WIDTH, height: BAR_BUTTON_HEIGHT, label: t(`editor.length.${l}` as StringKey), icon: icons[l], iconOnly: true, onClick: () => this.chooseLength(l), disabled: !allowed.includes(l) });
      length.setActive(this.length === l);
      this.lengthButtons.set(l, length);
      // each length shows its number key; N opens the lengths from the first of them
      this.markKey(length, Object.entries(KEY_LENGTHS).find(([code, v]) => v === l && code.startsWith('Digit'))![0].slice('Digit'.length));
      if (l === 'whole') this.shortcutButtons.set(EDITOR_KEYS.notes.label, length);
    });
    edit.skip(1); // delete, undo and redo a little apart from the lengths
    // delete, undo and redo are pictures, their words the tooltips
    for (const [label, icon, action, key] of [[t('editor.delete'), TOOL_ICONS.trash, () => this.deleteSelected(), EDITOR_KEYS.delete], [t('editor.undo'), TOOL_ICONS.undo, () => this.undo(), EDITOR_KEYS.undo], [t('editor.redo'), TOOL_ICONS.redo, () => this.redo(), EDITOR_KEYS.redo]] as const) {
      this.markKey(iconButton(edit.take(ICON_BUTTON_WIDTH), editY, label, icon, action), key.label);
    }
    // after Redo: the staff the played notes go on (Auto, treble or bass) and the short-tap setting, both for the notes the keys write
    const entry = row(edit.end + GROUP_GAP, CHOICE_GAP);
    const staffWidth = Math.max(...Object.values(STAFF_LABEL).map((key) => measure(drawnText(t(key))))) + LABEL_PAD;
    const tapWidth = Math.max(...Object.values(SHORT_TAP_LABEL).map((key) => measure(drawnText(t(key))))) + LABEL_PAD;
    const staffAt = entry.take(staffWidth);
    this.staffButton = this.button({ x: staffAt + staffWidth / 2, y: editY, width: staffWidth, height: BAR_BUTTON_HEIGHT, label: '', tooltip: t('editor.staff.tip'), onClick: () => this.cycleStaff() });
    const tapAt = entry.take(tapWidth);
    this.shortTapButton = this.button({ x: tapAt + tapWidth / 2, y: editY, width: tapWidth, height: BAR_BUTTON_HEIGHT, label: '', tooltip: t('editor.shortTap.tip'), onClick: () => this.toggleShortTap() });
    this.markKey(this.staffButton, EDITOR_KEYS.staff.label);
    this.markKey(this.shortTapButton, EDITOR_KEYS.shortTap.label);
    this.showEntryOptions();
    this.status = new PixelText(this, BAR_EDGE, barY + STATUS_DROP, '', { color: C.white, shadow: C.groove, maxWidth: width - 2 * BAR_EDGE });
    this.root.add(this.status);
    this.drawKeyHelp(OPTIONS);

    this.refreshStaff();
  }
}

/** The pick-up as the time panel shows it: none, or its beats as a time is written (core_09.AC30). */
function pickupLabel(piece: Pick<EditorPiece, 'pickup'>): string {
  return piece.pickup === undefined ? t('editor.pickup.none') : t('editor.pickup', { beats: piece.pickup });
}

const spotKey = (spot: { x: number; y: number } | null): string => (spot ? `${spot.x},${spot.y}` : '');
