"""Audio duration and RSS helpers for The Courier."""
from datetime import datetime, timedelta
from pathlib import Path
from xml.sax.saxutils import escape


def duration_seconds(path):
    path = Path(path)
    if not path.exists() or path.stat().st_size == 0:
        return 0.0
    try:
        from mutagen.mp3 import MP3
        return round(float(MP3(str(path)).info.length), 2)
    except Exception:
        return 0.0


def attach_duration(block, path):
    seconds = duration_seconds(path)
    if seconds > 0:
        block["durationSeconds"] = seconds
        block["minutes"] = round(seconds / 60.0, 1)
    else:
        fallback = float(block.get("words", 0) or 0) / 150.0 * 60.0
        block["durationSeconds"] = round(fallback, 1)
        block["minutes"] = round(fallback / 60.0, 1)
    return block


def block_seconds(block):
    seconds = block.get("durationSeconds")
    if isinstance(seconds, (int, float)) and seconds > 0:
        return int(round(seconds))
    return int(float(block.get("words", 0) or 0) / 150.0 * 60.0)


def write_feed(manifest, repo, manifest_path):
    owner, name = repo.split("/")
    site = f"https://{owner.lower()}.github.io/{name}/"
    items = []
    for day in manifest.get("days", []):
        pub = datetime.fromisoformat(day["generatedAt"])
        for n, block in enumerate(day.get("blocks", [])):
            if not block.get("audio"):
                continue
            secs = block_seconds(block)
            when = (pub - timedelta(seconds=n)).strftime("%a, %d %b %Y %H:%M:%S +0000")
            items.append(f"""  <item>
   <title>{escape(day['date'])} {escape(block['label'])}: {escape(block['title'])}</title>
   <guid isPermaLink="false">courier-{day['date']}-{block['id']}</guid>
   <pubDate>{when}</pubDate>
   <enclosure url="{escape(block['audio'])}" length="{block['bytes']}" type="audio/mpeg"/>
   <itunes:duration>{secs // 60}:{secs % 60:02d}</itunes:duration>
   <description>{escape(chr(10).join('- ' + p for p in block.get('talkingPoints', [])) or block.get('script', '')[:400])}</description>
  </item>""")
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
 <channel>
  <title>The Courier</title>
  <link>{site}courier.html</link>
  <description>Private daily briefing.</description>
  <language>en-ca</language>
  <itunes:block>Yes</itunes:block>
  <itunes:author>The Courier</itunes:author>
{chr(10).join(items)}
 </channel>
</rss>
"""
    Path(manifest_path).with_name("feed.xml").write_text(xml)
