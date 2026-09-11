/* The toolbar popup: add the page you are looking at to Ground Control.
 *
 * This is how the list actually stays current — you set a service up, you are
 * already looking at it, one click and it is in. It reads nothing but the
 * active tab, and only at the moment you click the icon (activeTab).
 */

import { el, clear } from "./util/dom.js";
import { BRAND } from "./brand.js";
import { loadSettings, getSettings } from "./state.js";
import {
  loadStations, getStations, addStation, parseTarget, suggestLabel, suggestGroup,
  sectorNames, isIpLiteral, parts,
} from "./features/stations.js";
import { hasIconPermission, refreshIcon, primeIconCache } from "./features/favicons.js";

const app = document.getElementById("app");

function activeTab() {
  return new Promise((resolve) =>
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null))
  );
}

function openTab(url) {
  chrome.tabs.create({ url, active: true });
  window.close();
}

/** "Portainer | Dashboard" → "Portainer". Page titles are noisy; take the
 *  most specific-looking piece and let the user correct it in one field. */
function cleanTitle(title) {
  const raw = String(title || "").trim();
  if (!raw) return "";
  const first = raw.split(/\s+[|·—–-]\s+/)[0].trim();
  const pick = first.length >= 3 ? first : raw;
  return pick.slice(0, 40);
}

function field(label, input) {
  return el("label", { class: "pop-field" }, [
    el("span", { class: "pop-label", text: label }),
    input,
  ]);
}

function footer() {
  return el("div", { class: "pop-foot" }, [
    el("button", { class: "pop-link", type: "button", text: "Ground Control",
      onclick: () => openTab(chrome.runtime.getURL("newtab.html#ground")) }),
    el("button", { class: "pop-link", type: "button", text: "New tab",
      onclick: () => openTab(chrome.runtime.getURL("newtab.html")) }),
  ]);
}

function header() {
  return el("div", { class: "pop-head" }, [
    el("div", { class: "pop-title", text: "Add to Ground Control" }),
    el("div", { class: "pop-brand", text: BRAND.name }),
  ]);
}

function pageCard(tab, target) {
  const fav = tab.favIconUrl && /^https?:/i.test(tab.favIconUrl)
    ? el("span", { class: "pop-fav", style: { backgroundImage: `url("${tab.favIconUrl}")` } })
    : el("span", { class: "pop-fav mono", style: { "--mono": "#ff5c00" }, text: (cleanTitle(tab.title) || "?").slice(0, 1).toUpperCase() });
  return el("div", { class: "pop-page" }, [
    fav,
    el("div", { class: "pop-page-text" }, [
      el("div", { class: "pop-page-title", text: cleanTitle(tab.title) || "This page" }),
      el("div", { class: "pop-page-url", text: target ? target.url : tab.url || "" }),
    ]),
  ]);
}

function notAddable(tab, reason) {
  clear(app).append(
    header(),
    el("p", { class: "pop-note warn", text: reason }),
    el("p", { class: "pop-note", text:
      "Open the service itself — anything on http or https works, including a bare IP and port." }),
    footer(),
  );
}

function alreadyThere(tab, existing) {
  clear(app).append(
    header(),
    el("div", { class: "pop-done" }, [
      el("span", { class: "pop-done-dot" }),
      el("span", { text: `Already saved as “${existing.label}”` }),
    ]),
    el("p", { class: "pop-note", text: `In sector ${existing.group}.` }),
    el("button", { class: "pop-btn", type: "button", text: "Edit in Ground Control",
      onclick: () => openTab(chrome.runtime.getURL("newtab.html#stations")) }),
    footer(),
  );
}

function renderForm(tab, target) {
  let origin = "";
  try { origin = new URL(target.url).origin; } catch { /* parseTarget already vetted it */ }
  const existingHost = origin ? getStations().find((s) => parts(s).origin === origin) : null;

  const label = el("input", {
    class: "pop-input", type: "text", spellcheck: false, maxlength: 60,
    value: cleanTitle(tab.title) || suggestLabel(target.host, target.port),
  });
  const sector = el("input", {
    class: "pop-input", type: "text", spellcheck: false, maxlength: 40,
    list: "pop-sectors",
    value: existingHost?.group || suggestGroup(target.port),
  });
  const ip = el("input", {
    class: "pop-input", type: "text", spellcheck: false, maxlength: 60,
    placeholder: "optional",
    value: isIpLiteral(target.host) ? target.host : (existingHost?.ip || ""),
  });

  const addBtn = el("button", { class: "pop-btn primary", type: "button", text: "Add station" });

  const submit = async () => {
    addBtn.disabled = true;
    addBtn.textContent = "Adding…";
    const st = await addStation({
      url: target.url,
      label: label.value.trim(),
      group: sector.value.trim(),
      ip: ip.value.trim(),
    });

    // We know the host is up — it is on screen right now, so this is the best
    // possible moment to grab its icon. Not worth making anyone watch, though:
    // the station is saved either way, and the overlay backfills what we miss.
    hasIconPermission().then(async (allowed) => {
      if (!allowed) return;
      await primeIconCache();
      await refreshIcon(st, { force: true });
    });

    clear(app).append(
      header(),
      el("div", { class: "pop-done" }, [
        el("span", { class: "pop-done-dot" }),
        el("span", { text: `Added “${st.label}”` }),
      ]),
      el("p", { class: "pop-note", text:
        `Type “${st.label.split(/\s+/)[0].toLowerCase()}” or ${parts(st).explicitPort || "its name"} in a new tab to jump straight back here.` }),
      el("button", { class: "pop-btn", type: "button", text: "Open Ground Control",
        onclick: () => openTab(chrome.runtime.getURL("newtab.html#ground")) }),
      footer(),
    );
  };

  addBtn.addEventListener("click", submit);
  const onEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } };
  [label, sector, ip].forEach((i) => i.addEventListener("keydown", onEnter));

  clear(app).append(...[
    header(),
    pageCard(tab, target),
    field("Label", label),
    el("div", { class: "pop-row" }, [field("Sector", sector), field("IP address", ip)]),
    el("datalist", { id: "pop-sectors" }, sectorNames().map((n) => el("option", { value: n }))),
    addBtn,
    existingHost
      ? el("p", { class: "pop-note", text: `You already have ${existingHost.label} on this host — this will be added alongside it.` })
      : null,
    footer(),
  ].filter(Boolean));

  requestAnimationFrame(() => { label.focus(); label.select(); });
}

async function boot() {
  const [settings, , tab] = await Promise.all([loadSettings(), loadStations(), activeTab()]);
  document.documentElement.dataset.theme = settings.theme || "cosmos";
  document.documentElement.style.setProperty("--accent", settings.accent);

  if (!tab || !tab.url) {
    notAddable(tab, "Parsec can't see this tab.");
    return;
  }
  if (!/^https?:\/\//i.test(tab.url)) {
    notAddable(tab, "This is a browser page, not a service you can save.");
    return;
  }
  if (getSettings().gcEnabled === false) {
    clear(app).append(
      header(),
      el("p", { class: "pop-note warn", text: "Ground Control is switched off in Parsec's settings." }),
      footer(),
    );
    return;
  }

  // A fragment is a view inside an app, not the service itself — saving
  // "#!/2/docker/dashboard" would pin you to whatever screen you happened
  // to be on. The path stays, because /admin is genuinely part of Pi-hole.
  const target = parseTarget(tab.url.split("#")[0]);
  if (!target) {
    notAddable(tab, "That address couldn't be parsed.");
    return;
  }

  const exact = getStations().find((s) => s.url === target.url);
  if (exact) { alreadyThere(tab, exact); return; }

  renderForm(tab, target);
}

boot();
