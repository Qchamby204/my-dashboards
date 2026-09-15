"""The Courier production entrypoint.

The active path has no front page. It uses resilient shared story planning, cross-edition story
memory, freshness-gated feeds, adaptive section length, measured audio duration and source health.
"""
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import build as courier
from allocation import adaptive_minutes
from audio_meta import attach_duration, write_feed as write_measured_feed
from dedupe import history_prompt, recent_events
from planning import resilient_plan
from publication import edition
from retire_frontpage import retire
from source_health import SourceHealth, fetch_items as fetch_fresh_items
from story_memory import assign_story_identity, plan_records

_BASE_CLAUDE = courier.claude
_BASE_MAKE_BLOCK = courier.make_block
_BASE_NEWSLETTERS = courier.fetch_newsletters
HEALTH = SourceHealth()


def _manifest():
    return courier.load_manifest()


def _history():
    return recent_events(_manifest(), courier.TODAY)


def _repair_guard():
    if not os.environ.get("COURIER_SECTIONS"):
        return ""
    current = edition(_manifest(), courier.TODAY)
    if not current:
        return ""
    lines = []
    for block in current.get("blocks", []):
        if block.get("id") == "lessons":
            continue
        summary = "; ".join(block.get("talkingPoints", [])[:5]) or block.get("title", "")
        if summary:
            lines.append(f"- {block.get('id')}: {summary}")
    if not lines:
        return ""
    return """

Already published elsewhere in today's Courier:
%s

Repair rule, firm: do not repeat those topics or re-explain their background. Mention one only
when this repaired block has genuinely different context the listener could not get from the
existing block, and move immediately to that distinct angle.
""" % "\n".join(lines)


def claude_with_context(prompt, max_tokens, web_searches=0, label=""):
    if label == "story plan":
        prompt += history_prompt(_history())
    elif os.environ.get("COURIER_SECTIONS") and not label.startswith("lesson "):
        prompt += history_prompt(_history()) + _repair_guard()
    if label == "companies":
        prompt += """

Company-summary quality gate, firm: never retell a news event already owned by another Courier
block. Give at most one clause of orientation, then the company-specific implication. Use fewer
than ten companies if the source material does not support ten genuinely worthwhile updates;
never add filler just to hit a quota.
"""
    return _BASE_CLAUDE(prompt, max_tokens, web_searches=web_searches, label=label)


def fresh_items(feeds, since_hours=26):
    return fetch_fresh_items(
        feeds, courier.feedparser, since_hours=since_hours, health=HEALTH, log=courier.log,
    )


def newsletters_with_health(since_hours=26):
    data = _BASE_NEWSLETTERS(since_hours=since_hours)
    configured = bool(os.environ.get("COURIER_MAIL_USER") and os.environ.get("COURIER_MAIL_PASSWORD"))
    HEALTH.record_newsletters(configured, data)
    return data


def measured_block(slug, label, title, body, points, sources, day_dir, release):
    block = _BASE_MAKE_BLOCK(slug, label, title, body, points, sources, day_dir, release)
    return attach_duration(block, day_dir / f"{slug}.mp3")


def measured_feed(manifest):
    return write_measured_feed(manifest, courier.REPO, courier.MANIFEST)


def write_health(report, *, planning_method="", skipped=None, allocation=None, scores=None):
    path = courier.MANIFEST.parent / "health.json"
    data = json.loads(path.read_text()) if path.exists() else {"schemaVersion": 1, "days": []}
    record = {
        "date": courier.TODAY,
        "checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "planningMethod": planning_method,
        "skippedSections": skipped or [],
        "allocationMinutes": allocation or {},
        "activityScores": scores or {},
        **report,
    }
    data["days"] = [record] + [d for d in data.get("days", []) if d.get("date") != courier.TODAY][:29]
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    return record


def _configure_shared_patches():
    courier.claude = claude_with_context
    courier.fetch_items = fresh_items
    courier.fetch_newsletters = newsletters_with_health
    courier.make_block = measured_block
    courier.write_feed = measured_feed
    courier.FRONT_MINUTES = 0


def repair_main():
    """Use the existing bounded repair path, with freshness, dedupe context and measured runtime."""
    _configure_shared_patches()
    sections = [s for s in os.environ.get("COURIER_SECTIONS", "").split(",") if s]
    courier.repair_sections(sections)
    # Historical front pages are harmless but should never reappear in stored data.
    retire(courier.MANIFEST, courier.MANIFEST.parent / "feed.xml")


def normal_main():
    _configure_shared_patches()
    retire(courier.MANIFEST, courier.MANIFEST.parent / "feed.xml")

    sources = json.loads((courier.HERE / "sources.json").read_text())
    manifest_before = _manifest()
    history = recent_events(manifest_before, courier.TODAY)

    courier.NEWSLETTERS = newsletters_with_health()
    day_dir = courier.OUT / courier.TODAY
    day_dir.mkdir(parents=True, exist_ok=True)
    release = f"courier-{courier.TODAY}"
    failed = []

    courier.log("== Fresh source collection")
    with ThreadPoolExecutor(max_workers=8) as pool:
        items_by_block = dict(zip(
            sources,
            pool.map(lambda slug: fresh_items(sources[slug]["feeds"]), list(sources)),
        ))

    courier.log("== Shared story plan")
    story_plan, planning_method, dropped = resilient_plan(courier, sources, items_by_block, history)
    story_plan = assign_story_identity(story_plan, manifest_before, courier.TODAY)

    weekday = courier.WEEKDAY not in ("sat", "sun")
    allocation, skipped, scores = adaptive_minutes(
        sources, story_plan, items_by_block,
        total_minutes=courier.TOTAL_MINUTES,
        lessons_minutes=courier.LESSONS_MINUTES,
        weekday=weekday,
    )
    courier.log(
        "adaptive time budget: " + ", ".join(
            f"{slug} {minutes:g}" if minutes else f"{slug} skip"
            for slug, minutes in allocation.items()
        )
    )

    def build_block(slug):
        minutes = allocation.get(slug, 0)
        if minutes <= 0:
            return None
        spec = sources[slug]
        courier.log(f"== {spec['label']} start, {minutes:g} min planned")
        try:
            data = courier.write_script(slug, spec, items_by_block.get(slug, []), minutes, story_plan.get(slug))
            body, points = courier.split_talking_points(data["script"])
            block = measured_block(
                slug, spec["label"], data.get("title", spec["label"]), body,
                points, data.get("sources", [])[:20], day_dir, release,
            )
            block["plannedMinutes"] = minutes
            block["storyIds"] = [s.get("storyId") for s in story_plan.get(slug, {}).get("owns", []) if s.get("storyId")]
            courier.log(f"== {spec['label']} done, {block['minutes']} min measured")
            return block
        except Exception as exc:
            courier.log(f"block {slug} failed, skipping it today: {exc}")
            failed.append(slug)
            return None

    blocks = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(build_block, list(sources)))
    blocks.extend(block for block in results if block)

    if weekday:
        courier.log("== Lessons")
        try:
            lessons = courier.write_lessons(courier.LESSONS_MINUTES)
        except Exception as exc:
            courier.log(f"lessons failed, skipping today: {exc}")
            lessons = None
            failed.append("lessons")
        if lessons:
            body = "\n\n".join(
                f"{lesson['label']}{', ' + lesson['sequence'] if lesson['sequence'] else ''}, "
                f"lesson {lesson['index']}: {lesson['title']}.\n\n{lesson['script']}"
                for lesson in lessons
            )
            block = measured_block(
                "lessons", "Lessons", " / ".join(lesson["title"] for lesson in lessons), body,
                [f"{lesson['label']}: {lesson['task']}" for lesson in lessons], [], day_dir, release,
            )
            block["lessons"] = lessons
            block["plannedMinutes"] = courier.LESSONS_MINUTES
            blocks.insert(0, block)

    if not blocks:
        raise RuntimeError("Courier produced no usable blocks")

    total = round(sum(float(block.get("minutes", 0) or 0) for block in blocks), 1)
    cost = courier.estimate_cost(courier.USAGE)
    source_report = HEALTH.report(sources)
    health_record = write_health(
        source_report, planning_method=planning_method, skipped=skipped,
        allocation=allocation, scores=scores,
    )

    expected = (["lessons"] if weekday else []) + [slug for slug in sources if slug not in skipped]
    planned_total = round(sum(allocation.values()) + (courier.LESSONS_MINUTES if weekday else 0), 1)
    day = {
        "date": courier.TODAY,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "release": release,
        "budgetMinutes": courier.TOTAL_MINUTES,
        "plannedMinutes": planned_total,
        "projectedMinutes": total,
        "durationSeconds": round(sum(float(block.get("durationSeconds", 0) or 0) for block in blocks), 1),
        "voiceless": list(courier.VOICELESS),
        "failed": list(dict.fromkeys(failed)),
        "skippedSections": skipped,
        "allocationMinutes": allocation,
        "activityScores": scores,
        "planningMethod": planning_method,
        "duplicatesDropped": dropped,
        "sourceHealth": {
            "degradedSections": health_record.get("degradedSections", []),
            "newsletters": health_record.get("newsletters", {}),
        },
        "usage": {**courier.USAGE, "estimatedCost": round(cost, 2)},
        "plan": plan_records(story_plan),
        "blocks": blocks,
    }
    day.update(courier.gaps(day, expected))

    manifest = manifest_before
    manifest["days"] = [d for d in manifest.get("days", []) if d.get("date") != courier.TODAY]
    manifest["days"].insert(0, day)
    manifest["days"] = manifest["days"][:courier.KEEP_DAYS]
    courier.MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    courier.MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    measured_feed(manifest)
    (courier.OUT / "keep-days.txt").write_text("\n".join(sorted(d["date"] for d in manifest["days"])))

    courier.log(
        f"done: {len(blocks)} blocks, {total} measured min, planning={planning_method}, "
        f"skipped={len(skipped)}, degraded sources={len(source_report['degradedSections'])}, "
        f"est ${cost:.2f}"
        + (f"; FAILED: {', '.join(failed)}" if failed else "")
        + (f"; TEXT ONLY: {', '.join(courier.VOICELESS)}" if courier.VOICELESS else "")
    )


def main():
    if os.environ.get("COURIER_SECTIONS"):
        repair_main()
    else:
        normal_main()


if __name__ == "__main__":
    main()
