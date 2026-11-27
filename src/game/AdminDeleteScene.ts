import { t } from '../core/text/strings';
import { guardAdmin } from './adminGuard';
import { contextOf } from './context';
import { C } from './ui/pixel/palette';
import { PixelScene } from './ui/pixel/PixelScene';
import { startScene } from './scenes';

const MARGIN = 12;
const TITLE_Y = 6;
const FIRST_Y = 30;
const ROW_HEIGHT = 18;
const ROW_GAP = 4;
const ROW_WIDTH = 140;
const COLUMN_GAP = 8;
/** Two columns of five rows: all ten players (MAX_PLAYERS) fit a screen of 180 rows under the toolbar. */
const ROWS_PER_COLUMN = 5;
const STATUS_Y = FIRST_Y + ROWS_PER_COLUMN * (ROW_HEIGHT + ROW_GAP) + 4;

/**
 * Delete a player (ft_1_07.AC9): Admin, Delete player, then one button per player. The first tap on a name asks
 * ("Delete TUVI?"), the second deletes that player; tapping another name moves the question there. The last player cannot be
 * deleted. Rules are in `ProfileService.deletePlayer`; this scene only draws and calls it.
 */
export class AdminDeleteScene extends PixelScene {
  /** No player here yet (d088): the toolbar shows no name, rank, XP or settings. */
  protected override toolbarPlayer = false;
  protected override keyboardNavigation = true;
  /** The player whose name was tapped once: the next tap on it deletes. */
  private asking: string | null = null;
  private status = '';
  private deleting = false;

  constructor() {
    super('adminDelete');
  }

  init(): void {
    this.asking = null;
    this.status = '';
    this.deleting = false;
  }

  protected override back(): void {
    startScene(this, 'admin');
  }

  override create(): void {
    super.create();
    guardAdmin(this);
  }

  protected draw(): void {
    const { width } = this.px;
    const { profiles } = contextOf(this);
    this.sky();
    this.label(MARGIN, TITLE_Y, t('admin.delete'), C.gold, { big: true });
    const row = (i: number) => FIRST_Y + (i % ROWS_PER_COLUMN) * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
    const column = (i: number) => MARGIN + Math.floor(i / ROWS_PER_COLUMN) * (ROW_WIDTH + COLUMN_GAP) + ROW_WIDTH / 2;
    profiles.profiles.forEach((player, i) => {
      const asking = this.asking === player.id;
      this.button({
        x: column(i), y: row(i), width: ROW_WIDTH, height: ROW_HEIGHT,
        label: asking ? t('admin.deleteName', { name: player.name }) : player.name,
        ...(asking ? { look: 'tab' as const } : {}),
        onClick: () => this.tap(player.id),
      });
    });
    if (this.status) this.label(MARGIN, STATUS_Y, this.status, C.dim, { maxWidth: width - 2 * MARGIN });
  }

  private tap(id: string): void {
    if (this.deleting) return;
    // the last player is never deleted: say so at the first tap, without first asking a question whose yes would be refused
    if (contextOf(this).profiles.profiles.length <= 1) {
      this.asking = null;
      this.status = t('admin.keepOne');
      this.redraw();
      return;
    }
    if (this.asking !== id) {
      this.asking = id;
      this.status = '';
      this.redraw();
      return;
    }
    this.deleting = true;
    void contextOf(this).profiles.deletePlayer(id)
      .then((ok) => {
        this.status = ok ? '' : t('admin.keepOne');
      })
      .catch(() => {
        this.status = t('admin.failed');
      })
      .finally(() => {
        this.asking = null;
        this.deleting = false;
        this.redraw();
      });
  }
}
