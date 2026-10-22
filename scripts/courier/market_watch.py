"""Render a short release watchlist from the writer's dated, cited primary-source entries."""
import json
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

MAX_WORDS = 70  # Half a minute at Courier's 140-word planning pace.
AUTHORITIES = {"bankofcanada.ca": "the Bank of Canada", "statcan.gc.ca": "Statistics Canada",
               "federalreserve.gov": "the Federal Reserve", "bls.gov": "the Bureau of Labor Statistics",
               "bea.gov": "the Bureau of Economic Analysis"}
EMPTY = "What to watch next. No upcoming release dates were verified for this edition."
FORMAT = """
WATCH_NEXT:
A JSON array of zero, one or two verified upcoming economic releases or central-bank decisions.
Each object has: name (short event name), date (YYYY-MM-DD), why (one brief sentence
on why the result matters), source (an exact HTTPS URL also listed under SOURCES).
For a release today, also supply time (HH:MM, 24-hour) and timezone (IANA, such as
America/New_York or America/Toronto), verified from the original schedule. Omit today's
event if its future release time cannot be verified. For later dates, time/timezone are optional.
Use original schedules on bankofcanada.ca, statcan.gc.ca, federalreserve.gov, bls.gov or bea.gov.
Verify the event's date on that source; never infer a date from a usual release pattern.
Choose events within the next seven days, including today's still-upcoming releases.
Do not include events that have already happened, forecasts presented as outcomes, or trade advice.
Use [] when no dates can be verified. Keep the eventual spoken close under 70 words.
Do not put this close inside SCRIPT or Talking points; it is appended separately.
"""


def render_watch(raw, edition_date, sources, *, now=None):
    """Reject malformed, unsupported, uncited, past and distant entries; never invent replacements."""
    try:
        entries = json.loads(raw) if isinstance(raw, str) else raw
    except (TypeError, ValueError):
        return EMPTY, []
    if not isinstance(entries, list):
        return EMPTY, []
    today = date.fromisoformat(edition_date)
    now = now or datetime.now(timezone.utc)
    local_day = now.astimezone(ZoneInfo("America/Winnipeg")).date()
    cited = {source.get("url") for source in sources}
    accepted, seen = [], set()
    text = "What to watch next."
    for entry in entries[:2]:
        fields = {"name", "date", "why", "source"}
        if not isinstance(entry, dict) or set(entry) not in (fields, fields | {"time", "timezone"}):
            continue
        if not all(isinstance(value, str) and value.strip() for value in entry.values()):
            continue
        name, why, url = entry["name"].strip(), entry["why"].strip(), entry["source"]
        if len(name) > 120 or len(why) > 300 or "\n" in name or "\n" in why:
            continue
        try:
            when = date.fromisoformat(entry["date"])
            parsed = urlparse(url)
        except ValueError:
            continue
        host = (parsed.hostname or "").lower()
        authority = next((label for domain, label in AUTHORITIES.items()
                          if host == domain or host.endswith("." + domain)), None)
        if not authority or parsed.scheme != "https" or url not in cited:
            continue
        if not today <= when <= today + timedelta(days=7) or (name.lower(), when) in seen:
            continue
        if when < local_day:
            continue
        if "time" in entry:
            if entry["timezone"] not in {"America/New_York", "America/Toronto", "America/Winnipeg", "UTC"}:
                continue
            try:
                scheduled = datetime.strptime(entry["date"] + "T" + entry["time"], "%Y-%m-%dT%H:%M").replace(
                    tzinfo=ZoneInfo(entry["timezone"]))
            except ValueError:
                continue
            if scheduled <= now:
                continue
        elif when == local_day:
            continue
        sentence = f"Per {authority}, {name} is scheduled for {when:%B} {when.day}. {why.rstrip('.')}."
        sentence = sentence.replace("—", ", ").replace("–", ", ")
        if len((text + " " + sentence).split()) > MAX_WORDS:
            continue
        text += " " + sentence
        accepted.append(entry)
        seen.add((name.lower(), when))
    return (text, accepted) if accepted else (EMPTY, [])
