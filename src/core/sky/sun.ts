/**
 * The sun's height over a place, from a UTC instant (ft_1_14 scope item 1, d097). NOAA low-precision solar position
 * formulas: about a minute of error in sunrise time. Pure: no clock, no time zone, no network.
 */

const MS_PER_DAY = 86_400_000;
const J2000 = 2_451_545;
const DEG = Math.PI / 180;

/** The sun's centre elevation in degrees above the horizon (no refraction), at `instant` (ms since 1970 UTC). */
export function solarElevation(instant: number, latitude: number, longitude: number): number {
  const julianDay = instant / MS_PER_DAY + 2_440_587.5;
  const T = (julianDay - J2000) / 36_525;

  const meanLongitude = (280.46646 + T * (36_000.76983 + T * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + T * (35_999.05029 - 0.0001537 * T);
  const M = meanAnomaly * DEG;
  const eccentricity = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const centre =
    Math.sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M) * (0.019993 - 0.000101 * T) + Math.sin(3 * M) * 0.000289;
  const trueLongitude = meanLongitude + centre;
  const omega = (125.04 - 1934.136 * T) * DEG;
  const apparentLongitude = (trueLongitude - 0.00569 - 0.00478 * Math.sin(omega)) * DEG;

  const seconds = 21.448 - T * (46.815 + T * (0.00059 - T * 0.001813));
  const obliquity = (23 + (26 + seconds / 60) / 60 + 0.00256 * Math.cos(omega)) * DEG;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));

  // Equation of time, in minutes.
  const y = Math.tan(obliquity / 2) ** 2;
  const L0 = meanLongitude * DEG;
  const equationOfTime =
    4 *
    (y * Math.sin(2 * L0) -
      2 * eccentricity * Math.sin(M) +
      4 * eccentricity * y * Math.sin(M) * Math.cos(2 * L0) -
      0.5 * y * y * Math.sin(4 * L0) -
      1.25 * eccentricity * eccentricity * Math.sin(2 * M)) /
    DEG;

  const minutesUtc = ((instant % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY / 60_000;
  const trueSolarMinutes = minutesUtc + equationOfTime + 4 * longitude;
  const hourAngle = (trueSolarMinutes / 4 - 180) * DEG;

  const phi = latitude * DEG;
  const cosZenith = Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZenith))) / DEG;
}
