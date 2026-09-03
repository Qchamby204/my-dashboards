"""
The Courier: daily briefing builder.

Runs in GitHub Actions. For each category in sources.json:
  1. pull the last 24 hours of items from the listed feeds
  2. ask Claude to write a 15 minute spoken script, with web search to fill gaps
  3. voice it with ElevenLabs
  4. write audio to out/<date>/<category>.mp3 and the day's manifest entry

Then writes a three minute front page across all blocks, merges today into
courier/manifest.json and courier/feed.xml (podcast RSS, last 7 days), and
prunes the audio for anything older. Audio is pushed by the workflow to an orphan branch, courier-audio, rewritten
daily with only the last 7 days, and served through jsDelivr with a proper audio MIME type.

Env: ANTHROPIC_API_KEY, ANTHROPIC_WORKSPACE_ID (if the key is identity-linked), ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (optional),
REPO (owner/name), DRY_RUN=1 to skip both APIs and write a placeholder day.
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import feedparser
import requests

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
OUT = ROOT / "out"
MANIFEST = ROOT / "courier" / "manifest.json"

REPO = os.environ.get("REPO", "Qchamby204/my-dashboards")
DRY_RUN = os.environ.get("DRY_RUN") == "1"
KEEP_DAYS = 7
TARGET_WORDS = "2,000 to 2,200"
CLAUDE_MODEL = "claude-sonnet-5"
ELEVEN_VOICE = os.environ.get("ELEVENLABS_VOICE_ID") or "21m00Tcm4TlvDq8ikWAM"
ELEVEN_MODEL = os.environ.get("ELEVENLABS_MODEL") or "eleven_multilingual_v2"
ELEVEN_SETTINGS = {
    "stability": float(os.environ.get("ELEVENLABS_STABILITY") or 0.45),   # lower = more expressive, less consistent
    "similarity_boost": 0.8,
    "style": float(os.environ.get("ELEVENLABS_STYLE") or 0.35),           # higher = more performative
}
ELEVEN_CHUNK = 4000  # characters per TTS request

# Winnipeg date. CDT in September, CST in winter. Good enough for a date stamp.
TODAY = (datetime.now(timezone.utc) - timedelta(hours=5)).date().isoformat()
WEEKDAY = datetime.fromisoformat(TODAY).strftime("%a").lower()[:3]  # mon..sun
PROGRESS = ROOT / "courier" / "progress.json"

WATCH = [ln.strip() for ln in (HERE / "watch.txt").read_text().splitlines()
         if ln.strip() and not ln.startswith("#")]
WATCH_RULE = ("Watch list, surface any mention and say it is on the watch list: "
              + "; ".join(WATCH)) if WATCH else ""

STYLE_RULES = """
Voice and style rules, all firm:
- Written to be read aloud by one person to one listener. Conversational, direct, specific.
- Address the listener as "you". No "welcome to", no "let's dive in", no "in today's episode".
- Never use an em dash or en dash anywhere. Use commas, periods, or colons.
- Do not open with a summary of what you are about to cover. Start with the biggest story.
- Numbers matter: give the figure, the direction, and what it compares to.
- Attribute claims to outlets by name in the spoken text ("the Globe reports", "per TSN").
- Avoid the tells of machine writing: no "it's worth noting", no "in the ever-evolving", no
  "landscape", no triplets for rhythm, no rhetorical questions, no tidy moral at the end.
- Spell out abbreviations on first use if a listener would stumble on them.
- Finish with a section headed exactly "Talking points" containing five short lines a person
  could say in a meeting or at a dinner table today.
"""


def log(msg):
    print(f"[courier] {msg}", flush=True)


# ---------- 1. feeds ----------

def fetch_items(feeds, since_hours=26):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    items = []
    for f in feeds:
        try:
            parsed = feedparser.parse(f["url"], request_headers={"User-Agent": "Mozilla/5.0"})
        except Exception as e:
            log(f"feed failed {f['outlet']}: {e}")
            continue
        for e in parsed.entries:
            ts = e.get("published_parsed") or e.get("updated_parsed")
            if ts:
                when = datetime(*ts[:6], tzinfo=timezone.utc)
                if when < cutoff:
                    continue
            summary = re.sub(r"<[^>]+>", " ", e.get("summary", "") or "")
            items.append({
                "outlet": f["outlet"],
                "title": e.get("title", "").strip(),
                "url": e.get("link", ""),
                "summary": " ".join(summary.split())[:600],
            })
        log(f"{f['outlet']}: {len(parsed.entries)} entries")
    return items


# ---------- 2. script ----------

def claude(prompt, max_tokens, web_searches=0):
    """Call the Messages API and return the concatenated text. Logs the API's error body on failure."""
    headers = {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
               "content-type": "application/json"}
    if os.environ.get("ANTHROPIC_WORKSPACE_ID"):  # needed for identity-linked keys
        headers["anthropic-workspace-id"] = os.environ["ANTHROPIC_WORKSPACE_ID"]
    body = {"model": CLAUDE_MODEL, "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}]}
    if web_searches:
        body["tools"] = [{"type": "web_search_20250305", "name": "web_search", "max_uses": web_searches}]
    for _ in range(6):  # pause_turn continuations
        r = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=body, timeout=600)
        if r.status_code == 400 and "tools" in body and "web search" in r.text.lower():
            log("web search is not enabled for this API org; retrying without it. Enable it at platform.claude.com/settings/privacy")
            body.pop("tools")
            continue
        if not r.ok:
            log(f"Anthropic API {r.status_code}: {r.text[:800]}")
            r.raise_for_status()
        data = r.json()
        if data.get("stop_reason") == "pause_turn":
            body["messages"] = body["messages"][:1] + [{"role": "assistant", "content": data["content"]}]
            continue
        return "".join(b.get("text", "") for b in data["content"] if b.get("type") == "text")
    raise RuntimeError("Anthropic API kept pausing")


def parse_fields(text, *fields):
    """Parse a response written as labelled sections: TITLE: ..., SCRIPT: ..., SOURCES: ...
    Plain text cannot be broken by quotes or newlines the way JSON can."""
    if "max_tokens" in text[-40:]:
        log("response was cut off at max_tokens")
    out = {}
    pattern = "|".join(re.escape(f) for f in fields)
    parts = re.split(rf"^\s*({pattern}):\s*", text, flags=re.M)
    # parts: [preamble, FIELD, value, FIELD, value, ...]
    for i in range(1, len(parts) - 1, 2):
        out[parts[i].lower()] = parts[i + 1].strip()
    if "script" not in out or len(out["script"]) < 200:
        raise ValueError(f"no usable SCRIPT section; response starts: {text[:200]!r}")
    out["script"] = out["script"].replace("\u2014", ", ").replace("\u2013", ", ")
    if "sources" in out:
        srcs = []
        for ln in out["sources"].splitlines():
            bits = [b.strip() for b in ln.strip().lstrip("-* ").split("|")]
            if len(bits) >= 3 and bits[2].startswith("http"):
                srcs.append({"outlet": bits[0], "title": bits[1], "url": bits[2]})
        out["sources"] = srcs
    return out


FORMAT_SCRIPT = """Write your answer as plain text in exactly this layout, with these three labels on their own
lines and nothing before the first label:

TITLE: a six to ten word headline
SCRIPT:
the full spoken script, paragraphs separated by blank lines, ending with the Talking points section
SOURCES:
- outlet | article title | url
- outlet | article title | url
"""
def write_script(category, spec, items):
    if DRY_RUN:
        return {"title": f"{spec['label']} (dry run)", "script": "Dry run. " * 40 + "\n\nTalking points\n- none",
                "sources": [{"outlet": i["outlet"], "title": i["title"], "url": i["url"]} for i in items[:5]]}

    feed_text = "\n".join(
        f"- [{i['outlet']}] {i['title']} :: {i['summary']} ({i['url']})" for i in items[:80]
    ) or "(no feed items today)"

    if spec.get("mode") == "companies":
        prompt = f"""Today is {TODAY}. Identify the ten companies most talked about in business, markets and
technology news over the last 48 hours, worldwide with a Canadian tilt. Scope: {spec['brief']}
Use the feed items below to see what is being covered, then use web search to confirm the
ranking and get the specifics. Watch list companies that appear in the news go first.
{WATCH_RULE}

Write it as a spoken 15 minute segment of {TARGET_WORDS} words. Ten sections, one per company,
each about 200 words: who they are, why they are in the news, tailwinds, headwinds, and what an
evidence-based advisor says to a client who asks. Rank by how much coverage they received.

{STYLE_RULES}

Feed items:
{feed_text}

{FORMAT_SCRIPT}"""
    else:
        prompt = f"""Today is {TODAY}. Write the daily 15 minute spoken briefing for the category
"{spec['label']}" for a wealth advisor in Winnipeg who wants to be informed and have talking
points. Scope: {spec['brief']}

Target length {TARGET_WORDS} words, which reads aloud in about fifteen minutes.

Below are items pulled from feeds in the last day. Use them as the base. Use web search to
fill gaps, check anything that looks stale, and pull in coverage from these preferred
outlets where they have something today: {", ".join(spec['prefer_web'])}. Prefer original and
reputable sources. Skip anything you cannot attribute.
{WATCH_RULE}

{STYLE_RULES}

Feed items:
{feed_text}

{FORMAT_SCRIPT}"""

    return parse_fields(claude(prompt, 12000, web_searches=8), "TITLE", "SCRIPT", "SOURCES")


def write_front_page(blocks):
    if DRY_RUN:
        return {"title": "Front page (dry run)", "script": "Dry run front page. " * 20}
    digest = "\n\n".join(f"### {b['label']}: {b['title']}\n{b['script']}" for b in blocks if b["id"] != "lessons")
    prompt = f"""Today is {TODAY}. Below are today's briefing scripts. Write a spoken front page
of 420 to 480 words, about three minutes, that tells the listener what actually matters today
across all of them and which blocks are worth his full fifteen minutes. Rank by importance, not by
block order. Name the block when you point to it. No talking points section.

{STYLE_RULES}

Scripts:
{digest}

Write your answer as plain text in exactly this layout, labels on their own lines, nothing before the first:

TITLE: six to ten word headline for the day
SCRIPT:
the front page"""
    data = parse_fields(claude(prompt, 4000, web_searches=3), "TITLE", "SCRIPT", "TASK", "DRILL")
    if data.get("drill", "").strip().lower() == "none":
        data["drill"] = ""
    return data


def write_lesson(track, spec, seq_label, index, lessons):
    title = lessons[index % len(lessons)]
    cycle = index // len(lessons) + 1
    prev = [lessons[(index - k) % len(lessons)] for k in (3, 2, 1) if index - k >= 0]
    nxt = lessons[(index + 1) % len(lessons)]
    if DRY_RUN:
        return {"title": title, "script": f"Dry run lesson: {title}. " * 20, "task": "none", "drill": ""}
    prompt = f"""Today is {TODAY}. Write lesson {index + 1} (cycle {cycle}) in a progressive daily learning
track called "{spec['label']}"{f', sequence "{seq_label}"' if seq_label else ''}.
Framing: {spec['framing']}

Today's lesson: {title}
Previous lessons, assume they were covered: {"; ".join(prev) or "none, this is the first"}
Next lesson: {nxt}

Write 650 to 750 words to be read aloud, about five minutes. Teach one thing properly: the concept,
a worked example with real numbers, the mistake people make, and a single practice task for today
that takes under fifteen minutes. If the track asks for a drill, add one that could be scored.
Be current and precise; if a figure depends on the tax year, state the year.
{"Cycle " + str(cycle) + ": this topic was covered before, so go deeper or take a different angle." if cycle > 1 else ""}

{STYLE_RULES.replace('Finish with a section headed exactly "Talking points" containing five short lines a person', 'Do not add a talking points section.').replace('could say in a meeting or at a dinner table today.', '')}

Write your answer as plain text in exactly this layout, labels on their own lines, nothing before the first:

TITLE: {title}
SCRIPT:
the lesson
TASK:
today's practice task in one or two sentences
DRILL:
for the communication track only, a scoreable drill: what to do and what good looks like. Otherwise the word none."""
    return parse_fields(claude(prompt, 3000), "TITLE", "SCRIPT")


def write_lessons():
    """One 15 minute block: three five minute lessons, one per track. Weekdays only."""
    if WEEKDAY in ("sat", "sun"):
        return None
    curriculum = json.loads((HERE / "curriculum.json").read_text())
    progress = json.loads(PROGRESS.read_text()) if PROGRESS.exists() else {}
    if progress.get("lastAdvanced") == TODAY:
        log("lessons already advanced today; reusing indices")
    out = []
    for track, spec in curriculum.items():
        if spec.get("weekday_rotation"):
            seq = spec["sequences"][WEEKDAY]
            key = f"{track}.{WEEKDAY}"
            lessons, seq_label = seq["lessons"], seq["label"]
        else:
            key, lessons, seq_label = track, spec["lessons"], None
        index = progress.get(key, 0)
        try:
            data = write_lesson(track, spec, seq_label, index, lessons)
        except Exception as e:
            log(f"lesson {track} failed, skipping that track today: {e}")
            continue
        out.append({"track": track, "label": spec["label"], "sequence": seq_label, "index": index + 1,
                    "title": data["title"], "script": data["script"], "task": data.get("task", ""),
                    "drill": data.get("drill", "")})
        if progress.get("lastAdvanced") != TODAY:
            progress[key] = index + 1
    progress["lastAdvanced"] = TODAY
    PROGRESS.write_text(json.dumps(progress, indent=1))
    return out


def split_talking_points(script):
    m = re.search(r"\n\s*Talking points\s*:?\s*\n", script, flags=re.I)
    if not m:
        return script, []
    body, tail = script[:m.start()].rstrip(), script[m.end():]
    points = [re.sub(r"^[\-\*\d\.\)\s]+", "", ln).strip() for ln in tail.splitlines()]
    return body, [p for p in points if p]


# ---------- 3. voice ----------

def chunk_text(text, limit=ELEVEN_CHUNK):
    chunks, cur = [], ""
    for para in text.split("\n\n"):
        if len(cur) + len(para) + 2 > limit and cur:
            chunks.append(cur)
            cur = para
        else:
            cur = f"{cur}\n\n{para}" if cur else para
    if cur:
        chunks.append(cur)
    return chunks


def voice(text, path):
    if DRY_RUN:
        path.write_bytes(b"")
        return
    audio = b""
    for i, chunk in enumerate(chunk_text(text)):
        for attempt in range(3):
            r = requests.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_VOICE}",
                params={"output_format": "mp3_44100_64"},
                headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "content-type": "application/json"},
                json={"text": chunk, "model_id": ELEVEN_MODEL,
                      "voice_settings": ELEVEN_SETTINGS},
                timeout=300,
            )
            if r.ok:
                audio += r.content
                break
            log(f"tts chunk {i} attempt {attempt} failed: {r.status_code} {r.text[:200]}")
            time.sleep(5)
        else:
            raise RuntimeError("ElevenLabs failed three times")
    path.write_bytes(audio)


# ---------- 4. manifest and feed ----------

def make_block(slug, label, title, body, points, sources, day_dir, release):
    path = day_dir / f"{slug}.mp3"
    voice(body, path)
    words = len(body.split())
    return {
        "id": slug, "label": label, "title": title,
        "audio": f"https://cdn.jsdelivr.net/gh/{REPO}@courier-audio/{TODAY}/{slug}.mp3",
        "bytes": path.stat().st_size,
        "script": body, "talkingPoints": points, "sources": sources,
        "words": words, "minutes": round(words / 150, 1),
    }


def write_feed(manifest):
    from xml.sax.saxutils import escape
    owner, name = REPO.split("/")
    site = f"https://{owner.lower()}.github.io/{name}/"
    items = []
    for d in manifest["days"]:
        pub = datetime.fromisoformat(d["generatedAt"])
        for n, b in enumerate(d["blocks"]):
            secs = int(b["words"] / 150 * 60)
            when = (pub - timedelta(seconds=n)).strftime("%a, %d %b %Y %H:%M:%S +0000")
            items.append(f"""  <item>
   <title>{escape(d['date'])} {escape(b['label'])}: {escape(b['title'])}</title>
   <guid isPermaLink="false">courier-{d['date']}-{b['id']}</guid>
   <pubDate>{when}</pubDate>
   <enclosure url="{escape(b['audio'])}" length="{b['bytes']}" type="audio/mpeg"/>
   <itunes:duration>{secs // 60}:{secs % 60:02d}</itunes:duration>
   <description>{escape(chr(10).join('- ' + p for p in b['talkingPoints']) or b['script'][:400])}</description>
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
    (MANIFEST.parent / "feed.xml").write_text(xml)


def load_manifest():
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"schemaVersion": 1, "days": []}


def main():
    sources = json.loads((HERE / "sources.json").read_text())
    day_dir = OUT / TODAY
    day_dir.mkdir(parents=True, exist_ok=True)
    release = f"courier-{TODAY}"
    blocks = []

    failed = []

    def build_block(slug):
        spec = sources[slug]
        log(f"== {spec['label']} start")
        try:
            items = fetch_items(spec["feeds"])
            data = write_script(slug, spec, items)
            body, points = split_talking_points(data["script"])
            block = make_block(slug, spec["label"], data.get("title", spec["label"]), body,
                               points, data.get("sources", [])[:20], day_dir, release)
            log(f"== {spec['label']} done, {block['minutes']} min")
            return block
        except Exception as e:
            log(f"block {slug} failed, skipping it today: {e}")
            failed.append(slug)
            return None

    # four blocks at a time; each is a long Claude call followed by a long ElevenLabs call
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(build_block, list(sources)))
    blocks.extend(b for b in results if b)   # keeps sources.json order
    if not blocks:
        raise RuntimeError("every block failed")

    log("== Lessons")
    try:
        lessons = write_lessons()
    except Exception as e:
        log(f"lessons failed, skipping today: {e}")
        lessons, failed = None, failed + ["lessons"]
    if lessons:
        body = "\n\n".join(f"{l['label']}{', ' + l['sequence'] if l['sequence'] else ''}, lesson {l['index']}: {l['title']}.\n\n{l['script']}" for l in lessons)
        block = make_block("lessons", "Lessons", " / ".join(l["title"] for l in lessons), body,
                           [f"{l['label']}: {l['task']}" for l in lessons], [], day_dir, release)
        block["lessons"] = lessons
        blocks.insert(0, block)

    log("== Front page")
    try:
        fp = write_front_page(blocks)
        blocks.insert(0, make_block("frontpage", "Front page", fp["title"], fp["script"], [], [], day_dir, release))
    except Exception as e:
        log(f"front page failed, skipping today: {e}")
        failed.append("frontpage")

    manifest = load_manifest()
    manifest["days"] = [d for d in manifest["days"] if d["date"] != TODAY]
    manifest["days"].insert(0, {
        "date": TODAY,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "release": release,
        "blocks": blocks,
    })
    manifest["days"] = manifest["days"][:KEEP_DAYS]
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    write_feed(manifest)

    # tell the workflow which days of audio to keep on the courier-audio branch
    (OUT / "keep-days.txt").write_text("\n".join(sorted(d["date"] for d in manifest["days"])))
    log(f"done: {len(blocks)} blocks, manifest holds {len(manifest['days'])} days"
        + (f"; FAILED blocks: {', '.join(failed)}" if failed else ""))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"FAILED: {e}")
        sys.exit(1)
