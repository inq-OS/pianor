export interface PageSlice {
  /** The page shown, 0-based, kept inside the list. */
  page: number;
  pages: number;
  /** Index of the first item on the page. */
  first: number;
  /** Items on the page. */
  count: number;
  /** True when there is more than one page, so a pager is needed. */
  paged: boolean;
}

export interface PagingOptions {
  /** Up to this many items fit on one page without a pager. */
  singlePageMax?: number;
  /** Items per page once the list needs a pager (one row less than a full page, for the pager itself). */
  perPage?: number;
}

/**
 * Which items of a list of `total` show on page `requested`. A list that fits on one screen has no pager, so the
 * buttons keep their size; a longer list is cut into pages of fixed size instead of shrinking every button.
 */
export function pageOf(total: number, requested: number, options: PagingOptions = {}): PageSlice {
  const { singlePageMax = 7, perPage = 6 } = options;
  if (total <= singlePageMax) return { page: 0, pages: 1, first: 0, count: total, paged: false };
  const pages = Math.ceil(total / perPage);
  const page = Math.min(pages - 1, Math.max(0, Math.floor(requested)));
  const first = page * perPage;
  return { page, pages, first, count: Math.min(perPage, total - first), paged: true };
}

/**
 * The item a wheel notch or a page turn goes to in a paged list of `total` items: `current` (a list index, or null when
 * nothing is chosen yet) moved by `step` items, or by `step` pages keeping its place on the page with `pages`. It stays
 * inside the list and never wraps round; null for an empty list. With nothing chosen the first item of `page` is chosen.
 */
export function stepItem(total: number, current: number | null, step: number, options: PagingOptions & { page?: number; pages?: boolean } = {}): number | null {
  if (total <= 0) return null;
  const slice = pageOf(total, options.page ?? 0, options);
  const clamp = (i: number) => Math.min(total - 1, Math.max(0, i));
  if (current === null) return clamp(slice.first);
  if (!options.pages) return clamp(current + step);
  if (!slice.paged) return clamp(current);
  const perPage = options.perPage ?? 6;
  const page = Math.min(slice.pages - 1, Math.max(0, Math.floor(current / perPage) + step));
  return clamp(page * perPage + (current % perPage));
}
