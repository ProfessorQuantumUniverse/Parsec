/* Greeting + clock. Ticks once a second only while the tab is visible. */

import { el, clear } from "../util/dom.js";

function greetingFor(hour) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function initClock(container) {
  const time = el("div", { class: "clock-time" });
  const date = el("div", { class: "clock-date" });
  const greet = el("div", { class: "greeting" });
  clear(container).append(greet, time, date);

  let timer = 0;

  function render(settings) {
    const now = new Date();
    if (settings.showGreeting) {
      const who = settings.name ? `, ${settings.name}` : "";
      greet.textContent = `${greetingFor(now.getHours())}${who}`;
      greet.style.display = "";
    } else {
      greet.style.display = "none";
    }

    if (settings.showClock) {
      const opts = { hour: "2-digit", minute: "2-digit", hour12: !settings.clock24h };
      if (settings.showSeconds) opts.second = "2-digit";
      let t = now.toLocaleTimeString(settings.clock24h ? "en-GB" : "en-US", opts);
      time.textContent = t;
      time.style.display = "";
    } else {
      time.style.display = "none";
    }

    if (settings.showDate) {
      date.textContent = now.toLocaleDateString(undefined, {
        weekday: "long", day: "numeric", month: "long",
      });
      date.style.display = "";
    } else {
      date.style.display = "none";
    }
  }

  function start(settings) {
    render(settings);
    clearInterval(timer);
    const tick = settings.showSeconds ? 1000 : 15000;
    timer = setInterval(() => {
      if (!document.hidden) render(settings);
    }, tick);
  }

  return {
    update(settings) { start(settings); },
    destroy() { clearInterval(timer); },
  };
}
