# IslandIQ

The daily Maltese numbers game. Three questions a day, one guess each, up to 100 points per question, every answer sourced.

## How it fits together

```
content/questions.xlsx  ──(npm run schedule)──▶  data/schedule.json   (answers live here, server-only)
                                                        │
worker/index.ts   GET  /api/issue/:n  → that day's 3 questions, no answers
                  POST /api/guess     → scores on the server, stores in D1, returns the reveal
                  everything else     → static files from dist/
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
npm run build && npm run api  # Worker + built site on http://localhost:8788
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

## Deploy (Cloudflare Workers + D1, free tier)

Production deploys automatically on every push to `main` (Cloudflare Workers Builds:
build command `npm run build`, deploy command `npx wrangler deploy`).

Manual deploy from a laptop: `npx wrangler login` then `npm run deploy`.
Schema changes: add a new file in `migrations/`, then `npm run db:migrate:remote`.

## Open decisions

- Final scoring cut-offs (`shared/scoring.ts`)
- Domain: islandiq.mt or islandiq.gg
- Launch date (`EPOCH` in `shared/time.ts` and `scripts/build_schedule.py`)
- Crowd stats: data is already being stored; show them once there are enough real players

## Ads and privacy

- Ad slots live in `src/ads.ts`: desktop side rails, a 320×100 banner on the phone summary
  screen, and a 300×250 in the past-issues sheet. Nothing shows mid-question.
  Add `?adpreview` to any URL to see the layout with grey boxes.
- To go live: paste the AdSense publisher id and 4 ad-unit ids into `src/ads.ts`, fill in
  `public/ads.txt`, and turn on AdSense → Privacy & messaging → European regulations message
  (Google's certified consent banner; no code needed).
- Legal pages: `privacy.html`, `cookies.html`, `terms.html`, `about.html`.
  **Before launch:** put the founders' legal names (or company) and a Maltese postal address in
  the "Who is responsible" section of `privacy.html` (marked TODO), and make hello@islandiq.gg work.
- `POST /api/forget` deletes a player's guesses (GDPR erasure); exposed as "Delete my data".
- Fonts are self-hosted (`@fontsource`), so no visitor data goes to Google Fonts.
