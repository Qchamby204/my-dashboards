"""Adaptive section-length allocation for The Courier."""

_DEFAULT = {
    "markets": 8, "practice": 7, "companies": 7, "manitoba": 5, "politics": 5,
    "climate": 4, "tech": 4, "health": 3, "parenting": 2, "sports": 4,
}
_CORE_FLOOR = {
    "markets": 2.5, "practice": 2.0, "companies": 2.0, "manitoba": 1.5,
    "politics": 1.5, "sports": 1.0,
}
_EXTRA_CAP = {"markets": 3.0, "practice": 2.0, "companies": 2.0}


def _round_half(value):
    return round(value * 2) / 2


def activity_scores(sources, plan, items_by_block):
    scores = {}
    for slug, spec in sources.items():
        block = plan.get(slug, {})
        owns = len(block.get("owns", []))
        callbacks = len(block.get("callbacks", []))
        fresh = len(items_by_block.get(slug, []))
        if spec.get("mode") == "companies":
            # The Ten is no longer a recap surface. Feed volume alone must never buy it airtime;
            # it runs only when the shared plan found distinct company stories for it to own.
            score = (owns * 2.0 + min(2.0, fresh / 8.0)) if owns else 0.0
        else:
            score = owns * 2.0 + callbacks * 0.5 + min(3.0, fresh / 8.0)
        scores[slug] = round(score, 3)
    return scores


def adaptive_minutes(sources, plan, items_by_block, *, total_minutes=60, lessons_minutes=8, weekday=True):
    """Allocate time toward useful sections and allow quiet sections to disappear.

    Returns (minutes_by_section, skipped_sections, scores). Values are half-minute increments.
    """
    scores = activity_scores(sources, plan, items_by_block)
    available = max(0.0, float(total_minutes) - (float(lessons_minutes) if weekday else 0.0))
    active = [slug for slug in sources if scores.get(slug, 0) >= 0.75]
    if not active:
        return {slug: 0.0 for slug in sources}, list(sources), scores

    allocation = {slug: 0.0 for slug in sources}
    caps = {}
    for slug in active:
        base = float(sources[slug].get("minutes", _DEFAULT.get(slug, 4)))
        caps[slug] = base + _EXTRA_CAP.get(slug, 1.0)
        floor = _CORE_FLOOR.get(slug, 0.75)
        allocation[slug] = min(floor, caps[slug])

    # If floors exceed the budget, scale them down rather than forcing filler elsewhere.
    floor_total = sum(allocation.values())
    if floor_total > available and floor_total:
        scale = available / floor_total
        for slug in active:
            allocation[slug] *= scale

    remaining = max(0.0, available - sum(allocation.values()))
    for _ in range(8):
        eligible = [slug for slug in active if allocation[slug] + 0.01 < caps[slug] and scores[slug] > 0]
        if not eligible or remaining <= 0.01:
            break
        total_score = sum(scores[slug] for slug in eligible)
        spent = 0.0
        for slug in eligible:
            share = remaining * scores[slug] / total_score
            room = caps[slug] - allocation[slug]
            add = min(room, share)
            allocation[slug] += add
            spent += add
        if spent <= 0.01:
            break
        remaining -= spent

    for slug in allocation:
        allocation[slug] = _round_half(allocation[slug]) if allocation[slug] >= 0.5 else 0.0

    # Rounding can push us slightly over the cap; trim lowest-value sections first.
    while sum(allocation.values()) > available + 0.01:
        candidates = [slug for slug, minutes in allocation.items() if minutes >= 1.0]
        if not candidates:
            break
        slug = min(candidates, key=lambda s: (scores.get(s, 0), allocation[s]))
        allocation[slug] -= 0.5

    skipped = [slug for slug, minutes in allocation.items() if minutes <= 0]
    return allocation, skipped, scores
