import { score, validGuess } from "../../shared/scoring";
import { getIssue, json, type Env } from "../../shared/server";
import type { GuessResult } from "../../shared/types";

interface Body { issue: number; index: number; guess: number; player: string }

// POST /api/guess  { issue, index, guess, player }
// Scores on the server and reveals the answer. A player's first guess is final.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let b: Body;
  try { b = await request.json(); } catch { return json({ error: "Bad request." }, 400); }

  const qs = getIssue(env, Number(b.issue));
  const idx = Number(b.index);
  if (!qs || !Number.isInteger(idx) || idx < 0 || idx > 2) return json({ error: "Unknown question." }, 404);
  if (typeof b.player !== "string" || !/^[a-z0-9-]{8,64}$/i.test(b.player)) return json({ error: "Bad player id." }, 400);

  const q = qs[idx];
  if (!validGuess(q.kind, b.guess)) return json({ error: "That guess isn't a valid number for this question." }, 422);

  // Keep the first guess: if one exists, return it instead of re-scoring.
  const prior = await env.DB.prepare(
    "SELECT guess, score FROM guesses WHERE issue = ?1 AND q_index = ?2 AND player = ?3",
  ).bind(b.issue, idx, b.player).first<{ guess: number; score: number }>();

  let g = b.guess, s: number;
  if (prior) {
    g = prior.guess; s = prior.score;
  } else {
    s = score(q.kind, q.a, g);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO guesses (issue, q_index, question, player, guess, score) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(b.issue, idx, q.id, b.player, g, s).run();
  }

  const res: GuessResult = {
    score: s,
    guess: g,
    answer: { a: q.a, reveal: q.reveal, why: q.why, period: q.period, src: q.src, url: q.url },
  };
  return json(res);
};
