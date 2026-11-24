import { blit, createBitmap, fromAscii, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The pictures on the practice screen's buttons: a fermata or a running note for Wait and Tempo, a metronome for
 * the click, A, an arrow and B for a section, a note (with its name once names are on) and a hand with numbered fingers for the
 * hints; for the editor's toolbar (d088) a floppy disk for Save and an arrow into or out of a tray for Import and
 * Export; a loop for the ear trainer's repeat and the note trainer's new round, stairs for the note trainer's step, and undo, redo, a bin, play, stop, backspace and a tick for the piece maker and the name box. Original, drawn for this project (the Kenney pack page refused the download, and these are a few pixels each). Each fits inside a 14 pixel bar button with its frame (10 rows at most).
 */
export type ToolIconId = 'wait' | 'follow' | 'tempo' | 'tempoFirstNote' | 'autoReset' | 'click' | 'section' | 'noteNames' | 'noteNamesOn' | 'fingers' | 'save' | 'importFile' | 'exportFile' | 'repeat' | 'steps' | 'statsPane' | 'undo' | 'redo' | 'trash' | 'play' | 'stop' | 'backspace' | 'tick' | 'pieces' | 'copy' | 'paste' | 'tie' | 'tiePick' | 'tieAll' | 'slur' | 'slurPick' | 'grace' | 'circle' | 'more' | 'close' | 'backpack' | 'analyse' | 'staff' | 'shortTap' | 'timePanel' | 'hide' | 'songs' | 'folded' | 'unfolded' | 'link' | 'blank';

const LEGEND = { k: C.ink, w: C.white, g: C.gold, G: C.goldDark, s: C.skin } as const;

/** Letters 3 x 5 for the section and the note name. */
const LETTERS: Readonly<Record<string, readonly string[]>> = {
  A: ['.w.', 'w.w', 'www', 'w.w', 'w.w'],
  B: ['ww.', 'w.w', 'ww.', 'w.w', 'ww.'],
  C: ['www', 'w..', 'w..', 'w..', 'www'],
};
const DIGITS: Readonly<Record<string, readonly string[]>> = {
  '1': ['.k.', 'kk.', '.k.', '.k.', 'kkk'],
  '2': ['kk.', '..k', '.k.', 'k..', 'kkk'],
  '3': ['kk.', '..k', '.k.', '..k', 'kk.'],
};

const art = (rows: readonly string[]) => fromAscii(rows, LEGEND);

/** An arrow that turns back to the left: undo. Redo is its mirror. */
const UNDO = ['..w.......', '.ww.......', 'wwwwwwww..', '.ww.....w.', '..w......w', '.........w', '........w.', '....wwww..'];
const mirror = (rows: readonly string[]) => rows.map((r) => [...r].reverse().join(''));

/** A quarter note in white, 5 x 10: the stem on the right of the head. */
const NOTE = ['....w', '....w', '....w', '....w', '....w', '....w', '....w', '.wwww', 'wwwww', '.www.'];

/** A loop with an arrow: the ear trainer's repeat and the practice screen's start over. */
const REPEAT = ['..wwwwwww....', '.w.......w...', 'w.........w..', 'w.........w..', 'w.......wwwww', 'w........www.', '.w........w..', '..wwwww......'];

/** The running note of Tempo, its note gold: the first note played starts it (core_01.AC10). */
const TEMPO = ['....w.........', '....w.........', '....w.....w...', '....w.....ww..', '....w.wwwwwww.', '....w.....ww..', '....w.....w...', '.wwww.........', 'wwwww.........', '.www..........'];

/** The loop of start over with a 2 inside: back to the start after two bars with nothing played (core_01.AC11). */
function autoReset(): Bitmap {
  const b = createBitmap(13, 8);
  blit(b, art(REPEAT), 0, 0);
  blit(b, fromAscii(['ww.', '..w', '.w.', 'w..', 'www'], LEGEND), 3, 2);
  return b;
}

function section(): Bitmap {
  const b = createBitmap(18, 9);
  const at = (rows: readonly string[], x: number, y: number) => blit(b, art(rows), x, y);
  at(LETTERS.A!, 0, 2);
  at(Array.from({ length: 9 }, () => 'w'), 4, 0);
  at(['....w.', 'wwwwww', '....w.'], 6, 3);
  at(Array.from({ length: 9 }, () => 'w'), 13, 0);
  at(LETTERS.B!, 15, 2);
  return b;
}

function noteWithName(): Bitmap {
  const b = createBitmap(10, 10);
  blit(b, art(NOTE), 0, 0);
  blit(b, art(LETTERS.C!), 7, 5);
  return b;
}

function fingers(): Bitmap {
  const rows = ['.kkk.kkk.kkk.', 'ksssksssksssk', 'ksssksssksssk', 'ksssksssksssk', 'ksssksssksssk', 'ksssksssksssk', 'ksssksssksssk', 'ksssksssksssk', 'ksssssssssssk', '.kkkkkkkkkkk.'];
  const b = createBitmap(13, 10);
  blit(b, art(rows), 0, 0);
  ['1', '2', '3'].forEach((d, i) => blit(b, art(DIGITS[d]!), 1 + i * 4, 2));
  return b;
}

export const TOOL_ICONS: Readonly<Record<ToolIconId, Bitmap>> = {
  /** More (ft_1_20, d282): the bubble's own shape, a ring of eight dots round a centre, so the picture matches what opens. */
  more: art(['....ww....', '.ww....ww.', '.ww....ww.', '..........', 'ww..ww..ww', 'ww..ww..ww', '..........', '.ww....ww.', '.ww....ww.', '....ww....']),
  /** The bubble's centre: close it without doing anything. */
  /** The staff played notes go on: five lines. */
  staff: art(['wwwwwwwwww', '..........', 'wwwwwwwwww', '..........', 'wwwwwwwwww', '..........', 'wwwwwwwwww', '..........', 'wwwwwwwwww']),
  /** The short tap: an eighth note, what a short tap can write. */
  shortTap: art(['...w...', '...ww..', '...w.w.', '...w..w', '...w...', '.www...', 'wwww...', '.ww....']),
  /** The time panel: a 4 over a 4. */
  timePanel: art(['w..w', 'w..w', 'wwww', '...w', '....', 'w..w', 'w..w', 'wwww', '...w']),
  close: art(['w.....w', '.w...w.', '..w.w..', '...w...', '..w.w..', '.w...w.', 'w.....w']),
  /** The backpack the student's kept items are in (ft_1_20, d282): a bag with a flap and a buckle. */
  backpack: fromAscii(['...kkkk...', '..k....k..', '.kkkkkkkk.', 'kggggggggk', 'kgGGGGGGgk', 'kgGGkkGGgk', 'kggggggggk', 'kggggggggk', 'kGGGGGGGGk', '.kkkkkkkk.'], LEGEND),
  /** Analyse the piece (core_10): a magnifying glass. */
  analyse: art(['.www.....', 'w...w....', 'w...w....', 'w...w....', '.www.....', '....ww...', '.....ww..', '......ww.', '.......w.']),
  // a fermata: the sign that says hold, wait
  wait: art(['..wwwwwww..', '.w.......w.', 'w.........w', 'w...www...w', '....www....']),
  // a note running forward
  tempo: art(TEMPO),
  // the running note under a fermata: the tempo runs, and waits for the player (core_01.AC12)
  follow: art(['....w..ggggg..', '....w.g.....g.', '....w.g..g..g.', '....w.........', '....w.....w...', '....w.....ww..', '....w.wwwwwww.', '.wwww.....ww..', 'wwwww.....w...', '.www..........']),
  // the same, the note gold: the first note played starts the piece, no count-in (core_01.AC10)
  tempoFirstNote: art(TEMPO.map((row) => [...row].map((c, x) => (c === 'w' && x <= 4 ? 'g' : c)).join(''))),
  autoReset: autoReset(),
  click: fromAscii(['....kk...', '...kgkk.k', '...kgkkkk', '..kggkgk.', '..kgkggk.', '.kgkgggk.', '.kkggggk.', 'kgggggggk', 'kGGGGGGGk', 'kkkkkkkkk'], LEGEND),
  section: section(),
  /** The piece maker's edit tools (pictures instead of words): undo, redo, delete. */
  undo: art(UNDO),
  redo: art(mirror(UNDO)),
  trash: art(['..wwww..', 'wwwwwwww', '........', '.wwwwww.', '.w.ww.w.', '.w.ww.w.', '.w.ww.w.', '.wwwwww.']),
  /** Try it (play the piece yourself) and Stop (the piece maker's Listen while it plays). */
  play: art(['w....', 'ww...', 'www..', 'wwww.', 'wwwww', 'wwww.', 'www..', 'ww...', 'w....']),
  stop: art(['wwwwwww', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'wwwwwww']),
  /** The name box's delete (a key with a cross, pointing left) and done (a tick). */
  backspace: art(['...wwwwwwwww', '..w........w', '.w..w...w..w', 'w....w.w...w', 'w.....w....w', 'w....w.w...w', '.w..w...w..w', '..w........w', '...wwwwwwwww']),
  tick: art(['.........w', '........ww', '.......ww.', 'w.....ww..', 'ww...ww...', '.ww.ww....', '..www.....', '...w......']),
  /** The ear trainer's repeat: a loop with an arrow. */
  /** Take a piece out of the book (ft_1_02c.AC8): an eye struck through, the usual sign for hidden. */
  hide: art(['........w', '..wwwwww.', '.w..w.ww.', 'w..www..w', '.w.ww..w.', '.wwwwww..', 'w........']),
  /** The piece list: three cards stacked (the score screens' way back to the pieces, ft_1_12). */
  pieces: art(['wwwwwwwww', 'w.......w', 'wwwwwwwww', '.........', 'wwwwwwwww', 'w.......w', 'wwwwwwwww', '.........', 'wwwwwwwww']),
  /** The piece book's song bookmark (ft_1_36 rule 13): a bookmark with a note on it; the painter's picture replaces it. */
  songs: art(['wwwwwwwww', 'w....ww.w', 'w....w.ww', 'w....w..w', 'w..www..w', 'w.wwww..w', 'w..ww...w', 'w.......w', 'w..w.w..w', 'ww.....ww']),
  /** A song page's fold triangle (ft_1_36 rule 10): pointing right while its rows are folded away, down while they show. */
  folded: art(['w....', 'ww...', 'www..', 'wwww.', 'www..', 'ww...', 'w....']),
  unfolded: art(['wwwwwww', '.wwwww.', '..www..', '...w...']),
  /** The marks of a link (a curled arrow: the piece again) and a blank (a dashed outline: not written yet) on a song page's row. */
  link: art(['..www..', '.w...w.', 'w.....w', 'w...w.w', '.....ww', '...wwww', '.......']),
  blank: art(['ww.w.ww', 'w.....w', '.......', 'w.....w', '.......', 'w.....w', 'ww.w.ww']),
  repeat: art(REPEAT),
  /** The note trainer's step: stairs, beside the step's number. */
  steps: art(['.......www', '.......www', '....wwwwww', '....wwwwww', '.wwwwwwwww', '.wwwwwwwww']),
  noteNames: art(NOTE),
  noteNamesOn: noteWithName(),
  fingers: fingers(),
  // a floppy disk: the shutter at the top, the label below
  save: art(['wwwwwwwww.', 'w.w...w.ww', 'w.w...w..w', 'w.wwwww..w', 'w........w', 'w.wwwwww.w', 'w.w....w.w', 'w.w....w.w', 'w.w....w.w', 'wwwwwwwwww']),
  // an arrow coming down into a tray: a file comes in
  importFile: art(['....w....', '....w....', '....w....', '..wwwww..', 'w..www..w', 'w...w...w', 'w.......w', 'w.......w', 'wwwwwwwww']),
  // an arrow going up out of a tray: a file goes out
  exportFile: art(['....w....', '...www...', '..wwwww..', '....w....', '....w....', 'w...w...w', 'w.......w', 'w.......w', 'wwwwwwwww']),
  /** The piece maker's bar tools: copy the bar (two sheets), paste it at the end (a clipboard). */
  copy: art(['wwwwww...', 'w....w...', 'w..wwwwww', 'w..w....w', 'w..w....w', 'wwww....w', '...w....w', '...w....w', '...wwwwww']),
  paste: art(['..wwww..', 'wwwwwwww', 'w......w', 'w.wwww.w', 'w......w', 'w.wwww.w', 'w......w', 'w.www..w', 'w......w', 'wwwwwwww']),
  /** The tie tools: a tie over two notes; a tie from a note to the pointer (pick the note it goes to); ties along three notes (all). */
  tie: art(['...wwwww...', '..w.....w..', '...........', '.www....www', 'wwww...wwww', 'www....www.']),
  tiePick: art(['...wwwww...', '..w.....w..', '...........', '.www...w...', 'wwww...ww..', 'www....www.', '.......ww..', '.......w.w.']),
  tieAll: art(['...wwwww..wwwww...', '..w.....ww.....w..', '..................', '.www....www....www', 'wwww...wwww...wwww', 'www....www....www.']),
  /** The slur tools (core_09.AC30): a curve over two notes; the same curve with a pointer under its end note (pick the note it goes to). */
  slur: art(['..wwwwwww..', '.w.......w.', '...........', '.ww.....ww.', '.ww.....ww.']),
  slurPick: art(['..wwwwwww..', '.w.......w.', '...........', '.ww.....ww.', '.ww.....ww.', '.......ww..', '.......w.w.']),
  /** The pre-note (grace note, core_09.AC35): a small note with a slash through its stem before a quarter note. Original, a few pixels. */
  grace: art(['.........w', '...w.....w', '..ww.....w', '..w......w', '.ww......w', 'w.w......w', 'www......w', '.w....wwww', '.....wwwww', '......www.']),
  /** The circle of fifths (ft_1_28): a ship's helm, as the wheel on the overlay (the painter): a thick brass-bound rim, four spokes, four wooden handles and four small brass ones between, and a brass boss. Original, a few pixels. */
  circle: art(['....ww....', '.G..gg..G.', '..gggggg..', '.gg.ww.gg.', 'wggwGGwggw', 'wggwGGwggw', '.gg.ww.gg.', '..gggggg..', '.G..gg..G.', '....ww....']),
  // four bars rising, the last one gold: the stats pane of the latest plays (ft_1_12)
  statsPane: art(['.........gg', '.........gg', '......ww.gg', '......ww.gg', '...ww.ww.gg', '...ww.ww.gg', 'ww.ww.ww.gg', 'ww.ww.ww.gg', 'wwwwwwwwwww']),
};
