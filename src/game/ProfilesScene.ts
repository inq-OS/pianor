import { ART_DETAIL } from '../core/layout/frame';
import { lanternPlan } from '../core/layout/lantern';
import { MAIN_MENU, mainMenuLayout } from '../core/layout/mainMenu';
import { rectCentre, rectRight, type Rect } from '../core/layout/rect';
import { MAX_PLAYERS } from '../core/progression/playerNames';
import type { SceneLook } from '../core/sky/sceneLook';
import { clipToWidth } from '../core/text/clip';
import { t } from '../core/text/strings';
import { adminEntry, teacherEntry } from './adminGuard';
import { contextOf } from './context';
import { MAKER_KEY } from './MenuScene';
import type { NameData } from './NameScene';
import { startScene } from './scenes';
import type { Bitmap } from './ui/pixel/bitmap';
import { drawnText, measure } from './ui/pixel/font';
import { ICONS } from './ui/pixel/iconArt';
import { LANTERN_WAY } from './ui/pixel/keri/lanternPicture';
import { tinted } from './ui/pixel/frames';
import { activeMark, addPlate, hatPicture, inked, keyboardPicture, nameBoard, parchment, scroll, SCROLL_BLEED } from './ui/pixel/menuArt';
import { C } from './ui/pixel/palette';
import { PixelImage, type PixelButton } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';
import { PAINTED } from './ui/pixel/keri/keriPictures';
import { currentLook } from './ui/pixel/sky/skyLooks';
import { GUST_MS, cloudCourses, daySky, lookMs } from './ui/pixel/windMotion';
import { airOf } from './ui/pixel/windField';
import { glowAt } from './ui/pixel/flicker';

/** Room between the game's name board and the line that says progress cannot be saved. */
const NO_SAVE_GAP = 4;

/** However little of the sky the day's cover leaves, at least this many clouds show. */
const LEAST_CLOUDS = 3;
/** The parchment a written name keeps free at its line's two ends, in layout cells: a name begins six cells in (`PixelButton`). */
const NAME_MARGIN = 8;
/** A choice under the gear, written on a scrap of the same parchment: as wide as a line of the sheet. */
const GEAR_ITEM = { w: MAIN_MENU.line.w, h: 15 } as const;

/**
 * The main menu (ft_1_07, the first screen): the lantern of Keri's lighthouse
 * over the island fills the whole screen, one painted picture (`virtual:keri-pictures`, made when the game is built)
 * with what moves laid over it. In its upper left hangs the board with the game's name, and under that a sheet of
 * parchment (`mainMenuLayout`) on which the players are written one under the other, the active one marked with a
 * star; an outlined "+" on the next free line, which asks for a new player's name; and at its foot a keyboard, the
 * bare piano that saves nothing, the academic hat (the teacher's screen, d145), and the gear, which holds Credits and Admin on a scrap of parchment. No heading, no toolbar and no band: the
 * screen paints every row itself. Choosing a player makes them active and opens their room (`ProfileDashboardScene`).
 * Rules are in `ProfileService`; this scene only draws and calls it.
 *
 * AX-3 provisional (asked of the architect): the keyboard opens the list of own pieces as the piece maker's
 * button did, and the gear opens a small menu, until the bare piano and the settings before a player is picked are built.
 */
export class ProfilesScene extends PixelScene {
  /** No player here yet (d088). */
  protected override toolbarPlayer = false;
  protected override wholeScreen = true;
  protected override keyboardNavigation = true;
  private look: SceneLook | null = null;
  /** The player last picked is open in another window (d159): said on the sheet until a player is opened. */
  private busy = false;

  constructor() {
    super('profiles');
  }

  /** A scene object is reused on every visit: each visit decides its sky again. */
  override create(): void {
    this.look = null;
    this.busy = false;
    super.create();
  }

  protected draw(): void {
    const context = contextOf(this);
    const profiles = context.profiles;
    this.registry.set(MAKER_KEY, false);
    this.sky();
    const players = profiles.profiles.slice(0, MAX_PLAYERS);
    // a player whose save cannot be read is still written on the sheet, greyed, so the student sees it was not lost without a word
    const damaged = profiles.damaged.slice(0, MAX_PLAYERS - players.length);
    const layout = mainMenuLayout({ width: this.px.width, height: this.px.height, players: players.length + damaged.length, canAdd: profiles.canAddPlayer && players.length + damaged.length < MAX_PLAYERS, piano: context.flags.editor });
    this.picture(layout.picture);
    // the game's name on its hung board, and the sheet of names under it
    this.root.add(new PixelImage(this, layout.name.x, layout.picture.y, nameBoard(layout.name.w, layout.name.h, layout.name.y - layout.picture.y)));
    const name = t('app.title');
    this.label(layout.name.x + Math.round((layout.name.w - measure(drawnText(name)) * 2) / 2), layout.name.y + 3, name, C.gold, { big: true });
    // when nothing can be kept (no IndexedDB and no localStorage) the players listed are not the ones saved before, and what
    // is played now is lost on closing: say so here, where a player is picked, not only on the piece list
    // a player already open in another window is not opened here too: the two would write over each other's progress (d159)
    const notice = this.busy ? t('menu.playerBusy') : context.savesPersist ? null : t('menu.noSave');
    if (notice) {
      const x = rectRight(layout.name) + NO_SAVE_GAP;
      this.label(x, layout.name.y + 3, notice, C.gold, { maxWidth: this.px.width - x - NO_SAVE_GAP });
    }
    // the scroll, with a flourish of red ink between the two pictures at its head and the names under them
    const rule = layout.gear.y + layout.gear.h + MAIN_MENU.tools.gap / 2 - layout.sheet.y;
    this.fineImage(layout.sheet.x * ART_DETAIL - SCROLL_BLEED.left, layout.sheet.y * ART_DETAIL - SCROLL_BLEED.top, scroll(layout.sheet.w, layout.sheet.h, rule));

    players.forEach((summary, i) => {
      const line = layout.players[i]!, active = summary.id === profiles.profile.id;
      // a name too long for its line (twelve wide letters, or an imported save's) is cut, never wrapped
      const room = line.w - NAME_MARGIN;
      const width = (text: string) => measure(drawnText(text));
      const label = width(summary.name) > room ? clipToWidth(summary.name, room, width) : summary.name;
      this.button({ ...rectCentre(line), label, look: 'ink', align: 'left', onClick: () => void this.open(summary.id) })
        .setActive(active);
      // the active player's line carries the lantern's star, in red ink in the sheet's margin
      if (active) {
        const mark = tinted(activeMark(), C.redDark, C.redDark);
        this.root.add(new PixelImage(this, line.x - 2, line.y + Math.floor((line.h - mark.height) / 2), mark));
      }
    });
    damaged.forEach((summary, i) => {
      const line = layout.players[players.length + i]!;
      const name = summary.name === '' ? t('menu.damagedName') : summary.name;
      const width = (text: string) => measure(drawnText(text));
      const label = width(name) > line.w - NAME_MARGIN ? clipToWidth(name, line.w - NAME_MARGIN, width) : name;
      this.button({ ...rectCentre(line), label, look: 'ink', align: 'left', disabled: true, tooltip: t('menu.damagedSave'), onClick: () => undefined });
    });
    // the next free line asks for a free name; it is gone once the device has ten players (ft_1_07.AC10)
    if (layout.add) this.button({ ...rectCentre(layout.add), label: t('menu.newPlayer'), picture: addPlate(layout.add.w, layout.add.h), onClick: () => startScene(this, 'name', newPlayerBox()) });
    // the bare piano: the list of own pieces straight from here, with no player's room in between; saves no progress
    if (layout.piano) this.button({ ...rectCentre(layout.piano), label: t('menu.pieceMaker'), icon: keyboardPicture(5), iconOnly: true, look: 'ink', onClick: () => { this.registry.set(MAKER_KEY, true); startScene(this, 'menu'); } });
    // the academic hat: the teacher's screen, behind her own password (ft_1_26.AC1, d140, d145)
    this.button({ ...rectCentre(layout.hat), label: t('teacher.open'), picture: hatPicture(), onClick: () => startScene(this, teacherEntry(this)) });
    const gear: PixelButton = this.button({
      ...rectCentre(layout.gear), label: t('menu.settingsButton'), icon: inked(ICONS.settings), iconOnly: true, look: 'ink',
      onClick: () => this.openMenu(gear, [
        { label: t('menu.creditsButton'), onPick: () => startScene(this, 'credits') },
        // straight in while the admin features are open (30 minutes after the password, ft_1_07.AC8)
        { label: t('admin.open'), onPick: () => startScene(this, adminEntry(this)) },
      ], { cell: GEAR_ITEM, columns: 1, paper: (w, h) => parchment(w, h) }),
    });
  }

  /** Opens a player's room, unless another window holds that player: then the sheet stays and says so. */
  private async open(id: string): Promise<void> {
    const result = await contextOf(this).profiles.switchTo(id).catch(() => 'unreadable' as const);
    if (result === 'busy') {
      this.busy = true;
      this.redraw();
      return;
    }
    startScene(this, 'profile');
  }

  /** The lantern over Keri in `at` (layout cells): the picture with its sky bare, the day's clouds, what stands before the sky, the light in the lens. */
  private picture(at: Rect): void {
    const plan = lanternPlan();
    const sky = contextOf(this).flags.sky;
    const now = sky.now ?? Date.now();
    this.look ??= currentLook(now, sky.phase, sky.wind);
    const picture = this.loaded(PAINTED.lantern, this.look.phase, at);
    if (!picture) return;
    // the player's room is the next screen on the way to the piano: its picture loads while the menu is shown
    PAINTED.room.load(this.look.phase).catch(() => undefined);
    const { palette } = picture;
    const origin = { x: at.x * ART_DETAIL, y: at.y * ART_DETAIL };
    const { wind } = this.look;
    const laid = (o: { x: number; y: number; frames: readonly Bitmap[] }) => o.frames.map((frame) => this.fineImage(origin.x + o.x, origin.y + o.y, frame, palette));
    // everything on one wind whose gusts cross the picture (`windField.ts`)
    const seed = daySky(now, wind).seed, width = picture.frames[0]!.width;
    const air = airOf(wind, LANTERN_WAY, seed);
    const sway = lookMs(wind, picture.frames.length), gusting = { fade: true, clock: (time: number) => air.time(time, width / 2) };
    this.cycle(laid({ x: 0, y: 0, frames: picture.frames }), sway, undefined, gusting);
    // the water's strokes, glints and bands, each on its own course (`paint/live.ts`)
    this.liveWater(picture.water, origin, palette, GUST_MS[wind]!, seed, air);
    const painted = picture.clouds.map((c) => ({ x: c.x, y: c.y, width: c.bitmap.width, height: c.bitmap.height, near: Math.max(0, 1 - c.y / plan.horizon) }));
    const courses = cloudCourses(painted, width, wind, daySky(now, wind), LEAST_CLOUDS);
    this.drift(picture.clouds.map((c, i) => ({ bitmap: c.bitmap, course: courses[i]! })), { ...origin, w: width }, LANTERN_WAY, palette, air);
    this.cycle(laid(picture.fore), sway, undefined, gusting);
    // the flame in the lens wanders up and down in strength, never on a beat (`flicker.ts`)
    this.blend(laid(picture.light), (time) => glowAt(time, picture.light.frames.length, 9 + (seed % 100)));
  }
}

/**
 * The name box a new install opens on (ft_1_07.AC1): no player exists until this name is given, and there is no Back, since
 * the menu would have nobody on it. The new player's room follows, as for any new player.
 */
export function firstPlayerBox(): NameData {
  return { title: newPlayerBox().title, save: newPlayerBox().save };
}

/** The name box for a new player (ft_1_07.AC10): a free name adds the player and opens their room; Back adds nobody. */
function newPlayerBox(): NameData {
  return {
    title: t('menu.newPlayer'),
    save: (scene, name) => contextOf(scene).profiles.createPlayer(name).then((result) => {
      if (result === 'ok') startScene(scene, 'profile');
      return result === 'ok' ? null : t(result === 'taken' ? 'name.taken' : result === 'blank' ? 'admin.nameBlank' : 'admin.full', { n: MAX_PLAYERS });
    }),
    back: (scene) => startScene(scene, 'profiles'),
  };
}
