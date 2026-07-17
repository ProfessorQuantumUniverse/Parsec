import { el, clear } from "../util/dom.js";
import { moonPhaseInfo, nextMoonEvents, sunTimes, localSiderealTime, nextSeasonEvent } from "../features/astro.js";
import { onThisDay } from "../features/onthisday.js";
import { guessLocationFromTimeZone } from "../features/geo.js";

const fmtTime = (d) =>
  d instanceof Date && !isNaN(d)
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "—";

function relDays(target) {
  const ms = target - Date.now();
  const days = ms / 864e5;
  if (days < 1) return `in ${Math.max(1, Math.round(ms / 36e5))} h`;
  return `in ${Math.round(days)} d`;
}

function card(title, body) {
  return el("section", { class: "widget-card" }, [
    el("div", { class: "widget-title", text: title }),
    body,
  ]);
}

export function initWidgets(container) {
  let timer = 0;

  function render(settings) {
    const firstTime = !container.dataset.revealed;
    clear(container);
    const now = new Date();
    const loc = settings.location;

    if (settings.showMoon) {
      const m = moonPhaseInfo(now);
      const ev = nextMoonEvents(now);
      container.append(
        card("Moon", el("div", { class: "moon-body" }, [
          el("div", { class: "moon-emoji", text: m.emoji }),
          el("div", {}, [
            el("div", { class: "moon-name", text: m.name }),
            el("div", { class: "moon-sub", text: `${m.illumination}% illuminated` }),
            el("div", { class: "moon-sub dim", text: `Full moon ${relDays(ev.fullMoon)}` }),
          ]),
        ]))
      );
    }

    if (settings.showSun) {
      const place = loc && typeof loc.lat === "number" ? loc : guessLocationFromTimeZone();
      let body, heading = "Sun";
      if (place && typeof place.lat === "number") {
        const t = sunTimes(now, place.lat, place.lon);
        body = el("div", { class: "sun-grid" }, [
          el("span", { text: "☀ Rise" }), el("b", { text: fmtTime(t.sunrise) }),
          el("span", { text: "☾ Set" }), el("b", { text: fmtTime(t.sunset) }),
          el("span", { text: "✦ Golden" }), el("b", { text: fmtTime(t.goldenHour) }),
          el("span", { text: "☽ Dusk" }), el("b", { text: fmtTime(t.dusk) }),
        ]);
        heading = `Sun · ${place.label}${place.approx && !loc ? " ~" : ""}`;
      } else {
        body = el("div", { class: "widget-hint", text: "Set your location in settings to see sunrise, sunset & golden hour." });
      }
      container.append(card(heading, body));
    }

    if (settings.showOnThisDay) {
      const events = onThisDay(now);
      const body = events.length
        ? el("ul", { class: "otd-list" }, events.slice(0, 3).map((e) =>
            el("li", {}, [el("b", { text: `${e.year} — ` }), e.text])))
        : el("div", { class: "widget-hint", text: "No headline space milestone on record for today. The cosmos is quietly busy." });
      container.append(card("On this day in space", body));
    }

    if (settings.showNerdStats) {
      const lst = localSiderealTime(now, loc?.lon || 0);
      const season = nextSeasonEvent(now);
      container.append(
        card("Nerd stats", el("div", { class: "nerd-grid" }, [
          el("span", { text: "Sidereal time" }), el("b", { text: lst.text }),
          el("span", { text: "Julian day" }), el("b", { text: (now.valueOf() / 864e5 + 2440587.5).toFixed(3) }),
          el("span", { text: "Day of year" }), el("b", { text: String(Math.ceil((now - new Date(now.getFullYear(), 0, 0)) / 864e5)) }),
          el("span", { text: season.name }), el("b", { text: relDays(season.date) }),
        ]))
      );
    }

    if (firstTime) {
      [...container.children].forEach((c, i) => { c.style.animationDelay = `${i * 90}ms`; c.classList.add("card-in"); });
      container.dataset.revealed = "1";
    }
  }

  function start(settings) {
    render(settings);
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) render(settings); }, 30000);
    const any = settings.showMoon || settings.showSun || settings.showOnThisDay || settings.showNerdStats;
    container.style.display = any ? "" : "none";
  }

  return {
    update(settings) { start(settings); },
    destroy() { clearInterval(timer); },
  };
}
