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

/** Zoomed on the answer after guessing, log scale. Marks ×2 and ×10 either side;
 *  the shaded band is "within 2×". Widens to fit wild guesses. */
export function revealRuler(a: number, g: number) {
  const f = Math.max(g / a, a / g);
  const span = Math.log(Math.min(1000, Math.max(12, f * 1.6)));
  const L = Math.log(a) - span, H = Math.log(a) + span;
  const X = (v: number) => PAD + (Math.min(H, Math.max(L, Math.log(v))) - L) / (H - L) * (W - 2 * PAD);
  const marks = ([[1 / 10, "÷10"], [1 / 2, "÷2"], [2, "×2"], [10, "×10"], [1 / 100, "÷100"], [100, "×100"]] as const)
    .filter(([m]) => Math.abs(Math.log(m)) < span * 0.95);
  const ax = X(a), gx = X(g);
  const close = Math.abs(gx - ax) < 60;
  const gl = Math.min(W - 30, Math.max(30, gx)), al = Math.min(W - 40, Math.max(40, ax));
  const ticks = marks.map(([m, l]) => `<line x1="${X(a * m)}" x2="${X(a * m)}" y1="44" y2="56" stroke="var(--ink-2)"/><text x="${X(a * m)}" y="74" text-anchor="middle">${l}</text>`).join("");
  return `<svg class="ruler" viewBox="0 0 ${W} 80" role="img" aria-label="Your guess against the answer on a log scale">
    <line x1="${PAD}" x2="${W - PAD}" y1="50" y2="50" stroke="var(--rule)" stroke-width="6" stroke-linecap="round"/>
    <line x1="${X(a / 2)}" x2="${X(a * 2)}" y1="50" y2="50" stroke="var(--good)" stroke-opacity=".45" stroke-width="6"/>
    ${ticks}
    <line x1="${ax}" x2="${ax}" y1="24" y2="58" stroke="var(--good)" stroke-width="3"/>
    <text class="lbl" x="${al}" y="${close ? 14 : 18}" text-anchor="middle" style="fill:var(--good)">Answer</text>
    <circle cx="${gx}" cy="50" r="8" fill="var(--ink)" stroke="var(--paper)" stroke-width="2.5"/>
    ${close ? "" : `<text class="lbl" x="${gl}" y="18" text-anchor="middle" style="fill:var(--ink)">You</text>`}
  </svg>`;
}
