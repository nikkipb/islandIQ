"""
Build data/schedule.json from the question bank spreadsheet.

    python3 scripts/build_schedule.py content/questions.xlsx data/schedule.json

- Reads the "Question Bank" sheet (columns as in the co-founders' workbook).
- Skips rows whose Editorial status starts with "Rejected" or whose ID is in SKIP.
- Issues that have already gone out (up to today's issue, Malta time) are FROZEN:
  they are copied from the existing schedule.json unchanged, so editing the bank
  never alters a past puzzle. Only future issues are re-planned.
- Each issue gets 3 questions from 3 different categories and 3 different sources,
  with at least one Medium question when the pool allows; Medium goes first.

Needs: pip install openpyxl
"""
import json, random, sys, datetime, zoneinfo, os

EPOCH = datetime.date(2026, 10, 21)          # keep in sync with shared/time.ts
SKIP = {"IQ035", "IQ028"}                    # index level not guessable; duplicate of IQ027

def load_bank(path):
    import openpyxl
    ws = openpyxl.load_workbook(path, data_only=True)["Question Bank"]
    rows = list(ws.iter_rows(values_only=True))
    head = rows[0]
    out = []
    for r in rows[1:]:
        q = dict(zip(head, r))
        if not q.get("ID") or q["ID"] in SKIP:
            continue
        if str(q.get("Editorial status") or "").lower().startswith("rejected"):
            continue
        guide = str(q["Scoring guidance"]).lower()
        kind = "pp" if guide.startswith("percentage-point") else "ratio" if guide.startswith("relative") else "count"
        a, unit, pre, suf = float(q["Answer"]), q["Unit"], "", ""
        if unit in ("euros", "euros per tourist"):
            pre = "€"
        if unit == "€ million":
            pre, a, unit = "€", a * 1e6, "euros"
        if unit == "percent":
            suf = "%"
        for col in ("Question", "Reveal", "Source", "Source URL"):
            if not q.get(col):
                sys.exit(f"{q['ID']}: missing {col}")
        out.append(dict(id=q["ID"], cat=q["Category"], diff=q["Difficulty"], q=q["Question"], a=a, unit=unit,
                        pre=pre, suf=suf, kind=kind, reveal=q["Reveal"], why=q["Why interesting"] or "",
                        period=str(q["Reference period"] or ""), src=q["Source"], url=q["Source URL"]))
    return out

def plan(pool, seed_start=0):
    for seed in range(seed_start, seed_start + 20000):
        rnd = random.Random(seed)
        left = pool[:]
        rnd.shuffle(left)
        days = []
        while len(left) >= 3:
            day = []
            for q in left:
                if all(q["cat"] != d["cat"] and q["src"] != d["src"] for d in day):
                    day.append(q)
                if len(day) == 3:
                    break
            if len(day) < 3:
                break
            mediums_left = sum(p["diff"] == "Medium" for p in left)
            if not any(d["diff"] == "Medium" for d in day) and mediums_left * 3 >= len(left):
                break
            for d in day:
                left.remove(d)
            day.sort(key=lambda d: d["diff"] != "Medium")
            days.append(day)
        if len(left) < 3:
            return days, left
    sys.exit("Could not build a schedule; the bank needs more category variety.")

def main(src, dst):
    bank = load_bank(src)
    today = datetime.datetime.now(zoneinfo.ZoneInfo("Europe/Malta")).date()
    live = max(0, (today - EPOCH).days + 1)
    old = json.load(open(dst)) if os.path.exists(dst) else []
    frozen = old[:live]
    used = {q["id"] for d in frozen for q in d}
    days, spare = plan([q for q in bank if q["id"] not in used])
    sched = frozen + days
    json.dump(sched, open(dst, "w"), ensure_ascii=False, indent=1)
    print(f"{len(bank)} questions -> {len(sched)} issues ({len(frozen)} frozen, {len(days)} planned, "
          f"{len(spare)} unscheduled: {[q['id'] for q in spare]})")
    last = EPOCH + datetime.timedelta(days=len(sched) - 1)
    print(f"Content runs out after issue {len(sched)} ({last}). Add questions before then.")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
