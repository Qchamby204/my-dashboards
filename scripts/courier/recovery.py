"""Choose a bounded Courier recovery without generating an existing edition again."""
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from publication import edition

ROOT = Path(__file__).resolve().parents[2]
REQUEST_PATH = "courier/recovery-request.json"


def winnipeg_date(now=None):
    return (now or datetime.now(timezone.utc)).astimezone(ZoneInfo("America/Winnipeg")).date().isoformat()


def build_date(value=None, now=None):
    if not value:
        return winnipeg_date(now)
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Invalid edition date")
    return datetime.strptime(value, "%Y-%m-%d").date().isoformat()


def request_changed(event, run=subprocess.check_output):
    before, after = event.get("before", ""), event.get("after", "")
    if not all(re.fullmatch(r"[a-f0-9]{40}", sha) and sha != "0" * 40 for sha in (before, after)):
        raise ValueError("Recovery requires an existing main branch push")
    changed = run(["git", "diff", "--name-only", before, after, "--", REQUEST_PATH], cwd=ROOT, text=True)
    return REQUEST_PATH in changed.splitlines()


def choose_plan(manifest, event_name, *, now=None, request=None, publish_only=False):
    now = now or datetime.now(timezone.utc)
    date = winnipeg_date(now)
    if request is not None:
        # The initial placeholder is inert. A write-authorized connector fills it in.
        if request == {"schemaVersion": 1, "date": None, "requestedAt": None, "attempt": 0}:
            return {"date": date, "generate": False, "publish": False, "reason": "No recovery requested"}
        fields = {"schemaVersion", "date", "requestedAt", "attempt"}
        if not isinstance(request, dict) or set(request) not in (fields, fields | {"sections"}):
            raise ValueError("Invalid recovery request fields")
        if "sections" in request and request["sections"] != ["sports"]:
            raise ValueError("Only targeted Sports repair is supported")
        if request["schemaVersion"] != 1 or type(request["attempt"]) is not int or not 1 <= request["attempt"] <= 3:
            raise ValueError("Invalid recovery version or attempt")
        if not isinstance(request["date"], str) or not isinstance(request["requestedAt"], str):
            raise ValueError("Recovery requires a date and timestamp")
        build_date(request["date"])
        timestamp = datetime.fromisoformat(request["requestedAt"].replace("Z", "+00:00"))
        if timestamp.tzinfo is None:
            raise ValueError("Recovery timestamp must include a timezone")
        age = (now - timestamp).total_seconds()
        if age < -300:
            raise ValueError("Recovery timestamp is in the future")
        if request["date"] != date or age > 10800 or now.astimezone(ZoneInfo("America/Winnipeg")).weekday() >= 5:
            return {"date": date, "generate": False, "publish": False, "reason": "Recovery request expired or is outside a weekday"}
        exists = edition(manifest, date) is not None
        if "sections" in request:
            if not exists:
                raise ValueError("Sports repair requires an existing edition")
            sports = next((b for b in edition(manifest, date)["blocks"] if b["id"] == "sports"), None)
            needed = not sports or not sports.get("audio")
            return {"date": date, "generate": needed, "publish": True, "sections": "sports" if needed else "",
                    "reason": "Repair only Sports" if needed else "Sports already published; verify existing edition"}
        return {"date": date, "generate": not exists, "publish": True,
                "reason": "Reuse existing edition and verify publication" if exists else "Recover missing edition"}
    if publish_only or event_name == "push":
        dates = [d["date"] for d in manifest.get("days", []) if edition(manifest, d["date"])]
        if not dates:
            raise ValueError("No existing edition to publish")
        return {"date": max(dates), "generate": False, "publish": True, "reason": "Verify latest existing edition"}
    if event_name not in {"schedule", "workflow_dispatch"}:
        raise ValueError("Unsupported Courier event")
    exists = edition(manifest, date) is not None
    return {"date": date, "generate": not exists or event_name == "workflow_dispatch", "publish": True,
            "reason": "Manual rebuild" if event_name == "workflow_dispatch" else "Scheduled edition check"}


def main():
    event_name = os.environ["GITHUB_EVENT_NAME"]
    request = None
    if event_name == "push":
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
        if event.get("ref") != "refs/heads/main":
            raise ValueError("Recovery is only supported on main")
        if request_changed(event):
            request = json.loads((ROOT / REQUEST_PATH).read_text())
    manifest = json.loads((ROOT / "courier/manifest.json").read_text())
    plan = choose_plan(manifest, event_name, request=request, publish_only=os.environ.get("PUBLISH_ONLY") == "true")
    print(f"Courier {plan['date']}: {plan['reason']}; generate={plan['generate']}; publish={plan['publish']}")
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        for key in ("date", "generate", "publish", "sections"):
            value = str(plan[key]).lower() if isinstance(plan.get(key), bool) else plan.get(key, "")
            output.write(f"{key}={value}\n")


if __name__ == "__main__":
    main()
