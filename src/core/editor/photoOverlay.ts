/**
 * The photo behind the piece maker's staff (ft_Y_04 slice 4, AC16): after a photo import, each bar of the staff shows
 * the same bar cut from the cleaned photo, fitted to the bar, so the person checks and fills the piece against the
 * sheet without looking away from the screen. The piece maker spaces notes its own way, so the photo is fitted bar by
 * bar (left and right bar line to the bar's ends) and staff by staff (top and bottom line to the staff's lines); a
 * shift moves the photo's bars against the piece's when the recognition merged or split a bar. Pure: the scene draws
 * the patches.
 */
import type { StaffLayout } from '../layout/staffTypes';
import type { EditorHand } from './model';

/** A staff of the straightened photo: the rows of its top and bottom line. */
export interface PhotoStaff {
  readonly top: number;
  readonly bottom: number;
}

/** A system of the photo: its staves, top first, and its bars, left to right. */
export interface PhotoSystem {
  readonly staves: readonly PhotoStaff[];
  readonly bars: readonly { readonly x1: number; readonly x2: number }[];
}

/** Where the staves and bars are in the cleaned photo (written by the photo import, `tools/import/clean.ts`). */
export interface PhotoLayout {
  readonly width: number;
  readonly height: number;
  readonly systems: readonly PhotoSystem[];
}

/** A piece of the photo (`s`) and where it goes on the staff (`d`, in the staff layout's coordinates). */
export interface PhotoPatch {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  readonly dx: number;
  readonly dy: number;
  readonly dw: number;
  readonly dh: number;
}

/** How far above the top line and below the bottom line a staff's patch reaches when no staff is next to it, in staff spaces. */
const MARGIN = 4;

/** The photo's bars in reading order, each with its system. */
function photoBars(photo: PhotoLayout): { system: PhotoSystem; x1: number; x2: number }[] {
  return photo.systems.flatMap((system) => system.bars.map((bar) => ({ system, x1: bar.x1, x2: bar.x2 })));
}

/** How many bars the photo has: the shift goes from minus that to plus that. */
export function photoBarCount(photo: PhotoLayout): number {
  return photoBars(photo).length;
}

/** The rows of a staff's patch: down to halfway to the staff below, up to halfway to the staff above, else MARGIN spaces. */
function reach(staves: readonly { top: number; bottom: number }[], k: number): { from: number; to: number } {
  const staff = staves[k] ?? { top: 0, bottom: 0 };
  const space = (staff.bottom - staff.top) / 4;
  const above = staves[k - 1];
  const below = staves[k + 1];
  return {
    from: above ? (above.bottom + staff.top) / 2 : staff.top - MARGIN * space,
    to: below ? (staff.bottom + below.top) / 2 : staff.bottom + MARGIN * space,
  };
}

/**
 * The patches that lay the photo behind the bars of `page`: bar `i` of the piece shows bar `i + shift` of the photo.
 * A photo of one staff a system (a piece for one hand) goes on the staff of `hand`.
 */
export function photoPatches(layout: StaffLayout, photo: PhotoLayout, options: { page: number; shift: number; hand?: EditorHand }): PhotoPatch[] {
  const bars = photoBars(photo);
  const patches: PhotoPatch[] = [];
  for (const bar of layout.bars) {
    const system = layout.systems[bar.system];
    const source = bars[bar.index + options.shift];
    if (!system || system.page !== options.page || !source) continue;
    const photoStaves = source.system.staves;
    system.staves.forEach((staff, k) => {
      const onlyStaff = photoStaves.length === 1 && system.staves.length > 1;
      const j = onlyStaff ? (staff.trackId.toUpperCase() === (options.hand ?? 'RH') ? 0 : -1) : k;
      const from = photoStaves[j];
      if (!from) return;
      const scale = (staff.bottomLineY - staff.topLineY) / (from.bottom - from.top);
      if (!(scale > 0) || !Number.isFinite(scale)) return;
      const rows = onlyStaff ? reach([from], 0) : reach(photoStaves, j);
      const toY = (y: number): number => staff.topLineY + (y - from.top) * scale;
      const sy = Math.max(0, rows.from);
      const sh = Math.min(photo.height, rows.to) - sy;
      if (sh <= 0) return;
      patches.push({ sx: source.x1, sy, sw: source.x2 - source.x1, sh, dx: bar.x, dy: toY(sy), dw: bar.width, dh: sh * scale });
    });
  }
  return patches;
}
