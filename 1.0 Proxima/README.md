# Spatium

A gorgeous new‑tab page that turns every browser tab into a window on the universe.
Daily imagery from NASA, Hubble, James Webb, ESO and more.

> **No tracking. No accounts. No subscriptions. FOSS** Everything runs
> locally in your browser. The only network requests made are to the public
> space‑agency APIs you enable, to fetch pictures.

This is a ground‑up, fully open costum rewrite inspired by the original "Spatium" extension. 

---

## Image sources

Pick any combination in **Settings → Sources**. Enabled sources are interleaved
so consecutive tabs come from different observatories.

| Source | What it is |
| --- | --- |
| **NASA APOD** | Astronomy Picture of the Day (+ random archive days) |
| **Hubble** | ESA/Hubble *Picture of the Week* |
| **James Webb** | ESA/Webb image releases |
| **ESO** | European Southern Observatory *Picture of the Week* (VLT, Chile) |
| **NASA EPIC** | Full‑disk Earth from the DSCOVR spacecraft at Lagrange point L1 |
| **NASA Library** | NASA Image & Video Library, rotating deep‑sky search queries |
| **NASA Image of the Day** | The classic curated daily feed |

All feeds are public and key‑free. APOD works on a shared demo key; drop in your
own free key (from [api.nasa.gov](https://api.nasa.gov)) in **Settings → Data**
to lift the rate limit.

## Nerd features

- **Live moon widget** — phase name, % illumination and a countdown to the next
  full moon, all computed on‑device.
- **Sun & golden hour** — sunrise, sunset, dusk and golden‑hour times from your
  location (which never leaves the browser).
- **Nerd stats** — local **sidereal time**, Julian day, day‑of‑year and a
  countdown to the next solstice/equinox.
- **On this day in space** — a hand‑curated almanac of astronomical milestones.
- **Image details panel** — full captions, credits, source links, and
  source‑specific facts (e.g. EPIC's sub‑solar point).
- **Favorites & history** — heart the images you love and revisit recent ones.
- **One‑tap HD download** and links to the original full‑resolution files.
- **Twinkling starfield** — a battery‑friendly animated star layer that pauses
  when the tab is hidden.
- **Full keyboard control** and a **Zen mode** that hides all UI.
- **Export / import** your whole configuration as a JSON file.

## Customisation

Accent colour, UI tint (Cosmos / Midnight / Mono), image fit (cover / contain),
background dim & blur, vignette, clock format, search engine, and a toggle for
every widget — all in the settings drawer.

## Keyboard shortcuts

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `→` `N` `Space` | Next image | `I` | Image details |
| `←` `P` | Previous image | `D` | Download HD |
| `R` | Shuffle | `S` `,` | Settings |
| `F` | Favorite | `/` | Focus search |
| `H` | Zen mode | `?` | Shortcuts help |
| `Esc` | Close / exit | | |

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome, Edge, Brave or any Chromium browser.
2. Enable **Developer mode** (top‑right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open a new tab. 🌌

To package for the Web Store: zip the **contents** of `extension/` (so
`manifest.json` is at the archive root).

## Privacy & permissions

| Permission | Why |
| --- | --- |
| `storage` | Save your settings, favorites and last image (locally). |
| `favicon` | Render shortcut icons from Chrome's local cache — no external favicon service. |
| `geolocation` *(optional)* | Only if you enable sun times, and only requested on demand. Coordinates stay on‑device. |
| `topSites` *(optional)* | Only if you enable the shortcuts row. |
| host permissions | Fetch images from the space‑agency domains listed in `manifest.json`. |

## Architecture

```
extension/
├── manifest.json          MV3 manifest
├── background.js          tiny service worker (open tab + first‑run flag)
├── newtab.html            new‑tab shell
├── assets/fonts/          Quicksand, bundled (no Google Fonts request)
├── icons/
└── src/
    ├── css/styles.css
    └── js/
        ├── main.js            orchestrator: pool, rotation, preloading, shortcuts
        ├── state.js           settings + favorites + history (single source of truth)
        ├── providers/         one module per image source + registry/pool builder
        ├── ui/                clock, search, widgets, info panel, top sites, settings
        ├── features/          astro (moon/sun/sidereal), on‑this‑day, starfield
        └── util/              storage cache, RSS parser, DOM helpers
```

Adding a source is one small module exporting `fetchList()` that returns
normalized image objects, register it in `src/js/providers/index.js`.

## Licence & credits

Imagery belongs to its creators and is subject to each agency's terms:
NASA (public domain, with credit), ESA/Hubble & ESA/Webb & ESO (CC BY 4.0).

**Not** affiliated with NASA, ESA, ESO, or the original Spatium.
