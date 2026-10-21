import type { GuessResult } from "../shared/types";

export interface Play { view: "intro" | "q" | "r" | "sum"; results: GuessResult[] }

const KEY = "islandiq-v2"; // v2: multiplier scoring
type All = Record<string, Play>;

const read = (): All => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

export function load(issue: number): Play {
  const p = read()[issue];
  return p && Array.isArray(p.results) && p.results.every((r) => typeof r.factor === "number") ? p : { view: "intro", results: [] };
}

export function save(issue: number, p: Play) {
  try { const all = read(); all[issue] = p; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode: play still works */ }
}

/** Random per-device id so the server can keep a player's first guess. Not personal data. */
export function playerId(): string {
  try {
    let id = localStorage.getItem("islandiq-player");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("islandiq-player", id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
