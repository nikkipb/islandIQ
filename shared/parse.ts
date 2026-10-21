/**
 * Turns what players type into a number: "4.2m", "3,900", "18%", "€1.2bn", "520k*0.9".
 * Supports + - * / and brackets so people can do napkin maths in the box.
 */
export class ParseError extends Error {}

const BAD = "Use digits, plus k, m or bn.";

export function parseGuess(raw: string): number | null {
  const s = raw.toLowerCase().replace(/[,\s€%]/g, "").replace(/×|x/g, "*");
  if (!s) return null;
  const toks: (number | string)[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if ("+-*/()".includes(c)) { toks.push(c); i++; continue; }
    const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(billion|bn|b|million|mn|m|thousand|k)?/);
    if (!m) throw new ParseError(BAD);
    let v = parseFloat(m[1]);
    const u = m[2];
    if (u) v *= /^b/.test(u) ? 1e9 : /^m/.test(u) ? 1e6 : 1e3;
    toks.push(v);
    i += m[0].length;
  }
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") { const o = next(), r = term(); v = o === "+" ? v + r : v - r; }
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") { const o = next(), r = factor(); v = o === "*" ? v * r : v / r; }
    return v;
  };
  const factor = (): number => {
    const t = next();
    if (t === "(") { const v = expr(); if (next() !== ")") throw new ParseError("Close the bracket."); return v; }
    if (t === "-") return -factor();
    if (typeof t === "number") return t;
    throw new ParseError(BAD);
  };
  const v = expr();
  if (p !== toks.length || !Number.isFinite(v)) throw new ParseError(BAD);
  if (v < 0) throw new ParseError("Guess a positive number.");
  return v;
}
