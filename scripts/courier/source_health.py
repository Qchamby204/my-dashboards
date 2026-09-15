"""Freshness filtering and source-health reporting for The Courier."""
from datetime import datetime, timedelta, timezone
import re


class SourceHealth:
    def __init__(self):
        self.feeds = []
        self.newsletters = {"configured": False, "items": 0, "bySection": {}}

    def record_feed(self, **record):
        self.feeds.append(record)

    def record_newsletters(self, configured, by_section):
        by_section = {k: len(v) for k, v in (by_section or {}).items()}
        self.newsletters = {
            "configured": bool(configured),
            "items": sum(by_section.values()),
            "bySection": by_section,
        }

    def report(self, sources):
        by_url = {f.get("url"): f for f in self.feeds}
        sections = {}
        degraded = []
        for slug, spec in sources.items():
            rows = [by_url.get(feed.get("url"), {}) for feed in spec.get("feeds", [])]
            total = len(rows)
            ok = sum(1 for r in rows if r.get("status") == "ok")
            fresh = sum(int(r.get("freshEntries", 0) or 0) for r in rows)
            undated = sum(int(r.get("undatedDropped", 0) or 0) for r in rows)
            stale = sum(int(r.get("staleEntries", 0) or 0) for r in rows)
            section = {
                "feeds": total,
                "healthyFeeds": ok,
                "freshItems": fresh,
                "undatedDropped": undated,
                "staleDropped": stale,
                "newsletterItems": self.newsletters["bySection"].get(slug, 0),
            }
            section["degraded"] = bool(total and (ok < max(1, (total + 1) // 2) or fresh == 0))
            if section["degraded"]:
                degraded.append(slug)
            sections[slug] = section
        return {
            "feeds": self.feeds,
            "newsletters": self.newsletters,
            "sections": sections,
            "degradedSections": degraded,
        }


def fetch_items(feeds, parser, *, since_hours=26, health=None, log=None):
    """Return only timestamped, fresh RSS items. Undated RSS cannot become a lead by accident."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    items = []
    for feed in feeds:
        outlet, url = feed.get("outlet", "unknown"), feed.get("url", "")
        total = fresh = stale = undated = 0
        status, error = "ok", ""
        try:
            parsed = parser.parse(url, request_headers={"User-Agent": "Mozilla/5.0"})
            entries = list(getattr(parsed, "entries", []) or [])
            total = len(entries)
            if getattr(parsed, "bozo", False) and not entries:
                status = "error"
                error = str(getattr(parsed, "bozo_exception", "feed parse failed"))[:240]
            for entry in entries:
                ts = entry.get("published_parsed") or entry.get("updated_parsed")
                if not ts:
                    undated += 1
                    continue
                when = datetime(*ts[:6], tzinfo=timezone.utc)
                if when < cutoff:
                    stale += 1
                    continue
                title = (entry.get("title") or "").strip()
                if not title:
                    continue
                summary = re.sub(r"<[^>]+>", " ", entry.get("summary", "") or "")
                items.append({
                    "outlet": outlet,
                    "title": title,
                    "url": entry.get("link", ""),
                    "summary": " ".join(summary.split())[:600],
                    "publishedAt": when.isoformat(timespec="seconds"),
                })
                fresh += 1
        except Exception as exc:
            status, error = "error", str(exc)[:240]
            if log:
                log(f"feed failed {outlet}: {exc}")
        if health:
            health.record_feed(
                outlet=outlet, url=url, status=status, totalEntries=total,
                freshEntries=fresh, staleEntries=stale, undatedDropped=undated, error=error,
            )
        if log:
            log(f"{outlet}: {fresh} fresh, {stale} stale, {undated} undated dropped")
    return items
