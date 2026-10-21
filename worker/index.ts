import { factor, roundFactor, validGuess } from "../shared/scoring";
import { getIssue, json, latestIssue, publicIssue, type Env } from "../shared/server";
import type { GuessResult } from "../shared/types";

// Static files in dist/ are served by Cloudflare before this runs.
// Anything that isn't a file (i.e. /api/...) lands here.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/issue\/(today|\d+)$/);
    if (m && request.method === "GET") return getIssueRoute(m[1], env);
    if (url.pathname === "/api/guess" && request.method === "POST") {
      try { return await postGuess(request, env); }
      catch (e) { console.error(e); return json({ error: "Couldn't save your guess. Try again in a moment." }, 500); }
    }
    if (url.pathname === "/api/forget" && request.method === "POST") return forget(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

// GET /api/issue/today | /api/issue/7 — the three questions WITHOUT answers.
function getIssueRoute(raw: string, env: Env) {
  const n = raw === "today" ? latestIssue(env) : Number(raw);
  const body = publicIssue(env, n);
  if (!body) return json({ error: "That issue isn't out yet." }, 404);
  return json(body, 200, "public, max-age=60");
}

interface Body { issue: number; index: number; guess: number; player: string }

// POST /api/guess { issue, index, guess, player } — scores server-side; first guess is final.
async function postGuess(request: Request, env: Env) {
  let b: Body;
  try { b = await request.json(); } catch { return json({ error: "Bad request." }, 400); }

  const qs = getIssue(env, Number(b.issue));
  const idx = Number(b.index);
  if (!qs || !Number.isInteger(idx) || idx < 0 || idx > 2) return json({ error: "Unknown question." }, 404);
  if (typeof b.player !== "string" || !/^[a-z0-9-]{8,64}$/i.test(b.player)) return json({ error: "Bad player id." }, 400);

  const q = qs[idx];
  if (!validGuess(q.kind, b.guess)) return json({ error: "That guess isn't a valid number for this question." }, 422);

  const prior = await env.DB.prepare(
    "SELECT guess, factor FROM guesses WHERE issue = ?1 AND q_index = ?2 AND player = ?3",
  ).bind(b.issue, idx, b.player).first<{ guess: number; factor: number }>();

  let g = b.guess, f: number;
  if (prior) {
    g = prior.guess; f = prior.factor;
  } else {
    f = roundFactor(factor(q.a, g));
    await env.DB.prepare(
      "INSERT OR IGNORE INTO guesses (issue, q_index, question, player, guess, factor) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(b.issue, idx, q.id, b.player, g, f).run();
  }

  const res: GuessResult = {
    factor: f,
    guess: g,
    answer: { a: q.a, reveal: q.reveal, why: q.why, period: q.period, src: q.src, url: q.url },
  };
  return json(res);
}

// POST /api/forget { player } — GDPR erasure: delete every guess linked to this player id.
async function forget(request: Request, env: Env) {
  let b: { player?: unknown };
  try { b = await request.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (typeof b.player !== "string" || !/^[a-z0-9-]{8,64}$/i.test(b.player)) return json({ error: "Bad player id." }, 400);
  const r = await env.DB.prepare("DELETE FROM guesses WHERE player = ?1").bind(b.player).run();
  return json({ deleted: r.meta.changes ?? 0 });
}
