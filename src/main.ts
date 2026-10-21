import "./styles.css";
import { parseGuess, ParseError } from "../shared/parse";
import { secondsToNextIssue } from "../shared/time";
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
const word = (s: number) => s >= 95 ? "Bang on" : s >= 80 ? "Very close" : s >= 60 ? "Close" : s >= 35 ? "In the area" : s > 0 ? "Way off" : "Not even close";
const tone = (s: number) => s >= 80 ? "var(--good)" : s >= 40 ? "var(--mid)" : "var(--bad)";
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
    const p = load(i), done = p.view === "sum", t = done ? p.results.reduce((a, r) => a + r.score, 0) : null;
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
  $("issue").innerHTML = `<b>No. ${issue.issue}</b><br>${fmtDate(issue.date)}`;
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
      <h1 class="no"><small>No.</small>${issue!.issue}</h1>
      <p>Three Maltese numbers. One guess each. Up to 100 points a question.</p>
    </section>
    <div class="tickets">${Q.map((q, i) => `
      <div class="ticket fill ${cat(q.cat)} flip ${i < n ? "done" : ""}" style="--i:${i + 1}">
        <span class="n">${i + 1}</span><span class="t">${esc(q.cat)}</span><span class="d">${esc(q.diff)}</span>
      </div>`).join("")}</div>
    <p class="how rise" style="--i:5">Shorthand works: <code>4.2m</code> <code>250k</code> <code>18%</code>. Every answer comes with its source.</p>`;
  $("dock").innerHTML = `<button class="go" id="start"><span>${n ? "Carry on" : "Play today's three"}</span><span class="arr">→</span></button>`;
  $("start").onclick = () => go(play.results.length >= 3 ? "sum" : "q");
}

/* ---------------- question ---------------- */
function question(i: number) {
  const q = issue!.questions[i];
  $("board").innerHTML = `
    <section class="field fill ${cat(q.cat)} flip">
      <div class="top"><span>${esc(q.cat)}</span><span class="of">${i + 1} of 3 · ${esc(q.diff)}</span></div>
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

/* ---------------- reveal: tiles flip in sequence, then the score pops ---------------- */
function reveal(i: number) {
  const q = issue!.questions[i], r = play.results[i], s = r.score, last = i === 2;
  $("board").innerHTML = `
    <section class="field fill compact ${cat(q.cat)}">
      <div class="top"><span>${esc(q.cat)}</span><span class="of">${i + 1} of 3</span></div>
      <h2>${esc(q.q)}</h2>
    </section>
    <div class="tiles" style="--tone:${tone(s)}">
      <div class="tile flip" style="--i:0"><span class="k">You said</span><span class="v">${q.pre}${short(r.guess)}${q.suf}</span></div>
      <div class="tile ans flip" style="--i:1"><span class="k">Answer</span><span class="v">${exact(q, r.answer.a)}</span></div>
      <div class="tile pts flip" style="--i:2" id="ptile"><span class="k">Points</span><span class="v" id="pts">${s}</span></div>
    </div>
    <div class="verdict rise" style="--tone:${tone(s)};--i:5">${word(s)}</div>
    <div class="rise" style="--i:6">${revealRuler(q.kind, r.answer.a, r.guess)}</div>
    <p class="story rise" style="--i:7">${esc(r.answer.reveal)}</p>
    ${r.answer.why ? `<p class="why rise" style="--i:8">${esc(r.answer.why)}</p>` : ""}
    <div class="cite rise" style="--i:9"><span>Source: <a href="${esc(r.answer.url)}" target="_blank" rel="noopener">${esc(r.answer.src)}</a></span><span class="per">${esc(r.answer.period)}</span></div>`;
  $("dock").innerHTML = `<button class="go" id="next"><span>${last ? "See your score" : "Next question"}</span><span class="arr">→</span></button>`;
  $("next").onclick = () => go(play.results.length >= 3 ? "sum" : "q");
  $<HTMLButtonElement>("next").focus({ preventScroll: true });
  countUp($("pts"), s, calm() ? 0 : 330, () => kick($("ptile"), "pop"));
}

/* ---------------- summary ---------------- */
function shareText() {
  const sc = play.results.map((r) => r.score), tot = sc.reduce((a, b) => a + b, 0);
  const bar = (x: number) => { const f = Math.round(x / 20); return (x >= 80 ? "🟩" : x >= 40 ? "🟨" : "🟥").repeat(f) + "⬜".repeat(5 - f); };
  return { sc, tot, text: `IslandIQ No. ${issue!.issue} · ${tot}/300\n${sc.map((x) => bar(x) + " " + x).join("\n")}\n${location.host || "islandiq.mt"}` };
}

function summary() {
  const { sc, tot } = shareText(), Q = issue!.questions;
  const quip = tot >= 240 ? "A walking NSO release." : tot >= 180 ? "Solid. Your nanna would be proud." : tot >= 110 ? "Respectable. Mostly." : "Tomorrow's a new day.";
  const latest = issue!.issue === issue!.latest;
  $("board").innerHTML = `
    <section class="hero">
      <div class="total"><span class="big" id="total">${tot}</span><span class="of">/300</span></div>
      <p class="quip rise" style="--i:6">${quip}</p>
    </section>
    <div class="lines">${Q.map((q, i) => `
      <div class="line ${cat(q.cat)} flip" style="--i:${i + 1}"><span class="sw"></span>
        <div class="q"><span>${esc(q.cat)}</span><div class="meter"><i style="--w:${sc[i]}%;--i:${i + 1}"></i></div></div>
        <span class="s" style="color:${tone(sc[i])}">${sc[i]}</span></div>`).join("")}</div>
    ${latest ? `<div class="next rise" style="--i:7"><span>Next issue in</span><b id="cd">--:--:--</b></div>` : `<div class="next"><span>Issue ${issue!.issue} of ${issue!.latest}</span><a class="link" href="#">Today's issue</a></div>`}`;
  $("dock").innerHTML = `<button class="go" id="share"><span>Share result</span><span class="arr">↗</span></button>`;
  countUp($("total"), tot, calm() ? 0 : 450, () => kick($("total"), "pop"));

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

/* Count a number up after `delay` ms, then run `after` (the pop). */
function countUp(el: HTMLElement, to: number, delay: number, after: () => void) {
  if (calm() || to === 0) { el.textContent = String(to); if (!calm()) setTimeout(after, delay); return; }
  el.textContent = "0";
  setTimeout(() => {
    const t0 = performance.now(), dur = 650;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step); else after();
    };
    requestAnimationFrame(step);
  }, delay);
}

const fromHash = () => { const n = Number(location.hash.slice(1)); return Number.isInteger(n) && n > 0 ? n : "today" as const; };
window.addEventListener("hashchange", () => open(fromHash()));
open(fromHash());
