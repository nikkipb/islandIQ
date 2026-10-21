import { describe, expect, it } from "vitest";
import { score, validGuess } from "../shared/scoring";
import { parseGuess } from "../shared/parse";
import { issueFor, dateOfIssue } from "../shared/time";
import schedule from "../data/schedule.json";

describe("score", () => {
  it("gives 100 for exact answers", () => {
    expect(score("ratio", 4022310, 4022310)).toBe(100);
    expect(score("count", 3, 3)).toBe(100);
    expect(score("pp", 79.2, 79.2)).toBe(100);
  });
  it("is symmetric in ratio terms", () => {
    expect(score("ratio", 1000, 2000)).toBe(score("ratio", 1000, 500));
    expect(score("ratio", 1000, 2000)).toBe(70);
  });
  it("hits zero at the cut-offs", () => {
    expect(score("ratio", 100, 1000)).toBe(0);
    expect(score("count", 3, 9)).toBe(0);
    expect(score("pp", 50, 75)).toBe(0);
  });
  it("rejects nonsense", () => {
    expect(validGuess("pp", 120)).toBe(false);
    expect(validGuess("ratio", 0)).toBe(false);
    expect(validGuess("ratio", Number.NaN)).toBe(false);
  });
});

describe("parseGuess", () => {
  it.each([["4.2m", 4.2e6], ["3,900", 3900], ["18%", 18], ["€1.2bn", 1.2e9], ["520k*0.9", 468000], ["(1+2)*1k", 3000]])("%s", (s, v) => {
    expect(parseGuess(s)).toBeCloseTo(v);
  });
  it("throws on junk", () => expect(() => parseGuess("abc")).toThrow());
});

describe("time", () => {
  it("numbers issues from the epoch", () => {
    expect(issueFor("2026-10-21")).toBe(1);
    expect(dateOfIssue(17)).toBe("2026-11-06");
  });
});

describe("schedule", () => {
  it("has three questions from three categories every day", () => {
    for (const day of schedule as { cat: string; id: string }[][]) {
      expect(day).toHaveLength(3);
      expect(new Set(day.map((q) => q.cat)).size).toBe(3);
    }
  });
  it("never repeats a question", () => {
    const ids = (schedule as { id: string }[][]).flat().map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
