"""Verify Courier at its public URL, not just in the repository. No generation calls."""
import argparse
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

MANIFEST = Path(__file__).resolve().parents[2] / "courier" / "manifest.json"


def edition(manifest, date):
    days = manifest.get("days", [])
    if not isinstance(days, list):
        raise ValueError("The manifest has no valid edition list")
    item = next((d for d in days if isinstance(d, dict) and d.get("date") == date), None)
    if not item:
        return None
    blocks = item.get("blocks")
    if not item.get("generatedAt") or not isinstance(blocks, list) or not blocks:
        raise ValueError("The edition is empty or incomplete")
    ids = set()
    for block in blocks:
        if not isinstance(block, dict) or not block.get("id") or block["id"] in ids or not block.get("script"):
            raise ValueError("The edition has invalid or duplicate sections")
        ids.add(block["id"])
    return item


def request_json(url, *, token=None, method="GET"):
    headers = {"Accept": "application/json", "Cache-Control": "no-cache", "User-Agent": "courier-publication"}
    if token:
        if urlparse(url).netloc != "api.github.com":
            raise ValueError("Credentials may only be sent to the GitHub API")
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, headers=headers, method=method, data=b"{}" if method == "POST" else None)
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def probe_audio(url, repo):
    parsed = urlparse(url)
    path = re.fullmatch(r"/gh/" + re.escape(repo) + r"@(courier-audio|[a-f0-9]{40})/\d{4}-\d{2}-\d{2}/[A-Za-z0-9_-]+\.mp3", parsed.path)
    if parsed.scheme != "https" or parsed.netloc != "cdn.jsdelivr.net" or not path:
        raise ValueError("Audio URL is outside this repository's Courier publication")
    # Read a tiny range: detect unavailable CDN files without downloading the edition.
    with urlopen(Request(url, headers={"Range": "bytes=0-63", "User-Agent": "courier-publication"}), timeout=30) as response:
        content_type = response.headers.get("Content-Type", "").split(";")[0]
        head = response.read(64)
    if not head or content_type not in {"audio/mpeg", "audio/mp3", "application/octet-stream"}:
        raise ValueError("An advertised audio file is not available as audio")


def pin_audio(manifest, date, repo, sha):
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        raise ValueError("A full audio commit SHA is required")
    item = edition(manifest, date)
    if not item:
        raise ValueError("The generated edition is missing")
    replacements = {}
    prefix = f"https://cdn.jsdelivr.net/gh/{repo}@courier-audio/{date}/"
    for block in item["blocks"]:
        url = block.get("audio")
        if url:
            if not url.startswith(prefix):
                # A targeted repair keeps the existing sections on their immutable
                # audio URLs and pins only the newly generated section.
                if re.fullmatch(r"https://cdn\.jsdelivr\.net/gh/" + re.escape(repo) + r"@[a-f0-9]{40}/" + re.escape(date) + r"/[A-Za-z0-9_-]+\.mp3", url):
                    continue
                raise ValueError("Generated audio is outside this edition")
            block["audio"] = url.replace("@courier-audio/", f"@{sha}/", 1)
            replacements[url] = block["audio"]
    return replacements


def publish(manifest, date, repo, token, *, request=request_json, probe=probe_audio, pause=time.sleep, attempts=36):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
        raise ValueError("Invalid repository")
    expected = edition(manifest, date)
    if not expected:
        raise ValueError("The requested edition has not been generated")
    owner, name = repo.split("/")
    url = f"https://{owner.lower()}.github.io/{name}/courier/manifest.json"
    # An accepted request is not proof that the edition is visible.
    request(f"https://api.github.com/repos/{repo}/pages/builds", token=token, method="POST")
    for attempt in range(attempts):
        try:
            live = request(f"{url}?courier-check={time.time_ns()}")
            if edition(live, date) != expected:
                raise ValueError("The live edition has not caught up with this build")
            for block in expected["blocks"]:
                if block.get("audio"):
                    probe(block["audio"], repo)
            return expected
        except (OSError, ValueError):
            if attempt + 1 == attempts:
                raise RuntimeError("Publication could not be verified: the live edition or an audio file is unavailable. The backstop can retry without regenerating content.") from None
            pause(10)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["latest", "check", "pin", "publish"])
    parser.add_argument("--date")
    parser.add_argument("--audio-sha")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"days": []}
    if args.command == "latest":
        dates = [d["date"] for d in manifest.get("days", []) if edition(manifest, d["date"])]
        if not dates:
            raise ValueError("No existing edition to publish")
        print(max(dates))
    elif args.command == "check":
        # Broken records must fail visibly; do not silently pay to replace them.
        print("yes" if edition(manifest, args.date) else "no")
    elif args.command == "pin":
        replacements = pin_audio(manifest, args.date, os.environ["REPO"], args.audio_sha or "")
        feed = MANIFEST.with_name("feed.xml")
        xml = feed.read_text()
        for old, new in replacements.items():
            xml = xml.replace(old, new)
        MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
        feed.write_text(xml)
    else:
        item = publish(manifest, args.date, os.environ["REPO"], os.environ["GH_TOKEN"])
        from status import publish_status
        record = publish_status("verified", item, args.date)
        audio = sum(bool(b.get("audio")) for b in item["blocks"])
        message = f"Courier {args.date}: live edition verified; {audio} audio sections, {len(item['blocks']) - audio} text-only sections; {record['state'].upper()}."
        if record["missingSections"]:
            message += " Missing sections: " + ", ".join(record["missingSections"]) + "."
        print(message)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
                summary.write(message + "\n")


if __name__ == "__main__":
    main()
