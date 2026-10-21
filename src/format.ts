import type { PublicQuestion } from "../shared/types";

export const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Compact: 4.02m, 3.9bn, 25,807, 16.05 */
export function short(n: number) {
  const a = Math.abs(n);
  const r = (x: number) => parseFloat(x.toPrecision(3)).toLocaleString("en-GB");
  if (a >= 1e9) return r(n / 1e9) + "bn";
  if (a >= 1e6) return r(n / 1e6) + "m";
  if (a >= 1e4) return Math.round(n).toLocaleString("en-GB");
  return parseFloat(n.toPrecision(4)).toLocaleString("en-GB");
}

/** Readout while typing: "about 4.2 million" */
export function words(n: number) {
  if (n >= 1e9) return "about " + parseFloat((n / 1e9).toPrecision(3)) + " billion";
  if (n >= 1e6) return "about " + parseFloat((n / 1e6).toPrecision(3)) + " million";
  if (n >= 1e3) return Math.round(n).toLocaleString("en-GB");
  return parseFloat(n.toPrecision(4)).toLocaleString("en-GB");
}

/** Answer display: short form plus the exact figure for big numbers. */
export function exact(q: PublicQuestion, a: number) {
  const body = a >= 1e6 ? `${short(a)} <small style="font-size:.7em;opacity:.7">(${a.toLocaleString("en-GB")})</small>` : parseFloat(a.toPrecision(6)).toLocaleString("en-GB");
  return q.pre + body + q.suf;
}
