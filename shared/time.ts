/** Issue No. 1 goes live at midnight Malta time on this date. */
export const EPOCH = "2026-10-21";

export function maltaParts(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Malta", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { ymd: `${p.year}-${p.month}-${p.day}`, h: +p.hour % 24, m: +p.minute, s: +p.second };
}

/** 1-based issue number for a Malta calendar date. */
export const issueFor = (ymd: string) => Math.round((Date.parse(ymd) - Date.parse(EPOCH)) / 864e5) + 1;

export const dateOfIssue = (n: number) => new Date(Date.parse(EPOCH) + (n - 1) * 864e5).toISOString().slice(0, 10);

/** Seconds until the next Malta midnight. */
export function secondsToNextIssue(d = new Date()) {
  const p = maltaParts(d);
  return 86400 - (p.h * 3600 + p.m * 60 + p.s);
}
