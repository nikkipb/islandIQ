import { describe, expect, it } from "vitest";
import { factor, issueScore, roundFactor, validGuess } from "../shared/scoring";
import { parseGuess } from "../shared/parse";
import { issueFor, dateOfIssue } from "../shared/time";
import schedule from "../data/schedule.json";

describe("multiplier scoring", () => {
  it("is 1× when exact", () => expect(factor(4022310, 4022310)).toBe(1));
  it("is symmetric: half and double are both 2×", () => {
    expect(factor(1000, 2000)).toBe(2);
    expect(factor(1000, 500)).toBe(2);
  });
  it("works for percentages too", () => expect(roundFactor(factor(79.2, 70))).toBe(1.13));
  it("does not cap wild misses", () => expect(Math.round(factor(2305968, 3))).toBe(768656));
  it("averages an issue", () => expect(issueScore([1, 2, 3])).toBe(2));
  it("rounds to 2dp under 10×, 1dp under 100×, whole above", () => {
    expect(roundFactor(1.234)).toBe(1.23);
    expect(roundFactor(23.64)).toBe(23.6);
    expect(roundFactor(768655.7)).toBe(768656);
  });
  it("rejects nonsense", () => {
    expect(validGuess("pp", 120)).toBe(false);
    expect(validGuess("pp", 0)).toBe(false);
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
    for (const day of schedule as { cat: string }[][]) {
      expect(day).toHaveLength(3);
      expect(new Set(day.map((q) => q.cat)).size).toBe(3);
    }
  });
  it("never repeats a question", () => {
    const ids = (schedule as { id: string }[][]).flat().map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
