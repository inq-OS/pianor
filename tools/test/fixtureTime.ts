/**
 * The calendar of tests and fixtures. A test day is a made-up day no later than `FIXTURE_LAST_YEAR`, so no test or fixture
 * shows when the work was done; a test that needs real weekdays takes a year 28 years before the one it means (the
 * calendar repeats). `tests/content/fixtureDates.test.ts` holds every committed test and fixture to it.
 */
export const FIXTURE_LAST_YEAR = 2000;

/** A fixed moment for a test that only needs some day (screenshots fix the page's clock to it). */
export const FIXTURE_TIME = new Date(FIXTURE_LAST_YEAR, 0, 3, 12, 0, 0);
