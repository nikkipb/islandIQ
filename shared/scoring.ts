import type { Kind } from "./types";

/**
 * Scoring: 0–100 per question, 300 per issue.
 *  ratio  – large totals. Linear in log-distance; 10× off (either way) scores 0.
 *  count  – small counts. Same shape, but 3× off scores 0.
 *  pp     – percentages. Linear in percentage points; 25pp off scores 0.
 * Tune these in one place; the client draws its ruler from the same numbers.
 */
export const ZERO_AT = { ratio: 10, count: 3, pp: 25 } as const;

export function score(kind: Kind, answer: number, guess: number): number {
  if (!Number.isFinite(guess) || guess < 0) return 0;
  if (kind === "pp") {
    return Math.round(100 * Math.max(0, 1 - Math.abs(guess - answer) / ZERO_AT.pp));
  }
  if (guess === 0) return 0;
  const off = Math.abs(Math.log(guess / answer)) / Math.log(ZERO_AT[kind]);
  return Math.round(100 * Math.max(0, 1 - off));
}

export function validGuess(kind: Kind, g: unknown): g is number {
  if (typeof g !== "number" || !Number.isFinite(g)) return false;
  if (kind === "pp") return g >= 0 && g <= 100;
  return g > 0 && g < 1e15;
}
