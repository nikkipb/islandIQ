import { json, latestIssue, publicIssue, type Env } from "../../../shared/server";

// GET /api/issue/today  or  /api/issue/7
// Returns the three questions WITHOUT answers.
export const onRequestGet: PagesFunction<Env> = ({ params, env }) => {
  const raw = String(params.n);
  const n = raw === "today" ? latestIssue(env) : Number(raw);
  const body = publicIssue(env, n);
  if (!body) return json({ error: "That issue isn't out yet." }, 404);
  return json(body, 200, "public, max-age=60");
};
