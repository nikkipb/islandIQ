import "./styles.css";
import { parseGuess, ParseError } from "../shared/parse";
import { secondsToNextIssue } from "../shared/time";
import type { GuessResult, IssuePayload } from "../shared/types";
import { liveRuler, revealRuler } from "./ruler";
import { esc, exact, short, words } from "./format";
import { fetchIssue, submitGuess } from "./api";
import { load, save, type Play } from "./store";

const CAT: Record<string, string> = {
  "Heritage & History": "heritage", "Sport & Football": "sport", "Geography & Environment": "geo",
  "People & Localities": "people", "Transport & Mobility": "transport", "Food & Culture": "food",
  "Property & Cost of Living": "property", "Business & Economy": "economy", Tourism: "tourism",
};
const catClass = (c: string) => "c-" + (CAT[c] ?? "geo");
const word = (s: number) => s >= 95 ? "Bang on" : s >= 80 ? "Very close" : s >= 60 ? "Close" : s >= 35 ? "In the area" : s > 0 ? "Way off" : "Not even close";
const tone = (s: number) => s >= 80 ? "var(--good)" : s >= 40 ? "var(--mid)" : "var(--bad)";
const fmtDate = (ymd: string) => new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const $ = (id: string) => document.getElementById(id)!;

let issue: IssuePayload | null = null;
let play: Play;
let cdTimer = 0;

/* ---------------- boot & routing (#7 opens issue 7) ---------------- */
async function open(n: number | "today", focus = false) {
  try {
    issue = await fetchIssue(n);
  } catch (e) {
    $("stage").innerHTML = `<div class="oops"><b>Couldn't load that issue</b><span>${esc((e as Error).message)}</span><button class="link" id="retry">Try again</button></div>`;
    $("retry").onclick = () => open(n);
    return;
  }
  play = load(issue.issue);
  render(focus);
}

function render(focus = false) {
  if (!issue) return;
  $("issue").innerHTML = `<b>No. ${issue.issue}</b><br>${fmtDate(issue.date)}`;
  renderArchive();
  const stage = $("stage");
  if (play.view === "intro") stage.innerHTML = intro();
  else if (play.view === "q") stage.innerHTML = question(play.results.length);
  else if (play.view === "r") stage.innerHTML = reveal(play.results.length - 1);
  else stage.innerHTML = summary();
  bind(focus);
}

/* ---------------- views ---------------- */
function intro() {
  const n = play.results.length, Q = issue!.questions;
  return `<section class="hero enter">
      <h1 class="no"><small>No.</small>${issue!.issue}</h1>
      <p>Three Maltese numbers. One guess each. Up to 100 points a question.</p>
    </section>
    <div class="tickets">${Q.map((q, i) => `<div class="ticket ${catClass(q.cat)} enter d${i + 1} ${i < n ? "done" : ""}"><span class="n">${i + 1}</span><span class="t">${esc(q.cat)}</span><span class="d">${esc(q.diff)}</span></div>`).join("")}</div>
    <div class="rules">
      <div><b>Guess</b>Type a number. <code style="font-family:var(--f-num)">4.2m</code> works.</div>
      <div><b>Score</b>Closer guesses get more of the 100.</div>
      <div><b>Learn</b>Every answer has its source.</div>
    </div>
    <button class="go" id="start"><span>${n ? "Carry on" : "Play today's three"}</span><span class="arr">→</span></button>`;
}

function question(i: number) {
  const q = issue!.questions[i];
  return `<section class="field ${catClass(q.cat)} enter">
      <div class="top"><span>${esc(q.cat)}</span><span class="of">${i + 1} of 3 · ${esc(q.diff)}</span></div>
      <div class="steps" aria-hidden="true">${[0, 1, 2].map((k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
      <h2>${esc(q.q)}</h2>
      <span class="unit">Answer in ${esc(q.unit)}</span>
    </section>
    <form class="slip enter d2" id="form" autocomplete="off" novalidate>
      <label for="guess" class="tip" style="font-weight:600;color:var(--ink)">Your guess</label>
      <div class="entry">
        ${q.pre ? `<span class="aff">${q.pre}</span>` : ""}
        <input id="guess" inputmode="${q.kind === "pp" ? "decimal" : "text"}" placeholder="${q.kind === "pp" ? "e.g. 35" : "e.g. 250k"}" aria-describedby="readout">
        ${q.suf ? `<span class="aff">${q.suf}</span>` : ""}
      </div>
      <div class="readout" id="readout"><span class="words" id="words">&nbsp;</span></div>
      <div id="live">${liveRuler(q.kind, null)}</div>
      <button class="go" id="lock" disabled><span>Lock it in</span><span class="arr">→</span></button>
      <span class="tip">No looking it up. Shorthand works: <code>3.9bn</code>, <code>250k</code>, even <code>520k*0.6</code>.</span>
    </form>`;
}

function reveal(i: number) {
  const q = issue!.questions[i], r = play.results[i], s = r.score, last = i === 2;
  return `<section class="field ${catClass(q.cat)}">
      <div class="top"><span>${esc(q.cat)}</span><span class="of">${i + 1} of 3</span></div>
      <h2 style="font-size:19px">${esc(q.q)}</h2>
      <div class="verdict"><span class="pts" id="pts" data-to="${s}">${s}<small>/100</small></span><span class="word">${word(s)}</span></div>
    </section>
    <section class="slip enter d2">
      <div class="pair">
        <div><span class="k">You said</span><span class="v">${q.pre}${short(r.guess)}${q.suf}</span></div>
        <div class="ans"><span class="k">Answer</span><span class="v">${exact(q, r.answer.a)}</span></div>
      </div>
      ${revealRuler(q.kind, r.answer.a, r.guess)}
      <div class="story">
        <p>${esc(r.answer.reveal)}</p>
        ${r.answer.why ? `<p class="why">${esc(r.answer.why)}</p>` : ""}
      </div>
      <div class="cite"><span>Source: <a href="${esc(r.answer.url)}" target="_blank" rel="noopener">${esc(r.answer.src)}</a></span><span class="per">${esc(r.answer.period)}</span></div>
      <button class="go" id="next"><span>${last ? "See your score" : "Next question"}</span><span class="arr">→</span></button>
    </section>`;
}

function shareText() {
  const sc = play.results.map((r) => r.score), tot = sc.reduce((a, b) => a + b, 0);
  const bar = (x: number) => { const f = Math.round(x / 20); return (x >= 80 ? "🟩" : x >= 40 ? "🟨" : "🟥").repeat(f) + "⬜".repeat(5 - f); };
  return { sc, tot, text: `IslandIQ No. ${issue!.issue} · ${tot}/300\n${sc.map((x) => bar(x) + " " + x).join("\n")}\n${location.host || "islandiq.mt"}` };
}

function summary() {
  const { sc, tot, text } = shareText(), Q = issue!.questions;
  const line = tot >= 240 ? "A walking NSO release." : tot >= 180 ? "Solid. Your nanna would be proud." : tot >= 110 ? "Respectable. Mostly." : "Tomorrow's a new day.";
  const isLatest = issue!.issue === issue!.latest;
  return `<section class="hero enter">
      <div class="total"><span class="pts" id="pts" data-to="${tot}">${tot}</span><span class="of">/300</span></div>
      <p style="color:var(--ink);font-weight:600">${line}</p>
    </section>
    <div class="lines">${Q.map((q, i) => `<div class="line ${catClass(q.cat)} enter d${i + 1}"><span class="sw"></span>
        <div class="q"><span>${esc(q.cat)}</span>${esc(q.q)}<div class="meter"><i style="width:${sc[i]}%"></i></div></div>
        <span class="s" style="color:${tone(sc[i])}">${sc[i]}</span></div>`).join("")}</div>
    <pre class="share" id="share">${esc(text)}</pre>
    <button class="go" id="copy"><span>Share result</span><span class="arr">↗</span></button>
    <div class="toast" id="toast" role="status"></div>
    ${isLatest ? `<div class="next"><span>Next issue in</span><b id="cd">--:--:--</b></div>` : ""}`;
}

function renderArchive() {
  const n = issue!.latest;
  $("archive-note").textContent = n >= issue!.total ? "" : `${n} out so far`;
  $("days").innerHTML = Array.from({ length: n }, (_, k) => n - k).map((i) => {
    const p = load(i), done = p.view === "sum", t = done ? p.results.reduce((a, r) => a + r.score, 0) : null;
    return `<button class="day" data-i="${i}" aria-current="${i === issue!.issue}" aria-label="Issue ${i}${done ? ", scored " + t : ""}"><span class="dn">${i}</span><span class="ds">${done ? t : "–"}</span></button>`;
  }).join("");
  document.querySelectorAll<HTMLButtonElement>(".day").forEach((b) => (b.onclick = () => {
    location.hash = b.dataset.i!;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
}

/* ---------------- behaviour ---------------- */
function bind(focus: boolean) {
  clearInterval(cdTimer);
  const go = (v: Play["view"]) => { play.view = v; save(issue!.issue, play); render(true); };

  if (play.view === "intro") $("start").onclick = () => go(play.results.length >= 3 ? "sum" : "q");

  if (play.view === "q") {
    const i = play.results.length, q = issue!.questions[i];
    const inp = $("guess") as HTMLInputElement, btn = $("lock") as HTMLButtonElement, rd = $("readout"), w = $("words");
    let val: number | null = null;
    if (focus) inp.focus();
    inp.oninput = () => {
      const err = (m: string) => { val = null; rd.className = "readout err"; w.textContent = m; };
      try {
        val = parseGuess(inp.value);
        rd.className = "readout";
        w.textContent = val == null ? " " : "= " + q.pre + words(val) + q.suf;
        if (val != null && q.kind === "pp" && val > 100) err("A percentage can't go above 100.");
        if (val != null && q.kind !== "pp" && val === 0) err("Guess something above zero.");
      } catch (e) {
        if (e instanceof ParseError) err(e.message); else throw e;
      }
      btn.disabled = val == null;
      $("live").innerHTML = liveRuler(q.kind, val);
    };
    ($("form") as HTMLFormElement).onsubmit = async (e) => {
      e.preventDefault();
      if (val == null || btn.getAttribute("aria-busy")) return;
      btn.setAttribute("aria-busy", "true");
      try {
        const res: GuessResult = await submitGuess(issue!.issue, i, val);
        play.results.push(res);
        go("r");
      } catch (err) {
        btn.removeAttribute("aria-busy");
        rd.className = "readout err";
        w.textContent = (err as Error).message;
      }
    };
  }

  if (play.view === "r") {
    countUp();
    $("next").onclick = () => go(play.results.length >= 3 ? "sum" : "q");
    if (focus) ($("next") as HTMLButtonElement).focus({ preventScroll: true });
  }

  if (play.view === "sum") {
    countUp();
    $("copy").onclick = async () => {
      const t = shareText().text;
      try {
        if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ text: t }); return; }
        await navigator.clipboard.writeText(t);
        $("toast").textContent = "Copied. Drop it in the group chat.";
      } catch {
        const r = document.createRange(); r.selectNodeContents($("share"));
        const sel = getSelection()!; sel.removeAllRanges(); sel.addRange(r);
        $("toast").textContent = "Selected. Copy it from there.";
      }
    };
    const cd = document.getElementById("cd");
    if (cd) {
      const tick = () => { const left = secondsToNextIssue(); cd.textContent = [left / 3600 | 0, (left % 3600) / 60 | 0, left % 60].map((x) => String(x).padStart(2, "0")).join(":"); if (left <= 1) setTimeout(() => open("today"), 1500); };
      tick(); cdTimer = window.setInterval(tick, 1000);
    }
  }
}

function countUp() {
  const el = document.getElementById("pts");
  if (!el || !el.firstChild) return;
  const to = Number(el.dataset.to);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || to === 0) return;
  const t0 = performance.now(), dur = 700;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    el.firstChild!.nodeValue = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  el.firstChild.nodeValue = "0";
  requestAnimationFrame(step);
}

const fromHash = () => { const n = Number(location.hash.slice(1)); return Number.isInteger(n) && n > 0 ? n : "today" as const; };
window.addEventListener("hashchange", () => open(fromHash()));
open(fromHash());

