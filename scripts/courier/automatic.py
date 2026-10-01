"""Durable cap for automatic generation, reserved under courier-publication's lock."""
import json
import os
import subprocess
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = "courier/automatic-state.json"
TRIGGER_PATH = "courier/daily-trigger.json"
MAX_ATTEMPTS = 3


def attempts(state, day):
    if (not isinstance(state, dict) or set(state) != {"schemaVersion", "days"}
            or type(state["schemaVersion"]) is not int or state["schemaVersion"] != 1
            or not isinstance(state["days"], list)):
        raise ValueError("Invalid automatic attempt state")
    seen = set()
    count = 0
    for row in state["days"]:
        if not isinstance(row, dict) or set(row) != {"date", "attempts"}:
            raise ValueError("Invalid automatic attempt record")
        value = row["date"]
        if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value or value in seen:
            raise ValueError("Invalid or duplicate automatic attempt date")
        seen.add(value)
        if type(row["attempts"]) is not int or not 1 <= row["attempts"] <= MAX_ATTEMPTS:
            raise ValueError("Invalid automatic attempt count")
        if value == day:
            count = row["attempts"]
    return count


def reserve(state, day):
    count = attempts(state, day)
    if count >= MAX_ATTEMPTS:
        raise ValueError("Automatic generation limit reached; use manual recovery after review")
    return {"schemaVersion": 1, "days": [{"date": day, "attempts": count + 1}]
            + [row for row in state["days"] if row["date"] != day][:29]}


def claim(day, *, root=ROOT, run=subprocess.run, now=None):
    local = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo("America/Winnipeg"))
    if day != local.date().isoformat() or local.weekday() >= 5:
        raise ValueError("Automatic generation date expired")
    path = root / STATE_PATH
    state = reserve(json.loads(path.read_text()), day)
    path.write_text(json.dumps(state, indent=2) + "\n")
    # A failed push stops the job before any model/voice calls. A later failure or
    # cancellation leaves this reservation on main, so another trigger cannot reset it.
    for args in [
        ["config", "user.name", "courier-bot"],
        ["config", "user.email", "courier-bot@users.noreply.github.com"],
        ["add", STATE_PATH],
        ["commit", "-m", f"Courier automatic attempt: {day} {attempts(state, day)}"],
        ["pull", "--rebase", "origin", "main"],
        ["push", "origin", "HEAD:main"],
    ]:
        run(["git", *args], cwd=root, check=True, stdout=subprocess.DEVNULL)
    print(f"Courier {day}: reserved automatic generation attempt {attempts(state, day)}/{MAX_ATTEMPTS}")


if __name__ == "__main__":
    claim(os.environ["COURIER_DATE"])
