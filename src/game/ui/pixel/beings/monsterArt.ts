import { blit, createBitmap, fromAscii, type Bitmap } from '../bitmap';
import { C } from '../palette';

/**
 * A monster (first drawn for the old campaign trail; now the beings by the fire in Keri's scenes, ft_1_19): a purple
 * dome with cream horns that bobs and blinks. Original, drawn pixel by pixel for this project as rows of letters
 * (docs/sprites.md): an `ink` outline round every shape and the palette ramps, light from the top left.
 */

const MONSTER_LEGEND = {
  k: C.ink,
  c: C.cream,
  q: C.purpleLight,
  p: C.purple,
  P: C.purpleDark,
  r: C.red,
  w: C.white,
} as const;

/** The monster's body without its eyes: cream horns, a purple dome, stubby feet. 22 wide, 21 tall; drawn 2 rows down in the frame. */
const MONSTER_BODY = [
  '.....k..........k.....',
  '....kck........kck....',
  '....kck........kck....',
  '...kccck......kccck...',
  '...kkkkkkkkkkkkkkkk...',
  '..kqqqpppppppppppPPk..',
  '..kqqpppppppppppppPPk.',
  '..kqqpppppppppppppPPk.',
  '..kqqpppppppppppppPPk.',
  '.kqqppppppppppppppPPPk',
  '.kqqppppppppppppppPPPk',
  '.kqqppppppppppppppPPPk',
  '.kqppppppppppppppPPPPk',
  '.kpppppppppppppppPPPPk',
  '.kPPPPPPPPPPPPPPPPPPk.',
  '..kPPPPPPPPPPPPPPPPk..',
  '...kPPPPPPPPPPPPPPk...',
  '....kkkkkkkkkkkkkk....',
  '....kpppk....kpppk....',
  '....kPPPk....kPPPk....',
  '...kkkkkk....kkkkkk...',
];

/** The open eyes: white, the pupil on the left (the monster looks toward the player). */
const EYES_OPEN = ['www...www', 'kww...kww', 'www...www'];
/** The closed eyes: a lid line. */
const EYES_CLOSED = ['.........', 'kkk...kkk', '.........'];
const MOUTH = ['kkkkkk', 'rcrrcr', 'kkkkkk'];

const EYE_AT = { x: 5, y: 7 } as const;
const MOUTH_AT = { x: 8, y: 11 } as const;
/** The body's top row in the frame (the horns need the room). */
const MONSTER_TOP = 2;

function monsterFrame(dy: number, eyes: readonly string[]): Bitmap {
  const body = fromAscii(MONSTER_BODY, MONSTER_LEGEND);
  const out = createBitmap(22, 24);
  blit(out, body, 0, MONSTER_TOP + dy);
  blit(out, fromAscii(eyes, MONSTER_LEGEND), EYE_AT.x, MONSTER_TOP + EYE_AT.y + dy);
  blit(out, fromAscii(MOUTH, MONSTER_LEGEND), MOUTH_AT.x, MONSTER_TOP + MOUTH_AT.y + dy);
  return out;
}

/** The monster with its eyes open, bobbing: frame 1 is the whole body one row lower. */
export const MONSTER_FRAMES: readonly Bitmap[] = [monsterFrame(0, EYES_OPEN), monsterFrame(1, EYES_OPEN)];
/** The same two frames with the eyes shut. */
export const MONSTER_BLINK_FRAMES: readonly Bitmap[] = [monsterFrame(0, EYES_CLOSED), monsterFrame(1, EYES_CLOSED)];
