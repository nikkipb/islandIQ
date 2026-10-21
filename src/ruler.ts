import { ZERO_AT } from "../shared/scoring";
import type { Kind } from "../shared/types";

const W = 500, PAD = 18;
const base = `<line x1="${PAD}" x2="${W - PAD}" y1="25" y2="25" stroke="var(--rule)" stroke-width="6" stroke-linecap="round"/>`;

/** x-position (viewBox units) of a value on the live ruler. */
export function liveX(kind: Kind, v: number) {
  if (kind === "pp") return PAD + Math.min(100, Math.max(0, v)) / 100 * (W - 2 * PAD);
  return PAD + Math.min(10, Math.max(0, Math.log10(Math.max(v, 1)))) / 10 * (W - 2 * PAD);
}

/** Generic scale while typing. Never centred on the answer, so it can't leak it.
 *  The marker (#mk) is moved with a CSS transform so it glides as you type. */
export function liveRuler(kind: Kind) {
  const ticks = kind === "pp"
    ? [0, 25, 50, 75, 100].map((v) => `<line x1="${liveX(kind, v)}" x2="${liveX(kind, v)}" y1="20" y2="30" stroke="var(--ink-2)"/><text x="${liveX(kind, v)}" y="46" text-anchor="middle">${v}%</text>`).join("")
    : ["1", "10", "100", "1k", "10k", "100k", "1m", "10m", "100m", "1bn", "10bn"].map((l, i) => `<line x1="${liveX(kind, 10 ** i)}" x2="${liveX(kind, 10 ** i)}" y1="${i % 3 === 0 ? 16 : 20}" y2="30" stroke="var(--ink-2)"/><text x="${liveX(kind, 10 ** i)}" y="46" text-anchor="middle">${l}</text>`).join("");
  return `<svg class="ruler" viewBox="0 0 ${W} 52" aria-hidden="true">${base}${ticks}
    <g id="mk" class="mk" style="opacity:0;transform:translateX(${PAD}px)"><circle cx="0" cy="25" r="7.5" fill="var(--ink)" stroke="var(--paper)" stroke-width="2"/></g></svg>`;
}

/** Zoomed on the answer after guessing. The shaded band is where points are scored. */
export function revealRuler(kind: Kind, a: number, g: number) {
  let X: (v: number) => number, lo: number, hi: number, ticks: string, off: boolean;
  if (kind === "pp") {
    X = (v) => PAD + Math.min(100, Math.max(0, v)) / 100 * (W - 2 * PAD);
    lo = Math.max(0, a - ZERO_AT.pp); hi = Math.min(100, a + ZERO_AT.pp);
    ticks = [0, 25, 50, 75, 100].map((v) => `<text x="${X(v)}" y="78" text-anchor="middle">${v}%</text>`).join("");
    off = false;
  } else {
    const k = ZERO_AT[kind], span = Math.log(k) * 1.6;
    const L = Math.log(a) - span, H = Math.log(a) + span;
    X = (v) => PAD + (Math.min(H, Math.max(L, Math.log(Math.max(v, 1e-9)))) - L) / (H - L) * (W - 2 * PAD);
    lo = a / k; hi = a * k;
    ticks = ([[a / k, "÷" + k], [a * k, "×" + k]] as const).map(([v, l]) => `<text x="${X(v)}" y="78" text-anchor="middle">${l} = 0 pts</text>`).join("");
    off = Math.abs(Math.log(Math.max(g, 1e-9)) - Math.log(a)) > span;
  }
  const ax = X(a), gx = X(g);
  const gl = Math.min(W - 40, Math.max(40, gx)), al = Math.min(W - 50, Math.max(50, ax));
  const close = Math.abs(gx - ax) < 70;
  return `<svg class="ruler" viewBox="0 0 ${W} 86" role="img" aria-label="Your guess against the answer. The shaded band is where points are scored.">
    <polygon points="${X(lo)},50 ${ax},34 ${X(hi)},50" fill="var(--good)" opacity=".18"/>
    <line x1="${PAD}" x2="${W - PAD}" y1="50" y2="50" stroke="var(--rule)" stroke-width="6" stroke-linecap="round"/>
    <line x1="${X(lo)}" x2="${X(hi)}" y1="50" y2="50" stroke="var(--good)" stroke-opacity=".35" stroke-width="6"/>
    <line x1="${ax}" x2="${ax}" y1="22" y2="58" stroke="var(--good)" stroke-width="3"/>
    <text class="lbl" x="${al}" y="${close ? 14 : 16}" text-anchor="middle" style="fill:var(--good)">Answer</text>
    <circle cx="${gx}" cy="50" r="8" fill="var(--ink)" stroke="var(--paper)" stroke-width="2.5"/>
    <text class="lbl" x="${gl}" y="${close ? 78 : 16}" text-anchor="middle" style="fill:var(--ink)">You${off ? " (off the scale)" : ""}</text>
    ${close ? "" : ticks}
  </svg>`;
}
