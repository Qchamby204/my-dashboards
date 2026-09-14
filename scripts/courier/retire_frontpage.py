"""Remove the retired Courier front page from stored editions and RSS."""
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / "courier" / "manifest.json"
DEFAULT_FEED = ROOT / "courier" / "feed.xml"

# Stay inside one RSS item. A broad .*? can start at an earlier item and consume it
# while searching forward for the front-page guid.
_FRONT_ITEM = re.compile(
    r"\n?\s*<item>(?:(?!</item>).)*?<guid[^>]*>courier-[^<]*-frontpage</guid>(?:(?!</item>).)*?</item>",
    flags=re.S,
)


def _without_frontpage(values):
    return [v for v in (values or []) if v != "frontpage"]


def retire(manifest_path=DEFAULT_MANIFEST, feed_path=DEFAULT_FEED):
    manifest_path, feed_path = Path(manifest_path), Path(feed_path)
    if not manifest_path.exists():
        return False

    manifest = json.loads(manifest_path.read_text())
    changed = False
    for day in manifest.get("days", []):
        old_expected = list(day.get("expectedSections", []))
        old_blocks = list(day.get("blocks", []))
        kept = [b for b in old_blocks if b.get("id") != "frontpage"]
        removed = [b for b in old_blocks if b.get("id") == "frontpage"]

        if removed:
            day["blocks"] = kept
            day["projectedMinutes"] = round(sum(float(b.get("minutes") or 0) for b in kept), 1)
            changed = True

        for key in ("expectedSections", "missingSections", "voiceless", "failed"):
            if key in day:
                cleaned = _without_frontpage(day.get(key))
                if cleaned != day.get(key):
                    day[key] = cleaned
                    changed = True

        if "frontpage" in old_expected and isinstance(day.get("plannedMinutes"), (int, float)):
            day["plannedMinutes"] = max(0, day["plannedMinutes"] - 3)
            changed = True

    if changed:
        manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")

    if feed_path.exists():
        xml = feed_path.read_text()
        cleaned = _FRONT_ITEM.sub("", xml)
        if cleaned != xml:
            feed_path.write_text(cleaned)
            changed = True
    return changed


def main():
    changed = retire()
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")
    print("Courier front page retired" if changed else "Courier front page already absent")


if __name__ == "__main__":
    main()
