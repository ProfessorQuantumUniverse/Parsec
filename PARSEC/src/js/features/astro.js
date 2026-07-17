/* Local astronomy, moon phase, sun/twilight times, sidereal time, next lunar
 * events. All computed on-device (no network, no location leaves the machine).
 * Sun/moon math adapted from SunCalc by Vladimir Agafonkin (public domain, BSD).
 */

const rad = Math.PI / 180;
const dayMs = 864e5;
const J1970 = 2440588;
const J2000 = 2451545;
const e = rad * 23.4397; // obliquity of the Earth

const toJulian = (d) => d.valueOf() / dayMs - 0.5 + J1970;
const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs);
const toDays = (d) => toJulian(d) - J2000;

const rightAscension = (l, b) =>
  Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const declination = (l, b) =>
  Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));

const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
function eclipticLongitude(M) {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  return M + C + rad * 102.9372 + Math.PI;
}
function sunCoords(d) {
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}
function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d);
  const M = rad * (134.963 + 13.064993 * d);
  const F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M);
  const b = rad * 5.128 * Math.sin(F);
  const dt = 385001 - 20905 * Math.cos(M);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
}

/* ---------- Moon illumination + phase name ---------- */

export function moonIllumination(date = new Date()) {
  const d = toDays(date);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sdist = 149598000;
  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)
  );
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
  );
  const phase = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI;
  return { fraction: (1 + Math.cos(inc)) / 2, phase };
}

const PHASE_NAMES = [
  [0.02, "New Moon", "🌑"],
  [0.24, "Waxing Crescent", "🌒"],
  [0.27, "First Quarter", "🌓"],
  [0.48, "Waxing Gibbous", "🌔"],
  [0.52, "Full Moon", "🌕"],
  [0.73, "Waning Gibbous", "🌖"],
  [0.77, "Last Quarter", "🌗"],
  [0.98, "Waning Crescent", "🌘"],
  [1.01, "New Moon", "🌑"],
];

export function moonPhaseInfo(date = new Date()) {
  const { phase, fraction } = moonIllumination(date);
  const found = PHASE_NAMES.find(([lim]) => phase <= lim) || PHASE_NAMES.at(-1);
  return { phase, illumination: Math.round(fraction * 100), name: found[1], emoji: found[2] };
}

/* ---------- Next new / full moon ---------- */

const SYNODIC = 29.530588853;
const REF_NEW_MOON = 2451550.1; // JD of a known new moon (2000-01-06 18:14 UTC)

function nextPhaseJD(fromDate, offset) {
  const jd = toJulian(fromDate);
  const cycles = Math.ceil((jd - REF_NEW_MOON - offset * SYNODIC) / SYNODIC);
  return REF_NEW_MOON + (cycles + offset) * SYNODIC;
}

export function nextMoonEvents(date = new Date()) {
  return {
    newMoon: fromJulian(nextPhaseJD(date, 0)),
    firstQuarter: fromJulian(nextPhaseJD(date, 0.25)),
    fullMoon: fromJulian(nextPhaseJD(date, 0.5)),
    lastQuarter: fromJulian(nextPhaseJD(date, 0.75)),
  };
}

/* ---------- Sun / twilight times ---------- */

const J0 = 0.0009;
const julianCycle = (d, lw) => Math.round(d - J0 - lw / (2 * Math.PI));
const approxTransit = (Ht, lw, n) => J0 + (Ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const hourAngle = (h, phi, d) =>
  Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));

function getSetJ(h, lw, phi, dec, n, M, L) {
  const w = hourAngle(h, phi, dec);
  return solarTransitJ(approxTransit(w, lw, n), M, L);
}

const TIMES = [
  [-0.833, "sunrise", "sunset"],
  [-6, "dawn", "dusk"],
  [-12, "nauticalDawn", "nauticalDusk"],
  [-18, "nightEnd", "night"],
  [6, "goldenHourEnd", "goldenHour"],
];

export function sunTimes(date, lat, lng) {
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L, 0);
  const Jnoon = solarTransitJ(ds, M, L);

  const out = { solarNoon: fromJulian(Jnoon), nadir: fromJulian(Jnoon - 0.5) };
  for (const [h, riseName, setName] of TIMES) {
    const Jset = getSetJ(h * rad, lw, phi, dec, n, M, L);
    const Jrise = Jnoon - (Jset - Jnoon);
    out[riseName] = Number.isNaN(Jset) ? null : fromJulian(Jrise);
    out[setName] = Number.isNaN(Jset) ? null : fromJulian(Jset);
  }
  return out;
}

/* ---------- Local sidereal time (the astronomer's clock) ---------- */

export function localSiderealTime(date = new Date(), lng = 0) {
  const d = toDays(date);
  const gmst = 280.16 + 360.9856235 * d; // degrees
  let lst = (gmst + lng) % 360;
  if (lst < 0) lst += 360;
  const hours = lst / 15;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.floor(((hours - h) * 60 - m) * 60);
  return { hours, text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

/* ---------- Seasonal markers (approx. equinox/solstice) ---------- */

export function nextSeasonEvent(date = new Date()) {
  // Mean instants (UTC) good to ~1 day — enough for a countdown widget.
  const y = date.getUTCFullYear();
  const build = (yr) => [
    { name: "March Equinox", d: Date.UTC(yr, 2, 20, 9) },
    { name: "June Solstice", d: Date.UTC(yr, 5, 21, 3) },
    { name: "September Equinox", d: Date.UTC(yr, 8, 22, 19) },
    { name: "December Solstice", d: Date.UTC(yr, 11, 21, 16) },
  ];
  const all = [...build(y), ...build(y + 1)];
  const now = date.getTime();
  const next = all.find((ev) => ev.d > now);
  return { name: next.name, date: new Date(next.d) };
}
