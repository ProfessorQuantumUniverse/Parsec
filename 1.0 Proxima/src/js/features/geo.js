/* Location resolution WITHOUT the geolocation permission. */

import { cityForTimeZone, searchCities } from "../data/cities.js";

export function currentTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }
  catch { return ""; }
}

export function guessLocationFromTimeZone() {
  const tz = currentTimeZone();
  if (!tz) return null;
  const city = cityForTimeZone(tz);
  if (city) return { lat: city[2], lon: city[3], label: city[0], approx: true };
  const offsetMin = -new Date().getTimezoneOffset();
  const lon = Math.max(-180, Math.min(180, (offsetMin / 60) * 15));
  return { lat: 0, lon, label: tz.split("/").pop().replace(/_/g, " "), approx: true };
}

export { searchCities };
