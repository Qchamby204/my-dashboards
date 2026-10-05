"""Keep both priority leagues in the bounded Sports source window."""
import re


def balanced_sports_items(items):
    """Raiders first, then rotate leagues so a busy hockey feed cannot crowd out NFL."""
    buckets = {league: [] for league in ("nfl", "nhl", "cfl", "nba", "other")}
    raiders = []
    for item in items:
        text = item.get("outlet", "") + " " + item.get("title", "")
        if re.search(r"\braiders\b", text, re.I):
            raiders.append(item)
            continue
        league = next((key for key, pattern in (
            ("cfl", r"\b(cfl|blue bombers|grey cup)\b"),
            ("nfl", r"\b(nfl|super bowl|chiefs|patriots|ravens|bengals|packers)\b"),
            ("nhl", r"\b(nhl|hockey|stanley cup|winnipeg jets)\b"),
            ("nba", r"\b(nba|basketball)\b"),
        ) if re.search(pattern, text, re.I)), "other")
        buckets[league].append(item)
    ordered = raiders[:1]
    buckets["nfl"] = raiders[1:] + buckets["nfl"]
    while any(buckets.values()):
        for bucket in buckets.values():
            if bucket:
                ordered.append(bucket.pop(0))
    return ordered
