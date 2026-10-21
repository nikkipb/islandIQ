import "./styles.css";
import { parseGuess, ParseError } from "../shared/parse";
import { secondsToNextIssue } from "../shared/time";
import { issueScore, roundFactor } from "../shared/scoring";
import type { IssuePayload } from "../shared/types";
import { liveRuler, liveX, revealRuler } from "./ruler";
import { esc, exact, short, words } from "./format";
import { fetchIssue, submitGuess } from "./api";
import { load, save, type Play } from "./store";

const CAT: Record<string, string> = {
  "Heritage & History": "heritage", "Sport & Football": "sport", "Geography & Environment": "geo",
  "People & Localities": "people", "Transport & Mobility": "transport", "Food & Culture": "food",
  "Property & Cost of Living": "property", "Business & Economy": "economy", Tourism: "tourism",
};
const cat = (c: string) => "c-" + (CAT[c] ?? "geo");
const EMOJI: Record<string, string> = {
  heritage: "🏛️", sport: "⚽", geo: "🌊", people: "👥", transport: "🚌",
  food: "🥖", property: "🏠", economy: "📈", tourism: "✈️",
};
const emoji = (c: string) => EMOJI[CAT[c] ?? "geo"];
const word = (f: number) => f <= 1.1 ? "Bang on" : f <= 1.5 ? "Very close" : f <= 2 ? "Close" : f <= 5 ? "In the area" : f <= 20 ? "Way off" : "Not even close";
const tone = (f: number) => f <= 1.5 ? "var(--good)" : f <= 3 ? "var(--mid)" : "var(--bad)";
const fx = (f: number) => { const r = roundFactor(f); return (r < 10 ? r.toFixed(2) : r < 100 ? r.toFixed(1) : r.toLocaleString("en-GB")) + "×"; };
/** Shrink big numbers so "7,686,656×" still fits its box. */
const fit = (f: number, sizes: [number, number, number, number]) => { const n = fx(f).length; return `font-size:${n <= 5 ? sizes[0] : n <= 7 ? sizes[1] : n <= 9 ? sizes[2] : sizes[3]}px`; };
/** Bar length for a multiplier: full at 1×, empty at 10× and beyond (log scale). */
const closeness = (f: number) => Math.max(0, 1 - Math.log10(f)) * 100;
const fmtDate = (ymd: string) => new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Restart a one-shot CSS animation class on an element (shake, pop). */
function kick(el: Element | null, cls: "shake" | "pop") {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

let issue: IssuePayload | null = null;
let play: Play;
let cdTimer = 0;

/* ---------------- theme ---------------- */
const SUN = `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4"/>`;
const MOON = `<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>`;
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};
function paintThemeButton() {
  const dark = isDark();
  $("theme-icon").innerHTML = dark ? SUN : MOON;
  $("theme").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  document.querySelector('meta[name="theme-color"]')!.setAttribute("content", dark ? "#121213" : "#E4E6E2");
}
$("theme").onclick = () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("islandiq-theme", next); } catch { /* fine */ }
  paintThemeButton();
};
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintThemeButton);
paintThemeButton();

/* ---------------- archive sheet ---------------- */
const sheet = $<HTMLDialogElement>("archive");
$("open-archive").onclick = () => { renderArchive(); sheet.showModal(); };
$("close-archive").onclick = () => sheet.close();

function renderArchive() {
  if (!issue) return;
  const n = issue.latest;
  $("archive-note").textContent = n >= issue.total ? `${n} issues` : `${n} issues out so far`;
  $("days").innerHTML = Array.from({ length: n }, (_, k) => n - k).map((i) => {
    const p = load(i), done = p.view === "sum", t = done ? fx(issueScore(p.results.map((r) => r.factor))) : null;
    return `<button class="day" data-i="${i}" aria-current="${i === issue!.issue}" aria-label="Issue ${i}${done ? ", scored " + t : ""}"><span class="dn">${i}</span><span class="ds">${done ? t : "–"}</span></button>`;
  }).join("");
  document.querySelectorAll<HTMLButtonElement>(".day").forEach((b) => (b.onclick = () => { sheet.close(); location.hash = b.dataset.i!; }));
}

/* ---------------- boot & routing (#7 opens issue 7) ---------------- */
async function open(n: number | "today") {
  try {
    issue = await fetchIssue(n);
  } catch (e) {
    $("board").innerHTML = `<div class="oops"><b>Couldn't load that issue</b><span>${esc((e as Error).message)}</span></div>`;
    $("dock").innerHTML = `<button class="go" id="retry"><span>Try again</span><span class="arr">↻</span></button>`;
    $("retry").onclick = () => open(n);
    return;
  }
  play = load(issue.issue);
  render();
}

function render() {
  if (!issue) return;
  clearInterval(cdTimer);
  // The landing page shows issue + date itself, so the header stays clean there.
  $("issue").innerHTML = play.view === "intro" ? "" : `<b>No. ${issue.issue}</b><br>${fmtDate(issue.date)}`;
  const v = play.view;
  if (v === "intro") intro();
  else if (v === "q") question(play.results.length);
  else if (v === "r") reveal(play.results.length - 1);
  else summary();
}

const go = (v: Play["view"]) => { play.view = v; save(issue!.issue, play); render(); };

/* ---------------- intro ---------------- */
function intro() {
  const n = play.results.length, Q = issue!.questions;
  $("board").innerHTML = `
    <section class="hero rise">
      <h1 class="tagline">How well do you really know Malta?</h1>
      <p class="dateline"><b>No. ${issue!.issue}</b><span>${fmtDate(issue!.date)}</span></p>
    </section>
    <div class="peek" aria-label="Today's topics">${Q.map((q, i) => `
      <div class="chip fill ${cat(q.cat)} flip ${i < n ? "done" : ""}" style="--i:${i + 1}" title="${esc(q.cat)}" aria-label="${esc(q.cat)}${i < n ? ", answered" : ""}">
        <span class="e" aria-hidden="true">${emoji(q.cat)}</span>
      </div>`).join("")}</div>
    <p class="how rise" style="--i:5">Three numbers. One guess each. Your score is how many times off you are, so lower wins.</p>`;
  $("dock").innerHTML = `<button class="go" id="start"><span>${n ? "Carry on" : "Play"}</span><span class="arr">→</span></button>`;
  $("start").onclick = () => go(play.results.length >= 3 ? "sum" : "q");
}

/* ---------------- question ---------------- */
function question(i: number) {
  const q = issue!.questions[i];
  $("board").innerHTML = `
    <section class="field fill ${cat(q.cat)} flip">
      <div class="top"><span>${emoji(q.cat)} ${esc(q.cat)}</span><span class="of">${i + 1} of 3</span></div>
      <div class="steps" aria-hidden="true">${[0, 1, 2].map((k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
      <h2>${esc(q.q)}</h2>
      <span class="unit">Answer in ${esc(q.unit)}</span>
    </section>
    <div class="rise" style="--i:3">${liveRuler(q.kind)}</div>`;
  $("dock").innerHTML = `
    <div class="readout" id="readout"><span class="words" id="words">No looking it up. One guess.</span></div>
    <form class="entryrow" id="form" autocomplete="off" novalidate>
      <label class="entry" for="guess">
        ${q.pre ? `<span class="aff">${q.pre}</span>` : ""}
        <input id="guess" inputmode="${q.kind === "pp" ? "decimal" : "text"}" enterkeyhint="go" placeholder="${q.kind === "pp" ? "e.g. 35" : "e.g. 250k"}" aria-label="Your guess" aria-describedby="readout">
        ${q.suf ? `<span class="aff">${q.suf}</span>` : ""}
      </label>
      <button class="go" id="lock" disabled><span>Lock in</span></button>
    </form>`;

  const inp = $<HTMLInputElement>("guess"), btn = $<HTMLButtonElement>("lock");
  const rd = $("readout"), w = $("words"), row = $("form"), mk = document.getElementById("mk");
  let val: number | null = null, why = "";
  inp.focus({ preventScroll: true });

  const check = () => {
    why = ""; val = null;
    try {
      val = parseGuess(inp.value);
      if (val != null && q.kind === "pp" && val > 100) why = "A percentage can't go above 100.";
      if (val != null && q.kind !== "pp" && val === 0) why = "Guess something above zero.";
    } catch (e) {
      if (e instanceof ParseError) why = e.message; else throw e;
    }
    if (why) val = null;
  };

  inp.oninput = () => {
    check();
    row.classList.toggle("bad", !!why);
    rd.className = why ? "readout err" : "readout";
    w.textContent = why || (val == null ? "No looking it up. One guess." : "= " + q.pre + words(val) + q.suf);
    btn.disabled = val == null && !why;   // stay pressable on errors so Enter can shake
    if (mk) {
      mk.style.opacity = val == null ? "0" : "1";
      if (val != null) mk.style.transform = `translateX(${liveX(q.kind, val)}px)`;
    }
  };

  ($("form") as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    if (btn.getAttribute("aria-busy")) return;
    check();
    if (val == null) { kick(row, "shake"); inp.focus(); return; }
    btn.setAttribute("aria-busy", "true");
    try {
      play.results.push(await submitGuess(issue!.issue, i, val));
      go("r");
    } catch (err) {
      btn.removeAttribute("aria-busy");
      rd.className = "readout err";
      w.textContent = (err as Error).message;
      kick(row, "shake");
    }
  };
}

/* ---------------- reveal: tiles flip in sequence, then the multiplier pops ---------------- */
function reveal(i: number) {
  const q = issue!.questions[i], r = play.results[i], f = r.factor, last = i === 2;
  $("board").innerHTML = `
    <section class="field fill compact ${cat(q.cat)}">
      <div class="top"><span>${emoji(q.cat)} ${esc(q.cat)}</span><span class="of">${i + 1} of 3</span></div>
      <h2>${esc(q.q)}</h2>
    </section>
    <div class="tiles" style="--tone:${tone(f)}">
      <div class="tile flip" style="--i:0"><span class="k">You said</span><span class="v">${q.pre}${short(r.guess)}${q.suf}</span></div>
      <div class="tile ans flip" style="--i:1"><span class="k">Answer</span><span class="v">${exact(q, r.answer.a)}</span></div>
      <div class="tile pts flip" style="--i:2" id="ptile"><span class="k">${r.guess >= r.answer.a ? "Too high" : "Too low"}</span><span class="v" id="pts" style="${fit(f, [34, 26, 20, 15])}">${fx(f)}</span></div>
    </div>
    <div class="verdict rise" style="--tone:${tone(f)};--i:5">${word(f)}</div>
    <div class="rise" style="--i:6">${revealRuler(r.answer.a, r.guess)}</div>
    <p class="story rise" style="--i:7">${esc(r.answer.reveal)}</p>
    ${r.answer.why ? `<p class="why rise" style="--i:8">${esc(r.answer.why)}</p>` : ""}`;
  $("dock").innerHTML = `<button class="go" id="next"><span>${last ? "See your score" : "Next question"}</span><span class="arr">→</span></button>`;
  $("next").onclick = () => go(play.results.length >= 3 ? "sum" : "q");
  $<HTMLButtonElement>("next").focus({ preventScroll: true });
  countUp($("pts"), f, calm() ? 0 : 330, () => kick($("ptile"), "pop"));
}

/* ---------------- summary ---------------- */
function shareText() {
  const sc = play.results.map((r) => r.factor), avg = issueScore(sc);
  const sq = (f: number) => (f <= 1.5 ? "🟩" : f <= 3 ? "🟨" : "🟥");
  return { sc, avg, text: `IslandIQ No. ${issue!.issue} · ${fx(avg)}\n${sc.map(sq).join("")}  ${sc.map(fx).join(" · ")}\n${location.host || "islandiq.mt"}` };
}

function summary() {
  const { sc, avg } = shareText(), Q = issue!.questions;
  const quip = avg <= 1.3 ? "A walking NSO release." : avg <= 2 ? "Solid. Your nanna would be proud." : avg <= 4 ? "Respectable. Mostly." : "Tomorrow's a new day.";
  const latest = issue!.issue === issue!.latest;
  $("board").innerHTML = `
    <section class="hero">
      <div class="total"><span class="big" id="total" style="${fit(avg, [112, 84, 60, 44])}">${fx(avg)}</span><span class="of">average</span></div>
      <p class="quip rise" style="--i:6">${quip}</p>
    </section>
    <div class="lines">${Q.map((q, i) => `
      <div class="line ${cat(q.cat)} flip" style="--i:${i + 1}"><span class="sw"></span>
        <div class="q"><span>${emoji(q.cat)} ${esc(q.cat)}</span><div class="meter"><i style="--w:${closeness(sc[i])}%;--i:${i + 1}"></i></div></div>
        <span class="s" style="color:${tone(sc[i])};${fit(sc[i], [28, 24, 18, 14])}">${fx(sc[i])}</span></div>`).join("")}</div>
    ${latest ? `<div class="next rise" style="--i:7"><span>Next issue in</span><b id="cd">--:--:--</b></div>` : `<div class="next"><span>Issue ${issue!.issue} of ${issue!.latest}</span><a class="link" href="#">Today's issue</a></div>`}`;
  $("dock").innerHTML = `<button class="go" id="share"><span>Share result</span><span class="arr">↗</span></button>`;
  countUp($("total"), avg, calm() ? 0 : 450, () => kick($("total"), "pop"));

  const btn = $<HTMLButtonElement>("share");
  btn.onclick = async () => {
    const text = shareText().text;
    // Feedback happens on the button itself: it turns green and says what happened.
    const done = (label: string) => {
      btn.classList.add("ok"); btn.innerHTML = `<span>${label}</span><span class="arr">✓</span>`;
      kick(btn, "pop");
      setTimeout(() => { btn.classList.remove("ok"); btn.innerHTML = `<span>Share result</span><span class="arr">↗</span>`; }, 2200);
    };
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ text }); done("Shared"); return; }
      await navigator.clipboard.writeText(text);
      done("Copied. Paste it anywhere");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      kick(btn, "shake");
    }
  };

  const cd = document.getElementById("cd");
  if (cd) {
    const tick = () => {
      const left = secondsToNextIssue();
      cd.textContent = [left / 3600 | 0, (left % 3600) / 60 | 0, left % 60].map((x) => String(x).padStart(2, "0")).join(":");
      if (left <= 1) setTimeout(() => open("today"), 1500);
    };
    tick(); cdTimer = window.setInterval(tick, 1000);
  }
}

/* Count a multiplier down from 10× to the result after `delay` ms, then run `after` (the pop). */
function countUp(el: HTMLElement, to: number, delay: number, after: () => void) {
  el.textContent = fx(to);
  if (calm()) return;
  const from = Math.max(10, to * 3);
  el.textContent = fx(from);
  setTimeout(() => {
    const t0 = performance.now(), dur = 650;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fx(Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * e));
      if (k < 1) requestAnimationFrame(step); else { el.textContent = fx(to); after(); }
    };
    requestAnimationFrame(step);
  }, delay);
}

const fromHash = () => { const n = Number(location.hash.slice(1)); return Number.isInteger(n) && n > 0 ? n : "today" as const; };
window.addEventListener("hashchange", () => open(fromHash()));
open(fromHash());
