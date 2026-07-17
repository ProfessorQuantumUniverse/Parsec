# PARSEC

A clean, lightweight new tab page that loads high-res space photography from NASA, ESA, and other observatories every time you open a tab. No tracking, no accounts, and no bloat.

This is a ground-up, open-source rewrite inspired by the original "Spatium" extension. 

---

## The Ground Rules

* **No tracking, ever.** No telemetry, no third-party scripts, no analytics.
* **No logins or cloud sync.** Everything is saved locally in your browser.
* **Direct connections.** The extension only talks directly to the public APIs of the space agencies you enable. No middleman servers.

---

## Image Sources

You can mix and match these in **Settings → Sources**. The extension automatically rotates through your enabled feeds so consecutive tabs keep things fresh.

| Source | What it actually is |
| :--- | :--- |
| **NASA APOD** | Astronomy Picture of the Day. Includes random archive days to keep it interesting. |
| **Hubble** | ESA’s Hubble *Picture of the Week*. |
| **James Webb** | ESA’s James Webb image releases (unbelievable detail). |
| **ESO** | European Southern Observatory *Picture of the Week* (mostly ground-based telescopes in Chile). |
| **NASA EPIC** | Full-disk photos of Earth taken by the DSCOVR satellite at Lagrange point L1. |
| **NASA Library** | Searches rotating deep-sky queries from NASA’s media library. |
| **NASA Image of the Day** | The classic, manually curated NASA daily feature feed. |

All feeds are free and don't require an API key. APOD uses a shared demo key out of the box; if you hit rate limits, you can generate your own free key at [api.nasa.gov](https://api.nasa.gov) and drop it into **Settings → Data**.

---

## What else is built-in?

I wanted a few handy astronomical tools on my screen, so I built them to run entirely offline:

* **Local moon calculator:** Computes the current moon phase, illumination percentage, and a countdown to the next full moon entirely on-device (zero network requests).
* **Sun & golden hour:** Calculates exact sunrise, sunset, dusk, and golden-hour times based on your location. (Coordinates stay strictly in your browser).
* **Astro stats:** Local sidereal time, Julian day, day of the year, and a countdown to the next solstice or equinox.
* **On this day in space:** A hand-curated mini-almanac of spaceflight and astronomy milestones.
* **Image details:** A slide-out panel with full captions, credits, and direct links to the original high-resolution source files.
* **Favorites & history:** "Heart" the images you love and quickly browse back through your recent tabs.
* **Twinkling starfield:** A gentle, battery-friendly star layer. It automatically pauses when the tab is hidden, so it won’t eat up your laptop's CPU.
* **Zen mode:** Tap `H` to instantly hide all UI elements and just enjoy the view.

---

## Customization

You can adjust almost everything in the settings panel:
* Accent colors and UI themes (Cosmos, Midnight, or clean Grayscale).
* Image fitting (stretch-to-fill/cover, or contain the whole image).
* Background dimming, blur, and vignette levels to keep your desktop icons or clock readable.
* Search bar engine and custom shortcuts.

---

## Keyboard Shortcuts

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `→` / `N` / `Space` | Next image | `I` | Image details |
| `←` / `P` | Previous image | `D` | Download HD photo |
| `R` | Shuffle random image | `S` or `,` | Open settings |
| `F` | Add to favorites | `/` | Focus search bar |
| `H` | Toggle Zen mode | `?` | Show shortcut list |
| `Esc` | Close panels | | |

---

## How to Install (Load Unpacked)

Because this isn't in the Chrome Web Store (I will NOT support Google in any way!), you can load it manually in under a minute:

1. Download or clone this repository to your machine.
2. Open `chrome://extensions` in any Chromium-based browser (Chrome, Brave, Edge, Vivaldi).
3. Toggle **Developer mode** (top-right corner).
4. Click **Load unpacked** (top-left) and select the `extension/` folder from this repo.
5. Open a new tab.

*(To package it yourself for store upload, just zip the contents of the `extension/` folder, ensuring `manifest.json` is at the root of the zip archive).*

---

## Privacy & Permissions

Here is exactly why the extension requests the permissions it does:

| Permission | Why |
| :--- | :--- |
| `storage` | To save your settings, favorite images, and history locally on your machine. |
| `favicon` | Grabs website shortcut icons from Chrome's local cache so we don't have to use a third-party tracking service. |
| `geolocation` *(optional)* | Only requested if you enable Sun/Golden Hour times. Your coordinates never leave your machine. |
| `topSites` *(optional)* | Only requested if you decide to enable the top-visited sites shortcut row. |
| Host permissions | Necessary to bypass CORS policies and fetch images directly from official space agency domains. |

---

## Codebase Architecture

If you want to modify this or contribute, the codebase is written in vanilla JS with ES modules. There are no heavy frameworks, bundlers, or build steps—which makes it load instantly.

```
extension/
├── manifest.json          MV3 manifest
├── background.js          Tiny service worker (handles open tabs + first run)
├── newtab.html            The main entry page
├── assets/fonts/          Quicksand font files (bundled locally, no Google Font requests)
├── icons/
└── src/
    ├── css/styles.css
    └── js/
        ├── main.js            Orchestrator (handles image pooling, rotation, and hotkeys)
        ├── state.js           The single source of truth for settings, history, and favorites
        ├── providers/         Modules for fetching/parsing each agency's API feed
        ├── ui/                UI components (clock, search, widgets, slide-out panels)
        ├── features/          Astro math (moon, sun, sidereal), starfield background
        └── util/              Local storage helpers, RSS parsers, and DOM tools
```

**Adding a new image source:**
Just create a new file in `src/js/providers/` that exports a `fetchList()` function returning normalized image objects, then register it in `src/js/providers/index.js`.

---

## Credits

This is a personal hobby project and is **not** affiliated with NASA, ESA, ESO, or the original creators of the Spatium extension.