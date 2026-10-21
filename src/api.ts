import type { GuessResult, IssuePayload } from "../shared/types";
import { playerId } from "./store";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(path, init); } catch { throw new Error("No connection. Check your signal and try again."); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || "Something went wrong. Try again.");
  return body as T;
}

export const fetchIssue = (n: number | "today") => call<IssuePayload>(`/api/issue/${n}`);

export const submitGuess = (issue: number, index: number, guess: number) =>
  call<GuessResult>("/api/guess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ issue, index, guess, player: playerId() }),
  });
