/* Bottom info bar (source · title · credit) + control cluster + a centered
 * detail modal with a hero preview, full caption and source-specific facts. */

import { el, clear, icons } from "../util/dom.js";
import { BRAND } from "../brand.js";

export function initInfo({ bar, controls, overlayRoot, handlers }) {
  let current = null;
  let fav = false;

  // ---- control cluster ----
  const btn = (name, title, key) =>
    el("button", { class: "ctl-btn", title: `${title}${key ? ` (${key})` : ""}`, html: icons[name] });

  const favBtn = btn("heart", "Favorite", "F");
  const buttons = {
    prev: btn("prev", "Previous", "←"),
    next: btn("next", "Next", "→"),
    shuffle: btn("shuffle", "Shuffle", "R"),
    fav: favBtn,
    download: btn("download", "Download HD", "D"),
    info: btn("info", "Details", "I"),
    settings: btn("gear", "Settings", "S"),
  };
  buttons.prev.addEventListener("click", () => handlers.onPrev());
  buttons.next.addEventListener("click", () => handlers.onNext());
  buttons.shuffle.addEventListener("click", () => handlers.onShuffle());
  buttons.fav.addEventListener("click", () => handlers.onToggleFav());
  buttons.download.addEventListener("click", () => handlers.onDownload());
  buttons.info.addEventListener("click", () => toggleDetail());
  buttons.settings.addEventListener("click", () => handlers.onSettings());
  clear(controls).append(...Object.values(buttons));

  // ---- info bar ----
  const chip = el("span", { class: "src-chip" });
  const title = el("h1", { class: "img-title" });
  const credit = el("div", { class: "img-credit" });
  const readMore = el("button", { class: "readmore", onclick: () => toggleDetail(),
    html: `${icons.info}<span>Details</span>` });
  clear(bar).append(chip, title, el("div", { class: "img-meta" }, [credit, readMore]));

  // ---- detail modal ----
  const card = el("div", { class: "detail-card" });
  const modal = el("div", { class: "detail-modal", hidden: true }, [card]);
  modal.addEventListener("click", (e) => { if (e.target === modal) toggleDetail(false); });
  overlayRoot.append(modal);

  function toggleDetail(force) {
    const show = force ?? modal.hasAttribute("hidden");
    if (show && current) renderDetail();
    if (show) { modal.removeAttribute("hidden"); requestAnimationFrame(() => modal.classList.add("open")); }
    else { modal.classList.remove("open"); setTimeout(() => modal.setAttribute("hidden", ""), 260); }
  }

  function renderDetail() {
    const i = current;
    const facts = [];
    if (i.date) facts.push(["Date", new Date(i.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })]);
    facts.push(["Source", i.sourceLabel]);
    if (i.credit) facts.push(["Credit", i.credit]);
    if (i.meta?.lat) facts.push(["Sub-solar point", `${i.meta.lat}°, ${i.meta.lon}°`]);
    if (i.meta?.keywords?.length) facts.push(["Keywords", i.meta.keywords.slice(0, 6).join(", ")]);

    clear(card).append(
      el("div", { class: "detail-hero", style: { backgroundImage: `url("${i.imageUrl}")` } }, [
        el("button", { class: "detail-close", html: icons.close, title: "Close (I / Esc)", onclick: () => toggleDetail(false) }),
        el("span", { class: "src-chip on-hero", text: i.sourceLabel }),
      ]),
      el("div", { class: "detail-body" }, [
        el("h2", { class: "detail-title", text: i.title }),
        el("p", { class: "detail-desc", text: i.description || "No description was provided by the source for this image." }),
        el("dl", { class: "detail-facts" }, facts.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })])),
        el("div", { class: "detail-actions" }, [
          i.pageUrl && el("a", { class: "pill-link", href: i.pageUrl, target: "_blank", rel: "noopener noreferrer",
            html: `${icons.external}<span>Open source page</span>` }),
          el("a", { class: "pill-link", href: i.hdUrl, target: "_blank", rel: "noopener noreferrer",
            html: `${icons.eye}<span>Full resolution</span>` }),
          el("button", { class: "pill-link", onclick: () => handlers.onDownload(),
            html: `${icons.download}<span>Download</span>` }),
        ]),
      ])
    );
  }

  function setFav(state) {
    fav = state;
    favBtn.innerHTML = state ? icons.heartFilled : icons.heart;
    favBtn.classList.toggle("active", state);
  }

  return {
    setImage(image, isFav) {
      current = image;
      chip.textContent = image.sourceLabel;
      title.textContent = image.title;
      credit.textContent = image.credit ? `© ${image.credit}` : "";
      setFav(!!isFav);
      // re-trigger the entrance animation on the info bar
      bar.classList.remove("reveal"); void bar.offsetWidth; bar.classList.add("reveal");
      if (!modal.hasAttribute("hidden")) renderDetail();
    },
    setFav,
    toggleDetail,
    isDetailOpen: () => !modal.hasAttribute("hidden"),
    update() { bar.style.display = ""; },
  };
}
