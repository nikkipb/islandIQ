# IslandIQ

The daily Maltese numbers game. Three questions a day, one guess each, up to 100 points per question, every answer sourced.

## How it fits together

```
content/questions.xlsx  ──(npm run schedule)──▶  data/schedule.json   (answers live here, server-only)
                                                        │
functions/api/issue/[n].ts  GET  → today's 3 questions, no answers
functions/api/guess.ts      POST → scores on the server, stores in D1, returns the reveal
                                                        │
src/  (Vite + TypeScript, no framework)  ◀──────────────┘
shared/  scoring, parsing and time code used by both sides
```

- Answers never reach the browser before a guess. `npm run build` output contains no answers.
- A player's first guess per question is final (enforced in D1 by primary key).
- Players are a random per-device id, no accounts, no personal data.

## Run it locally

```bash
npm install
npm run db:migrate:local      # creates the local D1 database
npm run build && npm run api  # API + built site on http://localhost:8788
npm run dev                   # in a 2nd terminal: hot-reload front end on :5173, proxies /api to :8788
npm test
```

`PREVIEW = "1"` in `wrangler.toml` unlocks every issue. Set it to `"0"` for launch.

## Editing questions

1. Edit `content/questions.xlsx` (same columns as the co-founders' bank).
2. `pip install openpyxl && npm run schedule`
3. Commit both the spreadsheet and `data/schedule.json`.

Issues that have already gone out are frozen: the script copies them unchanged and only re-plans future days. It prints the date the content runs out, which is currently 6 Nov 2026 (17 issues), so new questions are needed.

Rows with an *Editorial status* starting "Rejected" are skipped. Scoring type comes from the *Scoring guidance* column: "Percentage-point…" → points off, "Relative…" → ratio (0 at 10× off), anything else → count (0 at 3× off). Cut-offs live in `shared/scoring.ts`.

## Deploy (Cloudflare Pages + D1, free tier)

```bash
npx wrangler login
npx wrangler d1 create islandiq          # paste the database_id into wrangler.toml
npm run db:migrate:remote
npm run deploy
```

Or connect the repo in the Cloudflare dashboard (build command `npm run build`, output `dist`) and add the D1 binding `DB` under Settings → Functions.

## Open decisions

- Final scoring cut-offs (`shared/scoring.ts`)
- Domain: islandiq.mt or islandiq.gg
- Launch date (`EPOCH` in `shared/time.ts` and `scripts/build_schedule.py`)
- Crowd stats: data is already being stored; show them once there are enough real players
