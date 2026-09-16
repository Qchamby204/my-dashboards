"""Resilient story planning for The Courier."""
from copy import deepcopy

from dedupe import filter_plan, history_prompt, near_duplicate
from story_memory import topic_similarity, topic_tokens

_WEAK_BIGRAMS = {
    ("ai", "model"), ("artificial", "intelligence"), ("prime", "minister"),
    ("real", "estate"), ("stock", "market"),
}
_MACRO_WORDS = {
    "inflation", "rates", "rate", "yield", "yields", "economy", "economic", "tariff", "tariffs",
    "housing", "home", "sales", "tax", "taxes", "government", "ottawa", "budget", "deficit",
    "currency", "dollar", "loonie", "oil", "crude", "investment", "summit",
}
# Deterministic fallback should favour the narrowest desk instead of whichever desk happens
# to appear first in sources.json. Markets is deliberately last because it has the broadest remit.
_OWNER_PRIORITY = (
    "manitoba", "practice", "climate", "tech", "health", "parenting", "sports",
    "politics", "companies", "markets",
)


def empty_plan(sources):
    return {slug: {"owns": [], "callbacks": [], "elsewhere": [], "context": []} for slug in sources}


def _bigrams(text):
    tokens = topic_tokens(text)
    return {(tokens[i], tokens[i + 1]) for i in range(len(tokens) - 1)} - _WEAK_BIGRAMS


def same_topic(a, b):
    """Same underlying daily-news event, not merely near-identical wording.

    The previous check was excellent for duplicate headlines but too strict for one event written
    from different desks: e.g. "home sales fall" vs "home sales drop", or several Canada
    Investment Summit angles. Shared meaningful phrases and three-token overlap close that gap.
    """
    if near_duplicate(a, b) or topic_similarity(a, b) >= 0.72:
        return True
    aa, bb = set(topic_tokens(a)), set(topic_tokens(b))
    if not aa or not bb:
        return False
    shared = aa & bb
    if len(shared) >= 3 and len(shared) / max(1, min(len(aa), len(bb))) >= 0.38:
        return True
    return bool(_bigrams(a) & _bigrams(b))


def _rebuild_relations(sources, plan):
    """Rebuild cross-block bans from the final ownership map.

    `context` is intentionally retired for summary surfaces: a story is either owned here,
    a tightly scoped callback, or already covered elsewhere. That removes the architectural
    permission The Ten previously had to recap every other block.
    """
    clean = empty_plan(sources)
    for owner in sources:
        for story in plan.get(owner, {}).get("owns", []):
            story = deepcopy(story)
            story["owner"] = owner
            clean[owner]["owns"].append(story)

    for owner, block in clean.items():
        for story in block["owns"]:
            named = set()
            for cb in story.get("callbacks", [])[:2]:
                target = cb.get("block")
                if target in clean and target != owner:
                    named.add(target)
                    clean[target]["callbacks"].append({**deepcopy(story), "angle": cb.get("angle", "")})
            for slug in clean:
                if slug == owner or slug in named:
                    continue
                clean[slug]["elsewhere"].append(deepcopy(story))
    return clean


def stories_to_plan(sources, stories):
    plan = empty_plan(sources)
    accepted = []
    for story in stories:
        owner = story.get("owner")
        if owner not in plan or not story.get("event"):
            continue
        if any(same_topic(story["event"], prior["event"]) for prior in accepted):
            continue
        story = deepcopy(story)
        story.setdefault("line", story["event"])
        story.setdefault("callbacks", [])
        story["owner"] = owner
        accepted.append(story)
        plan[owner]["owns"].append(story)
    return _rebuild_relations(sources, plan)


def compact_retry(courier, sources, items_by_block, history):
    owners = list(sources)
    catalogue = []
    for slug in owners:
        headlines = [i.get("title", "") for i in items_by_block.get(slug, [])[:18] if i.get("title")]
        if headlines:
            catalogue.append(slug + ":\n" + "\n".join("- " + h for h in headlines))
    prompt = f"""Today is {courier.TODAY}. Build a compact ownership map for these Courier headlines.
Collapse duplicate headlines and different headlines about the same underlying event into one story.
Keep only meaningful current developments. Give each story exactly one OWNER from: {', '.join(owners)}.
Prefer the narrowest desk: Manitoba/local to manitoba, advisor/regulatory/tax to practice,
company-specific corporate news to companies, technology-specific news to tech, political decisions
to politics, and broad macro/market moves to markets. The Ten is NOT a recap surface.
Do not invent facts or add stories not present below.
{history_prompt(history)}

HEADLINES
{chr(10).join(catalogue)}

Return only records in this exact format:
STORY: one sentence
OWNER: block slug
LINE: one sentence other blocks may assume was already heard
---
"""
    raw = courier.claude(prompt, 4000, web_searches=0, label="story plan retry")
    stories = courier.parse_plan(raw)
    if not stories:
        raise ValueError("compact story-plan retry returned no usable stories")
    return stories_to_plan(sources, stories)


def _priority(sources):
    known = [slug for slug in _OWNER_PRIORITY if slug in sources]
    return known + [slug for slug in sources if slug not in known]


def deterministic_plan(sources, items_by_block):
    """No-AI fallback with event-family clustering and specific-desk precedence."""
    plan = empty_plan(sources)
    accepted = []
    for owner in _priority(sources):
        for item in items_by_block.get(owner, [])[:24]:
            event = (item.get("title") or "").strip()
            if not event or any(same_topic(event, prior["event"]) for prior in accepted):
                continue
            story = {"event": event, "owner": owner, "line": event, "callbacks": []}
            accepted.append(story)
            plan[owner]["owns"].append(story)
    return _rebuild_relations(sources, plan)


def _looks_macro(event):
    return len(set(topic_tokens(event)) & _MACRO_WORDS) >= 2


def rebalance_companies(sources, items_by_block, plan, limit=10):
    """Give The Ten distinct company stories instead of a licence to recap other desks.

    Primary planner versions predating this rule may still return companies with zero ownership.
    This pass adds genuinely distinct company-feed stories. It can reclaim a broad-markets story
    only when the item does not look macro; policy, rates, housing and summit stories stay outside
    The Ten even if they appeared in its overlapping business feeds.
    """
    company_slugs = [slug for slug, spec in sources.items() if spec.get("mode") == "companies"]
    if not company_slugs:
        return plan
    out = deepcopy(plan)
    owned = [(slug, story) for slug, block in out.items() for story in block.get("owns", [])]

    for slug in company_slugs:
        company_owns = list(out.get(slug, {}).get("owns", []))
        for item in items_by_block.get(slug, [])[:30]:
            if len(company_owns) >= limit:
                break
            event = (item.get("title") or "").strip()
            if not event or _looks_macro(event):
                continue
            match = next(((owner, story) for owner, story in owned if same_topic(event, story.get("event", ""))), None)
            if match:
                owner, story = match
                if owner == "markets" and not _looks_macro(story.get("event", "")):
                    out[owner]["owns"] = [s for s in out[owner]["owns"] if s is not story]
                    moved = deepcopy(story)
                    moved["owner"] = slug
                    company_owns.append(moved)
                    owned = [(o, s) for o, s in owned if s is not story]
                    owned.append((slug, moved))
                continue
            story = {"event": event, "owner": slug, "line": event, "callbacks": []}
            company_owns.append(story)
            owned.append((slug, story))
        out[slug]["owns"] = company_owns
    return _rebuild_relations(sources, out)


def resilient_plan(courier, sources, items_by_block, history):
    """Primary planner -> smaller planner -> deterministic planner. Never returns unplanned."""
    try:
        plan = courier.plan_stories(sources, items_by_block)
        method = "primary"
    except Exception as first_error:
        courier.log(f"story planning failed, retrying compact planner: {first_error}")
        try:
            plan = compact_retry(courier, sources, items_by_block, history)
            method = "compact-retry"
        except Exception as second_error:
            courier.log(f"story planning retry failed, using deterministic ownership: {second_error}")
            plan = deterministic_plan(sources, items_by_block)
            method = "deterministic"

    plan = rebalance_companies(sources, items_by_block, plan)
    plan, dropped = filter_plan(plan, history)
    if dropped:
        courier.log("duplicate backstop dropped " + str(len(dropped)) + " repeat topic(s): " + "; ".join(dropped[:6]))
    return plan, method, dropped
