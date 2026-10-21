import type { Kind } from "./types";

/**
 * Scoring, fermi.gg-style: the multiplier is how many times off you were.
 *   exact = 1.0×, half or double = 2.0×, ten times off = 10×. Lower is better.
 * The same rule applies to every question (totals, counts and percentages).
 * An issue's score is the average multiplier across its three questions.
 * No cap, like fermi.gg: a wildly wrong guess shows its full, embarrassing multiplier.
 */
export function factor(answer: number, guess: number): number {
  if (!(guess > 0) || !(answer > 0)) return Number.MAX_VALUE;
  return Math.max(guess / answer, answer / guess);
}

/** Average multiplier for an issue (arithmetic mean, as fermi.gg does). */
export const issueScore = (factors: number[]) => factors.reduce((a, b) => a + b, 0) / factors.length;

/** Rounded for storage and display: 2 decimals under 10× (1.45×), 1 under 100×, whole above. */
export const roundFactor = (f: number) => (f < 10 ? Math.round(f * 100) / 100 : f < 100 ? Math.round(f * 10) / 10 : Math.round(f));

export function validGuess(kind: Kind, g: unknown): g is number {
  if (typeof g !== "number" || !Number.isFinite(g) || g <= 0) return false;
  if (kind === "pp") return g <= 100;
  return g < 1e15;
}
