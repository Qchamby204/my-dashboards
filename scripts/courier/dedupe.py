"""Cross-edition topic deduplication for The Courier."""
import re
from difflib import SequenceMatcher

_WORD = re.compile(r"[a-z0-9]+")
_NUMBER = re.compile(r"(?<!\w)\d+(?:\.\d+)?%?(?!\w)")
_STOP = {
    "a","an","and","are","as","at","be","by","for","from","has","have","in","is","it","its",
    "of","on","or","that","the","this","to","was","were","will","with","today","yesterday",
}


def normalize(text):
    return " ".join(w for w in _WORD.findall((text or "").lower()) if w not in _STOP)


def number_tokens(text):
    return set(_NUMBER.findall((text or "").lower()))


def near_duplicate(a, b):
    """True only for near-repeats. Materially changed numbers count as new context."""
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    nums_a, nums_b = number_tokens(a), number_tokens(b)
    if nums_a and nums_b and nums_a != nums_b:
        return False
    ta, tb = set(na.split()), set(nb.split())
    if len(ta) < 4 or len(tb) < 4:
        return SequenceMatcher(None, na, nb).ratio() >= 0.96
    overlap = len(ta & tb) / len(ta | tb)
    ratio = SequenceMatcher(None, na, nb).ratio()
    return ratio >= 0.93 or overlap >= 0.88


def recent_events(manifest, today, limit_days=6):
    """Return recent planned stories, excluding the edition currently being rebuilt."""
    out, seen_days = [], 0
    for day in manifest.get("days", []):
        if day.get("date") == today:
            continue
        events = [
            {"date": day.get("date", ""), "owner": p.get("owner", ""), "event": p.get("event", "")}
            for p in day.get("plan", [])
            if isinstance(p, dict) and p.get("event")
        ]
        if not events:
            events = [
                {"date": day.get("date", ""), "owner": b.get("id", ""), "event": b.get("title", "")}
                for b in day.get("blocks", [])
                if b.get("id") not in {"frontpage", "lessons"} and b.get("title")
            ]
        if events:
            out.extend(events)
            seen_days += 1
            if seen_days >= limit_days:
                break
    return out


def history_prompt(events):
    if not events:
        return ""
    lines = "\n".join(
        f"- {e.get('date','')} | {e.get('owner','')} | {e.get('event','')}"
        for e in events[:80]
    )
    return f"""
Recent Courier coverage, used only to prevent stale repeats:
{lines}

Freshness rule, firm:
- Do not schedule an underlying story that was already explained in recent coverage merely
  because another outlet repeats it, somebody reacts to it, or there is a recap.
- Reuse a subject only when today has MATERIAL NEW CONTEXT: a new decision, action, result,
  filing, data release, price move, milestone, injury, trade, ruling, or other development that
  changes what the listener knows or should do.
- If there is material new context, the STORY line must say what is new. A new opinion,
  restatement, summary, or minor follow-on is not enough.
"""


def filter_plan(plan, history):
    """Drop literal/near-literal repeats after the semantic planner has made its decision."""
    dropped, accepted = [], []
    owner_records = []
    for slug, block in plan.items():
        for story in block.get("owns", []):
            owner_records.append((slug, story))

    for slug, story in owner_records:
        event = story.get("event", "")
        duplicate_of = next((h for h in history if near_duplicate(event, h.get("event", ""))), None)
        if duplicate_of is None:
            duplicate_of = next((s for s in accepted if near_duplicate(event, s)), None)
        if duplicate_of is not None:
            dropped.append(event)
        else:
            accepted.append(event)

    if not dropped:
        return plan, []

    dropped_set = set(dropped)
    for block in plan.values():
        for key in ("owns", "callbacks", "elsewhere", "context"):
            block[key] = [s for s in block.get(key, []) if s.get("event") not in dropped_set]
    return plan, dropped
