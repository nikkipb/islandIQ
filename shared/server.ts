import schedule from "../data/schedule.json";
import type { IssuePayload, Question } from "./types";
import { dateOfIssue, issueFor, maltaParts } from "./time";

export interface Env {
  DB: D1Database;
  PREVIEW?: string;
  ASSETS: Fetcher;
}

const DAYS = schedule as unknown as Question[][];
export const TOTAL = DAYS.length;

/** Newest issue a player may open. In preview every scheduled issue is open. */
export function latestIssue(env: Env): number {
  if (env.PREVIEW === "1") return TOTAL;
  return Math.min(TOTAL, Math.max(1, issueFor(maltaParts().ymd)));
}

/** Returns the issue's questions, or null if it doesn't exist or isn't out yet. */
export function getIssue(env: Env, n: number): Question[] | null {
  if (!Number.isInteger(n) || n < 1 || n > latestIssue(env)) return null;
  return DAYS[n - 1] ?? null;
}

export function publicIssue(env: Env, n: number): IssuePayload | null {
  const qs = getIssue(env, n);
  if (!qs) return null;
  return {
    issue: n,
    date: dateOfIssue(n),
    total: TOTAL,
    latest: latestIssue(env),
    questions: qs.map(({ cat, diff, q, unit, pre, suf, kind }) => ({ cat, diff, q, unit, pre, suf, kind })),
  };
}

export const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });
