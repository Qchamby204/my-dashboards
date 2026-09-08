"""The expected edition and its gaps, shared by generation and publication."""
import json
from datetime import date
from pathlib import Path


def expected_sections(day, sources=None):
    sources = sources if sources is not None else json.loads(Path(__file__).with_name("sources.json").read_text())
    return ["frontpage"] + (["lessons"] if date.fromisoformat(day).weekday() < 5 else []) + list(sources)


def gaps(item, expected=None):
    expected = expected or item.get("expectedSections") or expected_sections(item["date"])
    blocks = {b["id"]: b for b in item["blocks"]}
    missing = [slug for slug in expected if slug not in blocks]
    voiceless = [slug for slug in expected if slug in blocks and not blocks[slug].get("audio")]
    return {"expectedSections": expected, "missingSections": missing, "voiceless": voiceless}


def needed_sections(item):
    state = gaps(item)
    return [slug for slug in state["expectedSections"] if slug in state["missingSections"] + state["voiceless"]]
