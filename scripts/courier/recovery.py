"""Choose a bounded Courier recovery without generating an existing edition again."""
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from publication import edition
from completeness import expected_sections, needed_sections
from automatic import MAX_ATTEMPTS, STATE_PATH, TRIGGER_PATH, attempts

ROOT = Path(__file__).resolve().parents[2]
REQUEST_PATH = "courier/recovery-request.json"
INERT_REQUEST = {"schemaVersion": 1, "date": None, "requestedAt": None, "attempt": 0}


def winnipeg_date(now=None):
    return (now or datetime.now(timezone.utc)).astimezone(ZoneInfo("America/Winnipeg")).date().isoformat()


def build_date(value=None, now=None):
    if not value:
        return winnipeg_date(now)
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Invalid edition date")
    return datetime.strptime(value, "%Y-%m-%d").date().isoformat()


def request_changed(event, run=subprocess.check_output, *, path=REQUEST_PATH):
    before, after = event.get("before", ""), event.get("after", "")
    if not all(re.fullmatch(r"[a-f0-9]{40}", sha) and sha != "0" * 40 for sha in (before, after)):
        raise ValueError("Recovery requires an existing main branch push")
    changed = run(["git", "diff", "--name-only", before, after, "--", path], cwd=ROOT, text=True)
    return path in changed.splitlines()


def automatic_plan(manifest, now, state):
    local = now.astimezone(ZoneInfo("America/Winnipeg"))
    date = local.date().isoformat()
    if local.weekday() >= 5 or (local.hour, local.minute) < (5, 17):
        return {"date": date, "generate": False, "publish": False, "automatic": True,
                "reason": "Outside the weekday edition window"}
    count = attempts(state, date)
    item = edition(manifest, date)
    needed = needed_sections(item) if item else []
    generate = item is None or bool(needed)
    reason = "Automatic missing-section repair" if needed else "Automatic edition check"
    if generate and count >= MAX_ATTEMPTS:
        generate = False
        reason = "Automatic generation limit reached; manual recovery remains available"
    return {"date": date, "generate": generate, "publish": item is not None or generate,
            "automatic": True, "sections": ",".join(needed), "reason": reason}


def choose_plan(manifest, event_name, *, now=None, request=None, publish_only=False,
                daily_trigger=None, automatic_state=None):
    now = now or datetime.now(timezone.utc)
    date = winnipeg_date(now)
    if daily_trigger is not None:
        if request is not None or publish_only:
            raise ValueError("Daily and manual recovery requests cannot be combined")
        # Reuse the strict date/age/weekday/attempt validation of the fallback,
        # but let repository code choose gaps rather than an external agent.
        if not isinstance(daily_trigger, dict) or "sections" in daily_trigger:
            raise ValueError("Daily triggers cannot choose sections")
        validated = choose_plan(manifest, "push", now=now, request=daily_trigger)
        if not validated["publish"]:
            return validated
        return automatic_plan(manifest, now, automatic_state)
    if request is not None:
        # The initial placeholder is inert. A write-authorized connector fills it in.
        if request == INERT_REQUEST:
            return {"date": date, "generate": False, "publish": False, "reason": "No recovery requested"}
        fields = {"schemaVersion", "date", "requestedAt", "attempt"}
        if not isinstance(request, dict) or set(request) not in (fields, fields | {"sections"}):
            raise ValueError("Invalid recovery request fields")
        if "sections" in request:
            sections = request["sections"]
            if (not isinstance(sections, list) or not sections or
                    any(not isinstance(s, str) or s not in expected_sections(date) for s in sections) or
                    len(set(sections)) != len(sections)):
                raise ValueError("Invalid targeted repair sections")
        if type(request["schemaVersion"]) is not int or request["schemaVersion"] != 1 or type(request["attempt"]) is not int or not 1 <= request["attempt"] <= 3:
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
                raise ValueError("Section repair requires an existing edition")
            needed = [s for s in request["sections"] if s in needed_sections(edition(manifest, date))]
            return {"date": date, "generate": bool(needed), "publish": True, "sections": ",".join(needed),
                    "reason": "Repair only " + ", ".join(needed) if needed else "Requested sections already have audio; verify existing edition"}
        return {"date": date, "generate": not exists, "publish": True,
                "reason": "Reuse existing edition and verify publication" if exists else "Recover missing edition"}
    if publish_only or event_name == "push":
        dates = [d["date"] for d in manifest.get("days", []) if edition(manifest, d["date"])]
        if not dates:
            raise ValueError("No existing edition to publish")
        return {"date": max(dates), "generate": False, "publish": True, "reason": "Verify latest existing edition"}
    if event_name not in {"schedule", "workflow_dispatch"}:
        raise ValueError("Unsupported Courier event")
    if event_name == "schedule":
        return automatic_plan(manifest, now, automatic_state)
    exists = edition(manifest, date) is not None
    return {"date": date, "generate": not exists or event_name == "workflow_dispatch", "publish": True,
            "reason": "Manual rebuild" if event_name == "workflow_dispatch" else "Scheduled edition check"}


def main():
    event_name = os.environ["GITHUB_EVENT_NAME"]
    request = None
    daily_trigger = None
    if event_name == "push":
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
        if event.get("ref") != "refs/heads/main":
            raise ValueError("Recovery is only supported on main")
        if request_changed(event):
            request = json.loads(subprocess.check_output(
                ["git", "show", f"{event['after']}:{REQUEST_PATH}"], cwd=ROOT, text=True))
        if request_changed(event, path=TRIGGER_PATH):
            daily_trigger = json.loads(subprocess.check_output(
                ["git", "show", f"{event['after']}:{TRIGGER_PATH}"], cwd=ROOT, text=True))
            # Installing the inert signal is a code publication, not a daily tick.
            if daily_trigger == INERT_REQUEST:
                daily_trigger = None
    manifest = json.loads((ROOT / "courier/manifest.json").read_text())
    state = json.loads((ROOT / STATE_PATH).read_text()) if event_name == "schedule" or daily_trigger is not None else None
    plan = choose_plan(manifest, event_name, request=request, daily_trigger=daily_trigger,
                       automatic_state=state, publish_only=os.environ.get("PUBLISH_ONLY") == "true")
    message = f"Courier {plan['date']}: {plan['reason']}; generate={plan['generate']}; publish={plan['publish']}"
    print(message)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write(message + "\n")
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        for key in ("date", "generate", "publish", "sections", "automatic"):
            value = str(plan[key]).lower() if isinstance(plan.get(key), bool) else plan.get(key, "")
            output.write(f"{key}={value}\n")


if __name__ == "__main__":
    main()
