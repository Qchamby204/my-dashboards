"""Persistent story identity and update tracking for The Courier."""
import hashlib
import re
from difflib import SequenceMatcher

from dedupe import number_tokens

_WORD = re.compile(r"[a-z0-9]+")
_GENERIC = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is",
    "it", "its", "of", "on", "or", "that", "the", "this", "to", "was", "were", "will", "with",
    "today", "yesterday", "new", "latest", "update", "updates", "announces", "announced", "says",
    "said", "holds", "hold", "cuts", "cut", "raises", "raise", "after", "before", "amid", "over",
}


def topic_tokens(text):
    return [w for w in _WORD.findall((text or "").lower()) if w not in _GENERIC and not w[0].isdigit()]


def topic_similarity(a, b):
    aa, bb = topic_tokens(a), topic_tokens(b)
    if not aa or not bb:
        return 0.0
    sa, sb = set(aa), set(bb)
    jaccard = len(sa & sb) / len(sa | sb)
    ratio = SequenceMatcher(None, " ".join(aa), " ".join(bb)).ratio()
    return max(jaccard, ratio * 0.9)


def legacy_story_id(event):
    seed = " ".join(topic_tokens(event)) or (event or "story").lower()
    return "story-" + hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]


def recent_story_records(manifest, today, limit_days=6):
    out, days = [], 0
    for day in manifest.get("days", []):
        if day.get("date") == today:
            continue
        records = [p for p in day.get("plan", []) if isinstance(p, dict) and p.get("event")]
        if records:
            for record in records:
                out.append({
                    **record,
                    "date": day.get("date", ""),
                    "storyId": record.get("storyId") or legacy_story_id(record["event"]),
                    "firstSeen": record.get("firstSeen") or day.get("date", ""),
                    "lastSeen": record.get("lastSeen") or day.get("date", ""),
                })
            days += 1
            if days >= limit_days:
                break
    return out


def _best_prior(event, owner, history):
    best, best_score = None, 0.0
    for prior in history:
        score = topic_similarity(event, prior.get("event", ""))
        if prior.get("owner") == owner:
            score += 0.08
        if score > best_score:
            best, best_score = prior, score
    return best if best_score >= 0.63 else None


def _what_changed(previous, current):
    old_nums, new_nums = number_tokens(previous), number_tokens(current)
    if old_nums != new_nums and (old_nums or new_nums):
        before = ", ".join(sorted(old_nums)) or "none stated"
        after = ", ".join(sorted(new_nums)) or "none stated"
        return f"key figures changed: {before} -> {after}"
    return "new development: " + current


def assign_story_identity(plan, manifest, today):
    """Annotate owned stories with stable IDs and NEW/UPDATE status."""
    history = recent_story_records(manifest, today)
    for owner, block in plan.items():
        for story in block.get("owns", []):
            event = story.get("event", "")
            prior = _best_prior(event, owner, history)
            if prior:
                story["storyId"] = prior["storyId"]
                story["firstSeen"] = prior.get("firstSeen") or prior.get("date") or today
                story["lastSeen"] = today
                story["status"] = "UPDATE"
                story["previousEvent"] = prior.get("event", "")
                story["whatChanged"] = _what_changed(prior.get("event", ""), event)
            else:
                story["storyId"] = legacy_story_id(event)
                story["firstSeen"] = today
                story["lastSeen"] = today
                story["status"] = "NEW"
                story["whatChanged"] = ""

    # Propagate the identity to callback/context copies of the same story.
    identities = {s.get("event"): s for b in plan.values() for s in b.get("owns", [])}
    for block in plan.values():
        for key in ("callbacks", "elsewhere", "context"):
            for story in block.get(key, []):
                owner_copy = identities.get(story.get("event"))
                if owner_copy:
                    for field in ("storyId", "firstSeen", "lastSeen", "status", "previousEvent", "whatChanged"):
                        if field in owner_copy:
                            story[field] = owner_copy[field]
    return plan


def plan_records(plan):
    fields = ("storyId", "event", "owner", "status", "firstSeen", "lastSeen", "previousEvent", "whatChanged")
    records = []
    for owner, block in plan.items():
        for story in block.get("owns", []):
            row = {field: story.get(field, "") for field in fields}
            row["owner"] = owner
            records.append(row)
    return records
