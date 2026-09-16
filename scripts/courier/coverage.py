"""Hard cross-section coverage gate for The Courier.

Planning prevents most repetition before writing. This module is the publication backstop: generated
sections are checked against what earlier accepted sections actually cited and said. A block with
material overlap gets one clean rewrite from unique inputs; if it still overlaps, it is skipped rather
than publishing a recap.
"""
from copy import deepcopy

from planning import same_topic


def _clean(text):
    return (text or "").strip()


def coverage_state(accepted):
    """Flatten accepted draft records into URLs and topical phrases."""
    urls, topics = set(), []
    for record in accepted:
        data = record.get("data", record)
        for source in data.get("sources", []) or []:
            url, title = _clean(source.get("url")), _clean(source.get("title"))
            if url:
                urls.add(url)
            if title:
                topics.append(title)
        title = _clean(data.get("title"))
        if title:
            topics.append(title)
        for point in record.get("points", data.get("talkingPoints", [])) or []:
            if _clean(point):
                topics.append(_clean(point))
    return {"urls": urls, "topics": topics}


def _matches_topic(text, topics):
    text = _clean(text)
    return bool(text) and any(same_topic(text, topic) for topic in topics if _clean(topic))


def overlap_report(data, points, accepted):
    """Return explainable overlap metrics for one generated draft."""
    prior = coverage_state(accepted)
    sources = data.get("sources", []) or []
    duplicate_sources = []
    for source in sources:
        url, title = _clean(source.get("url")), _clean(source.get("title"))
        if (url and url in prior["urls"]) or _matches_topic(title, prior["topics"]):
            duplicate_sources.append(title or url)
    duplicate_points = [point for point in (points or []) if _matches_topic(point, prior["topics"])]
    source_ratio = len(duplicate_sources) / len(sources) if sources else 0.0
    point_ratio = len(duplicate_points) / len(points) if points else 0.0
    # Two repeated cited stories is enough to warrant a rewrite. A majority-overlap section is
    # rejected even with sparse source metadata. One incidental callback is allowed.
    material = (
        len(duplicate_sources) >= 2
        or source_ratio >= 0.5 and bool(duplicate_sources)
        or len(duplicate_points) >= 2
        or point_ratio >= 0.6 and bool(duplicate_points)
    )
    return {
        "material": material,
        "duplicateSources": duplicate_sources,
        "duplicateTalkingPoints": duplicate_points,
        "sourceRatio": round(source_ratio, 3),
        "pointRatio": round(point_ratio, 3),
    }


def filter_items(items, accepted):
    """Remove feed items already covered by an accepted section."""
    prior = coverage_state(accepted)
    kept = []
    for item in items or []:
        url, title = _clean(item.get("url")), _clean(item.get("title"))
        if url and url in prior["urls"]:
            continue
        if _matches_topic(title, prior["topics"]):
            continue
        kept.append(item)
    return kept


def prune_plan(block_plan, accepted):
    """Remove already-covered stories from a block plan and turn them into hard bans."""
    if not block_plan:
        return block_plan
    prior = coverage_state(accepted)
    out = deepcopy(block_plan)
    removed = []
    for key in ("owns", "callbacks"):
        kept = []
        for story in out.get(key, []) or []:
            if _matches_topic(story.get("event", ""), prior["topics"]):
                removed.append(story)
            else:
                kept.append(story)
        out[key] = kept
    bans = list(out.get("elsewhere", []) or []) + list(out.get("context", []) or []) + removed
    unique = []
    for story in bans:
        event = _clean(story.get("event"))
        if event and not any(same_topic(event, old.get("event", "")) for old in unique):
            unique.append(story)
    out["elsewhere"] = unique
    out["context"] = []
    return out


def has_publishable_assignment(block_plan):
    """A repaired section may publish only if it still owns or has a legitimate callback."""
    if not block_plan:
        return False
    return bool(block_plan.get("owns") or block_plan.get("callbacks"))
