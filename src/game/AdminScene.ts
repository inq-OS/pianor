import { t } from '../core/text/strings';
import { MAX_PLAYERS } from '../core/progression/playerNames';
import { contextOf } from './context';
import { C } from './ui/pixel/palette';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { startScene } from './scenes';
import { guardAdmin } from './adminGuard';
import { LOCK } from './ui/pixel/sprites';
import type { NameData } from './NameScene';

/** What the admin page shows on arrival: the last thing that happened (renamed, why an import failed). */
export interface AdminData {
  status?: string;
}

const MARGIN = 12;
const TITLE_Y = 6;
const FIRST_Y = 30;
const ROW_HEIGHT = 22;
const ROW_GAP = 6;
const ROW_WIDTH = 200;
const STATUS_Y = 146;

/**
 * The admin page (ft_1_07, slice 7): export the active player to a file, import a file as a new player, rename the active
 * player, and open the delete list (ft_1_07.AC9, `AdminDeleteScene`). The save format is unchanged. Files and the name box go
 * through `context.files`. It stays open 30 minutes after the password, or until the lock on the toolbar (ft_1_07.AC8).
 */
export class AdminScene extends PixelScene {
  /** No player here yet (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  protected override keyboardNavigation = true;
  /** The last thing that happened (exported, renamed, why an import failed); drawn under the buttons. */
  private status = '';

  constructor() {
    super('admin');
  }

  /** The status comes in with the restart that makes it, so a redraw keeps it. */
  init(data?: AdminData): void {
    this.status = data?.status ?? '';
  }

  override create(): void {
    super.create();
    guardAdmin(this);
  }

  protected override back(): void {
    startScene(this, 'profiles');
  }

  protected draw(): void {
    const { width } = this.px;
    const { profiles, files } = contextOf(this);
    this.sky();
    this.label(MARGIN, TITLE_Y, t('admin.title'), C.gold, { big: true });
    // AX-3 provisional: the admin's tasks are a list (an adult's page, words too long for a cell) and stay in the main area under the band (ft_1_20 rule 1)
    const row = (i: number) => FIRST_Y + i * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
    this.button({
      x: MARGIN + ROW_WIDTH / 2, y: row(0), width: ROW_WIDTH, height: ROW_HEIGHT, label: t('admin.export'),
      onClick: () => void profiles.exportActive().then((text) => {
        files.download(`pianor-${profiles.profile.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.json`, text, 'application/json');
        this.scene.restart({ status: t('admin.exported') });
      }),
    });
    this.button({
      x: MARGIN + ROW_WIDTH / 2, y: row(1), width: ROW_WIDTH, height: ROW_HEIGHT, label: t('admin.import'),
      // the picker must open straight from this click, so nothing is awaited before it
      onClick: () => void files.pick({ accept: '.json,application/json', id: 'admin-import-file' }).then(async (text) => {
        if (text === null) return;
        const result = await profiles.importPlayer(text, 'new');
        if (result.ok) startScene(this, 'profile');
        else this.scene.restart({ status: result.full ? t('admin.full', { n: MAX_PLAYERS }) : t('admin.importFailed') });
      }),
    });
    this.button({
      x: MARGIN + ROW_WIDTH / 2, y: row(2), width: ROW_WIDTH, height: ROW_HEIGHT, label: t('admin.rename'),
      onClick: () => startScene(this, 'name', renameBox(profiles.profile.id)),
    });
    if (profiles.profiles.length > 1) {
      this.button({
        x: MARGIN + ROW_WIDTH / 2, y: row(3), width: ROW_WIDTH, height: ROW_HEIGHT, look: 'tab', label: t('admin.delete'),
        onClick: () => startScene(this, 'adminDelete'),
      });
    }
    if (this.status) this.label(MARGIN, STATUS_Y, this.status, C.dim, { maxWidth: width - 2 * MARGIN });
  }

  /**
   * Pages (dev pages, the draft switch and the password) and the lock (ft_1_07.AC8: closes the admin features before
   * their 30 minutes are up and returns to the main menu) are the admin screen's own toolbar items (d088).
   */
  protected override toolbarItems(): ToolbarItem[] {
    const { admin } = contextOf(this);
    return [
      { label: t('admin.pages'), onClick: () => startScene(this, 'adminPages') },
      { label: t('admin.lock'), icon: LOCK, iconOnly: true, tooltip: t('admin.lock'), onClick: () => { admin.lock(); startScene(this, 'profiles'); } },
    ];
  }
}

/** The name box for renaming a player: a refused name keeps the box open with the reason; a saved one returns here. */
function renameBox(id: string): NameData {
  return {
    title: t('admin.renameAsk'),
    save: (scene, name) => contextOf(scene).profiles.renamePlayer(id, name).then((result) => {
      if (result === 'ok') startScene(scene, 'admin', { status: t('admin.renamed') });
      return result === 'ok' ? null : t(result === 'taken' ? 'name.taken' : result === 'blank' ? 'admin.nameBlank' : 'admin.failed');
    }),
    back: (scene) => startScene(scene, 'admin'),
  };
}
