"""Publish a small status record, without exposing scripts or changing the edition."""
import argparse
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from completeness import expected_sections, gaps
from publication import edition, request_json

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / "courier/status.json"


def snapshot(state, item, date, now=None):
    now = now or datetime.now(timezone.utc).isoformat(timespec="seconds")
    coverage = gaps(item) if item else {"expectedSections": expected_sections(date), "missingSections": expected_sections(date), "voiceless": []}
    complete = not coverage["missingSections"] and not coverage["voiceless"]
    return {"date": date, "state": ("complete" if complete else "partial") if state == "verified" else state,
            "checkedAt": now, "verifiedAt": now if state == "verified" else None,
            "generatedAt": item.get("generatedAt") if item else None,
            "updatedAt": item.get("updatedAt") if item else None,
            "audio": {b["id"]: b.get("audio", "") for b in item["blocks"]} if item else {}, **coverage}


def publish_status(state, item, date):
    record = snapshot(state, item, date)
    status = json.loads(PATH.read_text()) if PATH.exists() else {"schemaVersion": 1, "days": []}
    status["days"] = [record] + [d for d in status["days"] if d["date"] != date][:29]
    PATH.write_text(json.dumps(status, indent=1) + "\n")
    def git(*args):
        subprocess.run(["git", *args], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    git("config", "user.name", "courier-bot")
    git("config", "user.email", "courier-bot@users.noreply.github.com")
    git("add", "courier/status.json")
    git("commit", "-m", f"Courier status: {date} {record['state']}")
    git("pull", "--rebase", "origin", "main")
    git("push", "origin", "HEAD:main")
    repo, token = os.environ["REPO"], os.environ["GH_TOKEN"]
    request_json(f"https://api.github.com/repos/{repo}/pages/builds", token=token, method="POST")
    if state == "verified":
        owner, name = repo.split("/")
        for attempt in range(36):
            try:
                live = request_json(f"https://{owner.lower()}.github.io/{name}/courier/status.json?check={time.time_ns()}")
                if any(d == record for d in live.get("days", [])):
                    return record
            except (OSError, ValueError):
                pass
            if attempt < 35:
                time.sleep(10)
        raise RuntimeError("The edition was verified but its public status has not caught up")
    return record


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("state", choices=["updating", "failed"])
    args = parser.parse_args()
    date = os.environ["COURIER_DATE"]
    manifest = json.loads((ROOT / "courier/manifest.json").read_text())
    publish_status(args.state, edition(manifest, date), date)
