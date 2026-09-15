"""Resilient story planning for The Courier."""
from dedupe import filter_plan, history_prompt, near_duplicate


def empty_plan(sources):
    return {slug: {"owns": [], "callbacks": [], "elsewhere": [], "context": []} for slug in sources}


def stories_to_plan(sources, stories):
    summary = {slug for slug, spec in sources.items() if spec.get("mode") == "companies"}
    plan = empty_plan(sources)
    accepted = []
    for story in stories:
        owner = story.get("owner")
        if owner not in plan or owner in summary or not story.get("event"):
            continue
        if any(near_duplicate(story["event"], prior["event"]) for prior in accepted):
            continue
        story.setdefault("line", story["event"])
        story.setdefault("callbacks", [])
        accepted.append(story)
        plan[owner]["owns"].append(story)
        named = set()
        for cb in story.get("callbacks", [])[:2]:
            target = cb.get("block")
            if target in plan and target != owner and target not in summary:
                named.add(target)
                plan[target]["callbacks"].append({**story, "angle": cb.get("angle", "")})
        for slug in plan:
            if slug == owner or slug in named:
                continue
            plan[slug]["context" if slug in summary else "elsewhere"].append(story)
    return plan


def compact_retry(courier, sources, items_by_block, history):
    owners = [slug for slug, spec in sources.items() if spec.get("mode") != "companies"]
    catalogue = []
    for slug in owners:
        headlines = [i.get("title", "") for i in items_by_block.get(slug, [])[:18] if i.get("title")]
        if headlines:
            catalogue.append(slug + ":\n" + "\n".join("- " + h for h in headlines))
    prompt = f"""Today is {courier.TODAY}. Build a compact ownership map for these Courier headlines.
Collapse duplicate headlines into underlying stories. Keep only meaningful current developments.
Give each story exactly one OWNER from: {', '.join(owners)}. Prefer the most specific owner.
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


def deterministic_plan(sources, items_by_block):
    """No-AI fallback that still guarantees one owner per near-duplicate headline."""
    summary = {slug for slug, spec in sources.items() if spec.get("mode") == "companies"}
    plan = empty_plan(sources)
    accepted = []
    for owner in sources:
        if owner in summary:
            continue
        for item in items_by_block.get(owner, [])[:24]:
            event = (item.get("title") or "").strip()
            if not event or any(near_duplicate(event, prior["event"]) for prior in accepted):
                continue
            story = {"event": event, "owner": owner, "line": event, "callbacks": []}
            accepted.append(story)
            plan[owner]["owns"].append(story)

    for story in accepted:
        owner = story["owner"]
        for slug in plan:
            if slug == owner:
                continue
            plan[slug]["context" if slug in summary else "elsewhere"].append(story)
    return plan


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

    plan, dropped = filter_plan(plan, history)
    if dropped:
        courier.log("duplicate backstop dropped " + str(len(dropped)) + " repeat topic(s): " + "; ".join(dropped[:6]))
    return plan, method, dropped
