import { el, clear, icons } from "../util/dom.js";
import { BRAND } from "../brand.js";
import { ALL_SOURCES, getSettings, updateSettings } from "../state.js";
import { PROVIDER_INFO } from "../providers/index.js";
import { guessLocationFromTimeZone, searchCities } from "../features/geo.js";

export function runOnboarding(root) {
  return new Promise((resolve) => {
    const draft = {
      name: getSettings().name || "",
      sources: [...ALL_SOURCES],
      location: getSettings().location || null,
      nasaApiKey: getSettings().nasaApiKey || "",
    };
    let step = 0;

    const overlay = el("div", { class: "onb" }, [
      el("div", { class: "onb-aurora" }),
      el("canvas", { class: "onb-stars" }),
    ]);
    const stage = el("div", { class: "onb-stage" });
    const dots = el("div", { class: "onb-dots" });
    overlay.append(stage, dots);
    root.append(overlay);
    startStars(overlay.querySelector(".onb-stars"));
    requestAnimationFrame(() => overlay.classList.add("show"));

    const STEPS = [stepWelcome, stepName, stepSources, stepLocation, stepApiKey, stepFoss];

    function renderDots() {
      clear(dots);
      STEPS.forEach((_, i) =>
        dots.append(el("span", { class: "onb-dot" + (i === step ? " on" : i < step ? " done" : "") })));
    }

    function transition(node) {
      const old = stage.firstElementChild;
      if (old) { old.classList.add("leave"); setTimeout(() => old.remove(), 420); }
      node.classList.add("onb-panel");
      stage.append(node);
      requestAnimationFrame(() => node.classList.add("enter"));
      renderDots();
    }

    function go(to) {
      step = Math.max(0, Math.min(STEPS.length - 1, to));
      transition(STEPS[step]());
    }

    function finish() {
      overlay.classList.add("done");
      updateSettings({
        onboarded: true,
        name: draft.name.trim().slice(0, 40),
        sources: draft.sources.length ? draft.sources : [...ALL_SOURCES],
        location: draft.location,
        nasaApiKey: draft.nasaApiKey.trim(),
        showSun: draft.location ? true : getSettings().showSun,
      }).then(() => {
        setTimeout(() => { overlay.remove(); resolve(); }, 700);
      });
    }

    /* ---------- reusable bits ---------- */
    const navBtn = (label, onClick, primary = true) =>
      el("button", { class: "onb-btn" + (primary ? " primary" : " ghost"), text: label, onclick: onClick });

    const footer = (nextLabel, onNext, opts = {}) =>
      el("div", { class: "onb-footer" }, [
        step > 0 && !opts.hideBack ? navBtn("Back", () => go(step - 1), false) : el("span"),
        el("div", { class: "onb-footer-right" }, [
          opts.skip ? navBtn(opts.skipLabel || "Skip", opts.skip, false) : null,
          navBtn(nextLabel, onNext),
        ]),
      ]);

    /* ---------- steps ---------- */

    function stepWelcome() {
      return el("div", {}, [
        el("div", { class: "onb-badge", text: "FREE · OPEN SOURCE · PRIVATE" }),
        el("h1", { class: "onb-brand", html: `${BRAND.name}<span class="onb-brand-dot">.</span>` }),
        el("p", { class: "onb-tagline", text: BRAND.blurb }),
        el("p", { class: "onb-lead", text:
          "Every new tab becomes a window on the universe — today's images from NASA, Hubble, James Webb and the great observatories of Earth." }),
        el("div", { class: "onb-footer center" }, [navBtn("Begin the journey  →", () => go(1))]),
      ]);
    }

    function stepName() {
      const input = el("input", { class: "onb-input", type: "text", placeholder: "Your name (optional)",
        value: draft.name, maxlength: 40 });
      input.addEventListener("input", () => (draft.name = input.value));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(2); });
      setTimeout(() => input.focus(), 500);
      return el("div", {}, [
        el("div", { class: "onb-step-num", text: "01" }),
        el("h2", { class: "onb-h2", text: "What should the cosmos call you?" }),
        el("p", { class: "onb-sub", text: "Used only for a friendly greeting. Never sent anywhere." }),
        input,
        footer("Continue", () => go(2), { skip: () => go(2), skipLabel: "Skip" }),
      ]);
    }

    function stepSources() {
      const grid = el("div", { class: "onb-sources" });
      for (const p of PROVIDER_INFO) {
        const on = () => draft.sources.includes(p.key);
        const chip = el("button", { class: "onb-chip" + (on() ? " on" : ""), type: "button" }, [
          el("span", { class: "onb-chip-check", html: icons.next }),
          el("div", {}, [
            el("div", { class: "onb-chip-name", text: p.label }),
            el("div", { class: "onb-chip-blurb", text: p.blurb }),
          ]),
        ]);
        chip.addEventListener("click", () => {
          const s = new Set(draft.sources);
          on() ? s.delete(p.key) : s.add(p.key);
          if (s.size === 0) s.add(p.key);
          draft.sources = [...s];
          chip.classList.toggle("on", draft.sources.includes(p.key));
        });
        grid.append(chip);
      }
      return el("div", {}, [
        el("div", { class: "onb-step-num", text: "02" }),
        el("h2", { class: "onb-h2", text: "Choose your telescopes" }),
        el("p", { class: "onb-sub", text: "Mix as many as you like — they'll take turns on your tabs. You can change this anytime." }),
        grid,
        footer("Continue", () => go(3)),
      ]);
    }

    function stepLocation() {
      const guess = guessLocationFromTimeZone();
      const status = el("div", { class: "onb-loc-status" });
      const setLoc = (loc) => {
        draft.location = loc;
        status.innerHTML = loc
          ? `<b>${loc.label}</b> · ${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}° — stored only on this device`
          : "";
      };
      if (draft.location) setLoc(draft.location);

      const tzBtn = navBtn(
        guess ? `Use my time zone — ${guess.label}` : "Use my time zone",
        () => setLoc(guess), false
      );

      const searchInput = el("input", { class: "onb-input", type: "text", placeholder: "…or search for a city" });
      const results = el("div", { class: "onb-city-results" });
      searchInput.addEventListener("input", () => {
        clear(results);
        for (const c of searchCities(searchInput.value)) {
          results.append(el("button", { class: "onb-city", type: "button",
            text: `${c.name}, ${c.cc}`, onclick: () => { setLoc(c); clear(results); searchInput.value = c.name; } }));
        }
      });

      return el("div", {}, [
        el("div", { class: "onb-step-num", text: "03" }),
        el("h2", { class: "onb-h2", text: "Where are you watching from?" }),
        el("p", { class: "onb-sub", html:
          "Powers sunrise, sunset, golden hour & sidereal time. <b>No GPS, no permission, no network</b> — it never leaves your browser." }),
        el("div", { class: "onb-loc-actions" }, [tzBtn]),
        searchInput,
        results,
        status,
        footer("Continue", () => go(4), { skip: () => go(4), skipLabel: "Skip" }),
      ]);
    }

    function stepApiKey() {
      const input = el("input", { class: "onb-input", type: "text", placeholder: "NASA API key (optional)",
        value: draft.nasaApiKey, spellcheck: false });
      input.addEventListener("input", () => (draft.nasaApiKey = input.value.trim()));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(5); });
      return el("div", {}, [
        el("div", { class: "onb-step-num", text: "04" }),
        el("h2", { class: "onb-h2", text: "Power up NASA APOD" }),
        el("p", { class: "onb-sub", html:
          "The Astronomy Picture of the Day works out of the box on a shared demo key. For higher rate limits, paste a <b>free</b> personal key from " +
          "<a href=\"https://api.nasa.gov\" target=\"_blank\" rel=\"noopener\">api.nasa.gov</a> — it takes about 30 seconds. Completely optional." }),
        input,
        footer("Continue", () => go(5), { skip: () => go(5), skipLabel: "Skip" }),
      ]);
    }

    function stepFoss() {
      const points = [
        ["No tracking", "Zero analytics, telemetry or fingerprinting. Ever."],
        ["No accounts", "Nothing to sign up for. It just works."],
        ["No ads, no upsells", "No \"premium\" tier holding features hostage."],
        ["100% open source", "MIT-licensed. Read every line, fork it, make it yours."],
      ];
      return el("div", {}, [
        el("div", { class: "onb-step-num", text: "05" }),
        el("h2", { class: "onb-h2", text: "Free & open, forever" }),
        el("p", { class: "onb-sub", text:
          "Your new tab is opened thousands of times a year. Software that intimate should answer to you — not to advertisers or a subscription. That's why " + BRAND.name + " is free and open source." }),
        el("ul", { class: "onb-foss" }, points.map(([t, d]) =>
          el("li", {}, [el("span", { class: "onb-foss-ic", html: icons.heart }),
            el("div", {}, [el("b", { text: t }), el("div", { class: "onb-foss-d", text: d })])]))),
        el("p", { class: "onb-foss-cta", html:
          `Love FOSS? <a href="${BRAND.github}" target="_blank" rel="noopener">Star the source</a>, share it, or contribute a new image source.` }),
        el("div", { class: "onb-footer center" }, [navBtn("Enter the cosmos  ✦", finish)]),
      ]);
    }

    go(0);
  });
}

/* Lightweight local starfield for the intro backdrop. */
function startStars(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let stars = [];
  function size() {
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.min(180, Math.floor(innerWidth * innerHeight / 11000)) }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      r: Math.random() * 1.2 + 0.2, a: Math.random(), tw: Math.random() * 0.02 + 0.005, d: Math.random() < 0.5 ? 1 : -1,
    }));
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf;
  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const s of stars) {
      if (!reduce) { s.a += s.tw * s.d; if (s.a > 1 || s.a < 0.1) s.d *= -1; }
      ctx.globalAlpha = Math.max(0, Math.min(1, s.a));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fillStyle = "#dfeaff"; ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!reduce) raf = requestAnimationFrame(draw);
  }
  size();
  addEventListener("resize", size, { passive: true });
  draw();
  // stop when the canvas leaves the DOM
  const obs = new MutationObserver(() => { if (!canvas.isConnected) { cancelAnimationFrame(raf); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}
