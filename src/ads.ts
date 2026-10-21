/**
 * Google AdSense side rails for desktop. Phones get no ads here, so the game keeps its full screen.
 *
 * To switch on: paste your publisher id and the two ad-unit slot ids from AdSense below,
 * and put the matching line in public/ads.txt. Until then nothing loads.
 * Preview the layout anytime by adding ?adpreview to the URL (shows grey boxes, no Google code).
 */
export const AD_CLIENT = "";          // e.g. "ca-pub-1234567890123456"
const SLOT_LEFT = "";                 // AdSense ad unit id, e.g. "1234567890"
const SLOT_RIGHT = "";

const MIN_WIDTH = 1000;               // below this, the side gutters are too narrow for a rail
const MIN_HEIGHT = 640;               // rails are 600px tall

function size() {
  if (innerWidth < MIN_WIDTH || innerHeight < MIN_HEIGHT) return null;
  return innerWidth >= 1360 ? { w: 300, h: 600 } : { w: 160, h: 600 };
}

export function mountAds() {
  const preview = new URLSearchParams(location.search).has("adpreview");
  const live = !!AD_CLIENT && !!SLOT_LEFT && !!SLOT_RIGHT;
  if (!live && !preview) return;
  const s = size();
  if (!s) return;

  if (live) {
    const sc = document.createElement("script");
    sc.async = true;
    sc.crossOrigin = "anonymous";
    sc.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
    document.head.appendChild(sc);
  }

  for (const [side, slot] of [["left", SLOT_LEFT], ["right", SLOT_RIGHT]] as const) {
    const rail = document.createElement("aside");
    rail.className = `rail rail-${side}`;
    rail.style.setProperty("--rail-w", s.w + "px");
    rail.setAttribute("aria-label", "Advertisement");
    rail.innerHTML = live
      ? `<span class="rail-label">Advertisement</span><ins class="adsbygoogle" style="display:inline-block;width:${s.w}px;height:${s.h}px" data-ad-client="${AD_CLIENT}" data-ad-slot="${slot}"></ins>`
      : `<span class="rail-label">Advertisement</span><div class="rail-dummy" style="width:${s.w}px;height:${s.h}px">${s.w} × ${s.h}</div>`;
    document.body.appendChild(rail);
    if (live) ((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle ||= []).push({});
  }
}
