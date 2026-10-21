export type Kind = "ratio" | "count" | "pp";

/** A question as stored server-side (includes the answer). */
export interface Question {
  id: string;
  cat: string;
  diff: "Easy" | "Medium" | "Hard" | string;
  q: string;
  a: number;
  unit: string;
  pre: string;
  suf: string;
  kind: Kind;
  reveal: string;
  why: string;
  period: string;
  src: string;
  url: string;
}

/** What the browser sees before guessing: no answer, no reveal. */
export type PublicQuestion = Pick<Question, "cat" | "diff" | "q" | "unit" | "pre" | "suf" | "kind">;

export interface IssuePayload {
  issue: number;       // 1-based
  date: string;        // YYYY-MM-DD (Malta)
  total: number;       // issues in the schedule
  latest: number;      // newest playable issue
  questions: PublicQuestion[];
}

export interface GuessResult {
  score: number;
  guess: number;
  answer: Pick<Question, "a" | "reveal" | "why" | "period" | "src" | "url">;
}
