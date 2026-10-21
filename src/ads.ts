/**
 * Google AdSense placements.
 *
 *   Desktop (≥1000px): a portrait rail either side of the game (160×600, or 300×600 from 1360px).
 *   Phone (<1000px):   one 320×100 banner on the end-of-game summary, plus one 300×250 in the
 *                      past-issues sheet. Nothing ever appears while a question is being answered.
 *
 * To switch on: paste your publisher id and the four ad-unit ids from AdSense below, and put
 * the matching line in public/ads.txt. Until then nothing loads.
 * Consent: turn on AdSense → Privacy & messaging → European regulations message. Google's
 * certified banner then runs before any ad loads; no code needed here.
 * Preview the layout anytime with ?adpreview in the URL (grey boxes, no Google code).
 */
export const AD_CLIENT = "";          // e.g. "ca-pub-1234567890123456"
const SLOTS = {
  left: "",                           // AdSense ad-unit ids, e.g. "1234567890"
  right: "",
  summary: "",
  archive: "",
};

type Place = keyof typeof SLOTS;
const preview = new URLSearchParams(location.search).has("adpreview");
const live = () => !!AD_CLIENT && Object.values(SLOTS).every(Boolean);
const on = () => live() || preview;
const desktop = () => innerWidth >= 1000;

let scriptAdded = false;
function ensureScript() {
  if (!live() || scriptAdded) return;
  scriptAdded = true;
  const sc = document.createElement("script");
  sc.async = true;
  sc.crossOrigin = "anonymous";
  sc.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
  document.head.appendChild(sc);
}

function unit(place: Place, w: number, h: number) {
  const body = live()
    ? `<ins class="adsbygoogle" style="display:inline-block;width:${w}px;height:${h}px" data-ad-client="${AD_CLIENT}" data-ad-slot="${SLOTS[place]}"></ins>`
    : `<div class="ad-dummy" style="width:${w}px;height:${h}px">${w} × ${h}</div>`;
  return `<span class="ad-label">Advertisement</span>${body}`;
}

/** Fill any freshly rendered <ins> tags. Call after inserting ad HTML. */
export function activateAds(root: Element | Document = document) {
  if (!live()) return;
  ensureScript();
  root.querySelectorAll<HTMLElement>("ins.adsbygoogle:not([data-filled])").forEach((el) => {
    el.dataset.filled = "1";
    ((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle ||= []).push({});
  });
}

/** Desktop side rails. Mounted once at start-up. */
export function mountRails() {
  if (!on() || !desktop() || innerHeight < 640) return;
  const w = innerWidth >= 1360 ? 300 : 160;
  for (const side of ["left", "right"] as const) {
    const rail = document.createElement("aside");
    rail.className = `rail rail-${side}`;
    rail.setAttribute("aria-label", "Advertisement");
    rail.innerHTML = unit(side, w, 600);
    document.body.appendChild(rail);
  }
  activateAds();
}

/** Phone banner for the summary screen ("" on desktop, where the rails already run). */
export const summaryAd = () => (on() && !desktop() ? `<div class="ad ad-summary">${unit("summary", 320, 100)}</div>` : "");

/** Medium rectangle at the bottom of the past-issues sheet (the sheet scrolls, so it fits). */
export const archiveAd = () => (on() ? `<div class="ad ad-archive">${unit("archive", 300, 250)}</div>` : "");

/** Re-open Google's consent choices (the "Privacy settings" link). */
export function openConsent(): boolean {
  const w = window as unknown as { googlefc?: { callbackQueue: unknown[]; showRevocationMessage: () => void } };
  if (!w.googlefc) return false;
  w.googlefc.callbackQueue.push(w.googlefc.showRevocationMessage);
  return true;
}
