# PARSEC

A clean, lightweight new tab page that loads high-res space photography from NASA, ESA, and other observatories every time you open a tab. No tracking, no accounts, and no bloat.

This is a ground-up, open-source rewrite inspired by the original "Spatium" extension. 

---

## The Ground Rules

* **No tracking, ever.** No telemetry, no third-party scripts, no analytics.
* **No logins, no accounts.** Everything is saved locally in your browser. The one optional exception is the homelab station list, which can ride along on your browser's own sync — still never a server of ours.
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

## Ground Control (for homelabs)

If you run things at home, you know the problem: you remember that Proxmox is *somewhere* on port 8006, but not whether it answers to a hostname, an IP, or both. Ground Control puts all of that one keystroke away — and stays completely invisible until you add your first service, so the picture is still the picture.

* **Jump from the search field.** Start typing and your own services rank above the web search. Names, hostnames, IPs, sectors and tags all match — and so do **port numbers**, so typing `8123` lands on Home Assistant. `Ctrl`+`K` opens it from anywhere, `>` lists Parsec's own commands instead.
* **The full board.** `G` opens a Heimdall-style overlay over the wallpaper: your services grouped into sectors, with as much or as little detail as you want. Escape closes it.
* **Hostname *and* IP, together.** Every card can show the friendly name and the raw `192.168.1.50:8123` underneath, so the panel doubles as the list of addresses you keep forgetting. Click an IP to copy it; `Alt`+click opens a service through its IP when DNS is having a day.
* **Icons that survive being away.** Parsec can ask each service you added for its favicon, shrink it to 64 px and keep it locally. Only hosts you typed in yourself are ever contacted, it needs a permission you grant explicitly, and rendering always comes from the cache — so the board looks identical on hotel wifi.
* **Optional reachability dots.** Off by default. When nothing at all answers, Parsec says "you're probably not on your network" instead of turning every dot red.
* **Getting your stuff in.** Paste an address and press Enter — common ports fill in the label and sector for you. Or paste a whole list at once, or import a Heimdall or Homarr export.
* **Add the page you are on.** Set a service up, click the Parsec button in the toolbar, and it is saved — label and sector pre-filled from the page itself. This is how the list actually stays current instead of decaying. It reads the active tab only at the moment you click, and since the service is demonstrably up right then, that is also when its icon gets fetched.
* **Open a whole sector.** Hover a sector heading and *Open all* puts every service in it into background tabs. Unreasonably satisfying on a maintenance evening.
* **Sync, if you want it.** Optional, off by default: your station list rides along with the browser's own sync to every machine you are signed into — no Parsec account, no server of ours. Icons deliberately stay local, since each machine can fetch its own from the same network.

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
| `G` | Open Ground Control | `Ctrl`+`K` | Jump to one of your services |
| `Esc` | Close panels | | |

Inside Ground Control: type to filter, arrow keys to move, `Enter` to open, `Alt`+`Enter` to go via the IP, `Alt`+`1…9` to jump straight to a card.

---

## How to Install (Load Unpacked)

Because this isn't in the Chrome Web Store (I will NOT support Google in any way!), you can load it manually in under a minute:

1. Download or clone this repository to your machine.
2. Open `chrome://extensions` in any Chromium-based browser (Chrome, Brave, Edge, Vivaldi).
3. Toggle **Developer mode** (top-right corner).
4. Click **Load unpacked** (top-left) and select the `PARSEC/` folder from this repo.
5. Open a new tab.

*(To package it yourself for store upload, just zip the contents of the `PARSEC/` folder, ensuring `manifest.json` is at the root of the zip archive).*

---

## Privacy & Permissions

Here is exactly why the extension requests the permissions it does:

| Permission | Why |
| :--- | :--- |
| `storage` | To save your settings, favorite images, and history locally on your machine. |
| `favicon` | Grabs website shortcut icons from Chrome's local cache so we don't have to use a third-party tracking service. |
| `geolocation` *(optional)* | Only requested if you enable Sun/Golden Hour times. Your coordinates never leave your machine. |
| `activeTab` | Lets the toolbar button read the address of the tab you are on — only in the moment you click it, and only that one tab. Nothing is read in the background. |
| `topSites` *(optional)* | Only requested if you decide to enable the top-visited sites shortcut row. |
| Host permissions | Necessary to bypass CORS policies and fetch images directly from official space agency domains. |
| Host permissions *(optional)* | Only requested when you ask Ground Control to fetch icons for your own services. Parsec then contacts **only the hosts you typed in yourself** — never a third-party favicon service — caches what it finds locally, and renders from that cache from then on. You can revoke it at any time and keep the icons you already have. |

---

## Codebase Architecture

If you want to modify this or contribute, the codebase is written in vanilla JS with ES modules. There are no heavy frameworks, bundlers, or build steps—which makes it load instantly.

```
PARSEC/
├── manifest.json          MV3 manifest
├── background.js          Tiny service worker (first run only)
├── newtab.html            The main entry page
├── popup.html             Toolbar popup — adds the page you are on to Ground Control
├── assets/fonts/          Quicksand font files (bundled locally, no Google Font requests)
├── icons/
└── src/
    ├── css/styles.css
    ├── css/groundcontrol.css  Palette, overlay and homelab panel styles
    ├── css/popup.css         Toolbar popup styles
    └── js/
        ├── main.js            Orchestrator (handles image pooling, rotation, and hotkeys)
        ├── state.js           The single source of truth for settings, history, and favorites
        ├── providers/         Modules for fetching/parsing each agency's API feed
        ├── ui/                UI components (clock, search, palette, widgets, slide-out panels)
        ├── features/          Astro math (moon, sun, sidereal), starfield, homelab stations, sync
        └── util/              Local storage helpers, RSS parsers, and DOM tools
```

**Adding a new image source:**
Just create a new file in `src/js/providers/` that exports a `fetchList()` function returning normalized image objects, then register it in `src/js/providers/index.js`.

---

## Credits

This is a personal hobby project and is **not** affiliated with NASA, ESA, ESO, or the original creators of the Spatium extension.
