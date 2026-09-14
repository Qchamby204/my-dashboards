"""Courier entrypoint: no front page, plus cross-edition topic deduplication."""
import os

import build as courier
from dedupe import filter_plan, history_prompt, recent_events
from publication import edition
from retire_frontpage import retire

_BASE_CLAUDE = courier.claude
_BASE_PLAN_STORIES = courier.plan_stories
_BASE_MAKE_BLOCK = courier.make_block


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
        if block.get("id") in {"frontpage", "lessons"}:
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


def claude_with_dedupe(prompt, max_tokens, web_searches=0, label=""):
    if label == "story plan":
        prompt += history_prompt(_history())
    elif os.environ.get("COURIER_SECTIONS") and label not in {"front page"} and not label.startswith("lesson "):
        prompt += history_prompt(_history()) + _repair_guard()
    return _BASE_CLAUDE(prompt, max_tokens, web_searches=web_searches, label=label)


def plan_stories_with_backstop(sources, items_by_block):
    plan = _BASE_PLAN_STORIES(sources, items_by_block)
    plan, dropped = filter_plan(plan, _history())
    if dropped:
        courier.log("duplicate backstop dropped " + str(len(dropped)) + " repeat topic(s): "
                    + "; ".join(dropped[:6]))
    return plan


def front_page_disabled(blocks, minutes):
    # build.main still expects a return value here. This creates no model or TTS work;
    # the compatibility block is removed from the manifest immediately after generation.
    return {"title": "", "script": ""}


def make_block_without_frontpage(slug, label, title, body, points, sources, day_dir, release):
    if slug == "frontpage":
        return {
            "id": "frontpage", "label": "Front page", "title": "",
            "audio": "", "bytes": 0, "script": "", "talkingPoints": [],
            "sources": [], "words": 0, "minutes": 0,
        }
    return _BASE_MAKE_BLOCK(slug, label, title, body, points, sources, day_dir, release)


def main():
    # Remove the front page from both runtime budget and generation cost.
    courier.FRONT_MINUTES = 0
    courier.claude = claude_with_dedupe
    courier.plan_stories = plan_stories_with_backstop
    courier.write_front_page = front_page_disabled
    courier.make_block = make_block_without_frontpage

    courier.main()

    # Strip the compatibility block plus any historical front pages from storage/RSS.
    if retire(courier.MANIFEST, courier.MANIFEST.parent / "feed.xml"):
        courier.log("front page removed from manifest and feed")


if __name__ == "__main__":
    main()
