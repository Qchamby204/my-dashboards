"""
The Courier: daily briefing builder.

Runs in GitHub Actions. For each category in sources.json:
1. pull the last 24 hours of items from the listed feeds
2. ask Claude to write a spoken script sized to that block's share of the day's time budget,
   with web search to fill gaps
3. voice it (OpenAI by default); if the voice fails the text is still published
4. write audio to out/<date>/<category>.mp3 and the day's manifest entry

Before any block is written, one planning call collapses the day's headlines into distinct
stories and gives each exactly one owner block, so the same event is not explained in five
places. Then writes a three minute front page across all blocks, merges today into
courier/manifest.json and courier/feed.xml (podcast RSS, last 7 days), and
prunes the audio for anything older. Audio is pushed by the workflow to an orphan branch, courier-audio,
rewritten daily with only the last 7 days, and served through jsDelivr with a proper audio MIME type.

Env: ANTHROPIC_API_KEY, ANTHROPIC_WORKSPACE_ID (if the key is identity-linked),
COURIER_MAIL_USER and COURIER_MAIL_PASSWORD (Gmail address and app password for the
newsletter inbox, optional), COURIER_MINUTES (total run time cap, default 60), COURIER_SEARCHES, COURIER_MAIL_PER_BLOCK,
COURIER_MAIL_CHARS, COURIER_FEED_ITEMS (what each block is allowed to read), COURIER_PRICE_* (rates
for the cost estimate in the log), TTS_PROVIDER (openai, the default, or elevenlabs), OPENAI_API_KEY, OPENAI_TTS_VOICE, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (optional),
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
import threading

import feedparser
import requests
import email
import imaplib
from email.header import decode_header
from html.parser import HTMLParser

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
OUT = ROOT / "out"
MANIFEST = ROOT / "courier" / "manifest.json"

REPO = os.environ.get("REPO", "Qchamby204/my-dashboards")
DRY_RUN = os.environ.get("DRY_RUN") == "1"
KEEP_DAYS = 7
CLAUDE_MODEL = "claude-sonnet-5"

# ---- time budget ----
# The whole day must fit inside TOTAL_MINUTES. Word targets are derived from minutes at WPM,
# which is set a little under a real narration rate so the finished audio lands under the cap
# rather than on it. Per-category minutes can be overridden with a "minutes" key in sources.json.
TOTAL_MINUTES = int(os.environ.get("COURIER_MINUTES") or 60)
WPM = 140
FRONT_MINUTES = 3
LESSONS_MINUTES = 8          # weekdays only; the three tracks share it
DEFAULT_MINUTES = {
    "markets": 8, "practice": 7, "companies": 7, "manitoba": 5, "politics": 5,
    "climate": 4, "tech": 4, "health": 3, "parenting": 2, "sports": 4,
}
OVERRUN_TOLERANCE = 1.15     # a block this far over its word ceiling gets one tightening pass

# ---- cost controls ----
# What Claude reads is the bill, not what it writes. Each of these trims the reading.
SEARCHES_PER_BLOCK = int(os.environ.get("COURIER_SEARCHES") or 2)     # web searches a block may spend
MAIL_PER_BLOCK = int(os.environ.get("COURIER_MAIL_PER_BLOCK") or 8)   # newsletters handed to a block
MAIL_CHARS = int(os.environ.get("COURIER_MAIL_CHARS") or 5000)        # characters kept per newsletter
FEED_ITEMS = int(os.environ.get("COURIER_FEED_ITEMS") or 40)          # feed headlines handed to a block

# Assumed rates for the cost estimate printed in the log. USD per million tokens, and per
# thousand searches. Set the COURIER_PRICE_* variables to match your plan; the token counts
# themselves are exact either way.
PRICE = {
    "input":       float(os.environ.get("COURIER_PRICE_IN") or 3.00),
    "output":      float(os.environ.get("COURIER_PRICE_OUT") or 15.00),
    "cache_read":  float(os.environ.get("COURIER_PRICE_CACHE_READ") or 0.30),
    "cache_write": float(os.environ.get("COURIER_PRICE_CACHE_WRITE") or 3.75),
    "search":      float(os.environ.get("COURIER_PRICE_SEARCH") or 10.00),
}
USAGE = {"calls": 0, "input": 0, "output": 0, "cache_read": 0, "cache_write": 0, "searches": 0}
_USAGE_LOCK = threading.Lock()


def estimate_cost(u):
    return (u["input"] * PRICE["input"] + u["output"] * PRICE["output"]
            + u["cache_read"] * PRICE["cache_read"] + u["cache_write"] * PRICE["cache_write"]) / 1e6 \
        + u["searches"] * PRICE["search"] / 1000


def record_usage(label, u):
    with _USAGE_LOCK:
        USAGE["calls"] += 1
        for k in ("input", "output", "cache_read", "cache_write", "searches"):
            USAGE[k] += u[k]
    log(f"usage {label or 'call'}: in {u['input']:,} (cache read {u['cache_read']:,}, write {u['cache_write']:,}) "
        f"out {u['output']:,}, searches {u['searches']}, est ${estimate_cost(u):.2f}")
ELEVEN_VOICE = os.environ.get("ELEVENLABS_VOICE_ID") or "21m00Tcm4TlvDq8ikWAM"
ELEVEN_MODEL = os.environ.get("ELEVENLABS_MODEL") or "eleven_multilingual_v2"
ELEVEN_SETTINGS = {
    "stability": float(os.environ.get("ELEVENLABS_STABILITY") or 0.45),   # lower = more expressive, less consistent
    "similarity_boost": 0.8,
    "style": float(os.environ.get("ELEVENLABS_STYLE") or 0.35),           # higher = more performative
}
ELEVEN_CHUNK = 4000  # characters per TTS request

TTS_PROVIDER = os.environ.get("TTS_PROVIDER") or "openai"   # openai | elevenlabs
OPENAI_VOICE = os.environ.get("OPENAI_TTS_VOICE") or "cedar"
OPENAI_MODEL = os.environ.get("OPENAI_TTS_MODEL") or "gpt-4o-mini-tts"
OPENAI_CHUNK = 3800  # hard API limit is 4096 characters
OPENAI_INSTRUCTIONS = os.environ.get("OPENAI_TTS_INSTRUCTIONS") or (
    "You are reading a private morning briefing to one listener, like a trusted colleague talking "
    "across a desk. Warm, unhurried, natural. Vary pace and pitch the way a person does: slow down "
    "on numbers and names, lift slightly on the lead story, ease off at the end of a paragraph. "
    "No radio-announcer polish, no monotone.")

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


# ---------- 1b. newsletters ----------

class _Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.out = []; self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script", "head"): self.skip += 1
        if tag in ("p", "br", "div", "tr", "li", "h1", "h2", "h3"): self.out.append("\n")
    def handle_endtag(self, tag):
        if tag in ("style", "script", "head"): self.skip -= 1
    def handle_data(self, d):
        if not self.skip: self.out.append(d)


def html_to_text(html):
    p = _Text(); p.feed(html)
    text = "".join(p.out)
    text = re.sub(r"https?://\S+", "", text)            # tracking links add nothing for the model
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def _decode(v):
    return "".join(b.decode(c or "utf-8", "replace") if isinstance(b, bytes) else b for b, c in decode_header(v or ""))


def fetch_newsletters(since_hours=26):
    """Pull the last day of mail from the Courier inbox and bucket it by block via newsletters.json.
    Returns {block: [ {outlet, subject, text} ]}. Skipped entirely if no mailbox is configured."""
    user, pw = os.environ.get("COURIER_MAIL_USER"), os.environ.get("COURIER_MAIL_PASSWORD")
    if not (user and pw) or DRY_RUN:
        return {}
    cfg = json.loads((HERE / "newsletters.json").read_text())
    routes = {k: v for k, v in cfg.items() if not k.startswith("_")}
    ignore = [s.lower() for s in cfg.get("_ignore", [])]
    by_block, unmapped = {}, set()

    def matches(sender, key):
        return sender == key or sender.endswith("@" + key) or sender.endswith("." + key)
    try:
        box = imaplib.IMAP4_SSL(os.environ.get("COURIER_MAIL_HOST") or "imap.gmail.com")
        box.login(user, pw)
        box.select("INBOX", readonly=True)
        since = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).strftime("%d-%b-%Y")
        _, ids = box.search(None, f'(SINCE "{since}")')
        for mid in ids[0].split()[-150:]:
            _, data = box.fetch(mid, "(RFC822)")
            msg = email.message_from_bytes(data[0][1])
            sender = email.utils.parseaddr(msg.get("From", ""))[1].lower()
            if any(matches(sender, k) for k in ignore):
                continue                                   # receipts, account mail, known noise
            blocks = next((v for k, v in routes.items() if matches(sender, k)), None)
            if not blocks:
                unmapped.add(sender); continue
            body = ""
            for part in msg.walk():
                ctype = part.get_content_type()
                if ctype in ("text/html", "text/plain") and not part.get("Content-Disposition"):
                    payload = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                    body = html_to_text(payload) if ctype == "text/html" else payload
                    if ctype == "text/html": break
            item = {"outlet": _decode(msg.get("From", "")).split("<")[0].strip(' "'),
                    "subject": _decode(msg.get("Subject", "")), "text": body[:MAIL_CHARS]}
            for b in blocks:
                by_block.setdefault(b, []).append(item)
        box.logout()
    except Exception as e:
        log(f"mailbox read failed, continuing on feeds only: {e}")
        return by_block
    log("newsletters: " + (", ".join(f"{k} {len(v)}" for k, v in by_block.items()) or "none"))
    if unmapped:
        log("unmapped senders (add to newsletters.json): " + ", ".join(sorted(unmapped)))
    return by_block


NEWSLETTERS = None  # filled once in main()


# ---------- 2. script ----------

def claude(prompt, max_tokens, web_searches=0, label=""):
    """Call the Messages API and return the concatenated text. Logs the API's error body on failure.

    The prompt goes up as a single cached block. A call that uses web search re-reads its prompt
    on every search iteration and every pause_turn continuation; with the cache breakpoint those
    re-reads bill at the cache-read rate instead of full price. Token usage is accumulated per
    call and logged with a cost estimate, so the run reports what it spent."""
    headers = {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
               "content-type": "application/json"}
    if os.environ.get("ANTHROPIC_WORKSPACE_ID"):  # needed for identity-linked keys
        headers["anthropic-workspace-id"] = os.environ["ANTHROPIC_WORKSPACE_ID"]
    content = [{"type": "text", "text": prompt, "cache_control": {"type": "ephemeral"}}]
    body = {"model": CLAUDE_MODEL, "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": content}]}
    if web_searches:
        body["tools"] = [{"type": "web_search_20250305", "name": "web_search", "max_uses": web_searches}]
    used = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0, "searches": 0}
    texts = []   # everything written across pauses; a pause_turn must not lose the opening of the script
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
        u = data.get("usage") or {}
        used["input"] += u.get("input_tokens", 0) or 0
        used["output"] += u.get("output_tokens", 0) or 0
        used["cache_read"] += u.get("cache_read_input_tokens", 0) or 0
        used["cache_write"] += u.get("cache_creation_input_tokens", 0) or 0
        used["searches"] += ((u.get("server_tool_use") or {}).get("web_search_requests", 0) or 0)
        texts.extend(b.get("text", "") for b in data["content"] if b.get("type") == "text")
        if data.get("stop_reason") == "pause_turn":
            # resume with everything so far in the assistant turn; the model continues from here
            prior = body["messages"][1]["content"] if len(body["messages"]) > 1 else []
            body["messages"] = body["messages"][:1] + [{"role": "assistant", "content": prior + data["content"]}]
            continue
        if data.get("stop_reason") == "max_tokens":
            log(f"{label or 'call'}: response hit max_tokens ({max_tokens}) and is cut off")
        record_usage(label, used)
        return "".join(texts)
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
    out["script"] = out["script"].replace("—", ", ").replace("–", ", ")
    if "sources" in out:
        srcs = []
        for ln in out["sources"].splitlines():
            bits = [b.strip() for b in ln.strip().lstrip("-* ").split("|")]
            if len(bits) >= 3 and bits[2].startswith("http"):
                srcs.append({"outlet": bits[0], "title": bits[1], "url": bits[2]})
        out["sources"] = srcs
    return out


def budget(sources):
    """Minutes per block for today, fitting inside TOTAL_MINUTES.

    Fixed slots (front page, lessons on weekdays) come off the top; the categories share the rest.
    If the category minutes in sources.json add up to more than what is left, they are scaled
    down proportionally so the cap holds no matter what is configured."""
    weekday = WEEKDAY not in ("sat", "sun")
    fixed = FRONT_MINUTES + (LESSONS_MINUTES if weekday else 0)
    wanted = {slug: max(1, int(spec.get("minutes", DEFAULT_MINUTES.get(slug, 4)))) for slug, spec in sources.items()}
    available = max(len(wanted), TOTAL_MINUTES - fixed)
    total_wanted = sum(wanted.values())
    if total_wanted > available:
        # scale proportionally, then hand the rounding leftovers to the largest remainders
        # so the cap is met exactly instead of undershot by a minute per block
        scale = available / total_wanted
        exact = {k: v * scale for k, v in wanted.items()}
        wanted = {k: max(1, int(x)) for k, x in exact.items()}
        spare = available - sum(wanted.values())
        for k in sorted(exact, key=lambda k: exact[k] - int(exact[k]), reverse=True)[:max(0, spare)]:
            wanted[k] += 1
        log(f"category minutes ({total_wanted}) exceed the {available} available; scaled to {sum(wanted.values())}")
    plan = {"frontpage": FRONT_MINUTES, **wanted}
    if weekday:
        plan["lessons"] = LESSONS_MINUTES
    log(f"time budget: {sum(plan.values())} of {TOTAL_MINUTES} min; " + ", ".join(f"{k} {v}" for k, v in plan.items()))
    return plan


def words_for(minutes):
    return int(minutes * WPM)


def plan_stories(sources, items_by_block):
    """Decide once, before any script is written, who covers what.

    Collapses the day's headlines and newsletter subjects into distinct stories and gives each
    exactly one owner block. Blocks are generated in parallel, so this has to happen up front:
    nothing downstream can see what a sibling block wrote. Summary surfaces (The Ten) get the
    stories as context rather than as a ban, since covering the same ground is their job.

    Returns {slug: {"owns": [...], "callbacks": [...], "elsewhere": [...], "context": [...]}}."""
    if DRY_RUN:
        return {}

    catalogue = []
    for slug in sources:
        lines = [f"  - [{i['outlet']}] {i['title']}" for i in items_by_block.get(slug, [])[:40]]
        lines += [f"  - [newsletter: {m['outlet']}] {m['subject']}" for m in (NEWSLETTERS or {}).get(slug, [])[:12]]
        catalogue.append(f"{slug} ({sources[slug]['label']}):\n" + ("\n".join(lines) or "  (nothing today)"))
    blocks_desc = "\n".join(f"- {slug}: {spec['label']}. {spec['brief']}" for slug, spec in sources.items())
    summary_blocks = [slug for slug, spec in sources.items() if spec.get("mode") == "companies"]
    owners = [slug for slug in sources if slug not in summary_blocks]

    prompt = f"""Today is {TODAY}. Below are today's candidate headlines, grouped by the briefing block
whose feeds produced them. The same event often shows up under several blocks. Decide, once, who
covers what, so the finished briefing never explains the same event twice.

1. Collapse the headlines into distinct STORIES. One underlying event is one story however many
   outlets or blocks carry it. Drop anything trivial. Aim for 12 to 25 stories.

2. Give every story exactly one owner block. Apply in order and stop at the first rule that settles it:
   a. Specificity wins. The most specific block that covers it owns it. A Manitoba budget measure
      goes to the Manitoba block, not Canadian politics. A CIRO rule change goes to practice, not markets.
   b. Then origin, not effect. The owner is where the story happens, not where its consequences land.
      A Bank of Canada rate decision is a monetary policy event, so markets owns it and practice
      does not, even though practice feels it.
   c. Then this order: {" > ".join(owners)}
   One owner. Never two. {"Never " + ", ".join(summary_blocks) + ": that block summarises by nature and is handled separately." if summary_blocks else ""}

3. For each story, name any other block with a genuinely different angle on it. At most two, and
   only if that block's listener could not get the point from the owner block. Otherwise none.

4. Write the single line other blocks may assume the listener already heard.

Blocks:
{blocks_desc}

Headlines:
{chr(10).join(catalogue)}

Answer as plain text, one story per record, in exactly this layout and nothing else. Headlines
contain quotes and odd characters, so do not use JSON:

STORY: one sentence, what happened
OWNER: block slug
LINE: the one line other blocks may assume was already said
CALLBACK: block slug | the different angle that block has
CALLBACK: block slug | the different angle that block has
---
STORY: ...

Use as many CALLBACK lines as apply, zero to two. End every record with a line of three dashes."""

    raw = claude(prompt, 6000, label="story plan")
    stories = parse_plan(raw)
    if not stories:
        raise ValueError(f"no stories parsed from plan; response starts: {raw[:200]!r}")

    summary = set(summary_blocks)
    plan = {slug: {"owns": [], "callbacks": [], "elsewhere": [], "context": []} for slug in sources}
    for s in stories:
        owner = s.get("owner")
        if owner not in plan or owner in summary or not s.get("event"):
            continue
        s.setdefault("line", s["event"])
        plan[owner]["owns"].append(s)
        named = set()
        for cb in (s.get("callbacks") or [])[:2]:
            b = cb.get("block")
            if b in plan and b != owner and b not in summary:
                named.add(b)
                plan[b]["callbacks"].append({**s, "angle": cb.get("angle", "")})
        for slug in plan:
            if slug != owner and slug not in named:
                plan[slug]["context" if slug in summary else "elsewhere"].append(s)

    log(f"story plan: {len(stories)} stories; " + ", ".join(f"{k} owns {len(v['owns'])}" for k, v in plan.items() if k not in summary))
    return plan


def parse_plan(raw):
    """Parse STORY / OWNER / LINE / CALLBACK records separated by --- lines. Tolerant of noise."""
    stories, cur = [], {}
    def flush():
        if cur.get("event") and cur.get("owner"):
            stories.append({"event": cur["event"], "owner": cur["owner"],
                            "line": cur.get("line") or cur["event"], "callbacks": cur.get("callbacks", [])})
    for ln in raw.splitlines():
        s = ln.strip().lstrip("-* ").strip()
        if not s:
            continue
        up = s.upper()
        if s.startswith("---") or up == "---":
            flush(); cur = {}
        elif up.startswith("STORY:"):
            if cur.get("event"):
                flush(); cur = {}
            cur["event"] = s[6:].strip()
        elif up.startswith("OWNER:"):
            cur["owner"] = s[6:].strip().strip("`\"'").lower()
        elif up.startswith("LINE:"):
            cur["line"] = s[5:].strip()
        elif up.startswith("CALLBACK:"):
            bits = [b.strip() for b in s[9:].split("|", 1)]
            if bits and bits[0] and bits[0].lower() != "none":
                cur.setdefault("callbacks", []).append({"block": bits[0].strip("`\"'").lower(),
                                                        "angle": bits[1] if len(bits) > 1 else ""})
    flush()
    return stories


def ownership_rules(block_plan):
    """Render one block's slice of the story plan into prompt text."""
    if not block_plan:
        return ""
    out = ["", "Story ownership for today. Already decided, follow it exactly.", ""]
    if block_plan["owns"]:
        out.append("Yours, and the spine of this block. Cover these properly:")
        out += [f"- {s['event']}" for s in block_plan["owns"]]
    else:
        out.append("Nothing is assigned to you today, so lead with the strongest of the source material "
                   "below that no other block owns.")
    if block_plan["callbacks"]:
        out += ["", "Owned by another block. You may refer to each of these ONCE, in a single clause,",
                "then go straight to your own angle. Never restate the event, the figure or the",
                "reasoning behind it. Write as though the listener heard it twenty minutes ago:"]
        out += [f"- already said: \"{s['line']}\"\n  your angle, and the only reason to mention it: {s['angle']}"
                for s in block_plan["callbacks"]]
    if block_plan.get("elsewhere"):
        out += ["", "Covered by another block, with no angle for you. Do not mention these at all:"]
        out += [f"- {s['line']}" for s in block_plan["elsewhere"]]
    if block_plan.get("context"):
        out += ["", "Covered in full by another block. You summarise, so you may touch these, but only",
                "through your own lens: one clause of orientation, then your own point. Never",
                "re-explain the event itself:"]
        out += [f"- {s['line']}" for s in block_plan["context"]]
    return "\n".join(out) + "\n"


def length_rule(minutes):
    words = words_for(minutes)
    return (f"Length: this is a fixed {minutes} minute slot in a one hour programme. Write "
            f"{int(words * 0.9)} to {words} words in the spoken script, not counting the Talking points. "
            f"Do not exceed {words}; cut a story before you do. Coming in under {int(words * 0.85)} means "
            f"you have cut too much, the slot is yours to fill.")


def enforce_length(data, minutes, label=""):
    """One tightening pass if a script blew through its ceiling. Cheap: no web search, short output."""
    words = words_for(minutes)
    body, _ = split_talking_points(data["script"])
    n = len(body.split())
    if DRY_RUN or n <= words * OVERRUN_TOLERANCE:
        return data
    log(f"script is {n} words against a {words} ceiling; tightening")
    prompt = f"""Cut the spoken script below to no more than {words} words. Keep the lead story, keep every
attribution, keep the Talking points section exactly as it is, and keep the SOURCES list exactly as
it is. Cut whole stories from the bottom before trimming the top. Do not add anything.

{STYLE_RULES}

TITLE: {data.get('title', '')}
SCRIPT:
{data['script']}
SOURCES:
{chr(10).join(f"- {s['outlet']} | {s['title']} | {s['url']}" for s in data.get('sources', []))}

{FORMAT_SCRIPT}"""
    try:
        tightened = parse_fields(claude(prompt, min(12000, words * 3 + 2000), label=f"tighten {label}"), "TITLE", "SCRIPT", "SOURCES")
        body2, _ = split_talking_points(tightened["script"])
        log(f"tightened to {len(body2.split())} words")
        if not tightened.get("sources"):
            tightened["sources"] = data.get("sources", [])
        return tightened
    except Exception as e:
        log(f"tightening failed, keeping the long version: {e}")
        return data


FORMAT_SCRIPT = """Write your answer as plain text in exactly this layout, with these three labels on their own
lines and nothing before the first label:

TITLE: a six to ten word headline
SCRIPT:
the full spoken script, paragraphs separated by blank lines, ending with the Talking points section
SOURCES:
- outlet | article title | url
- outlet | article title | url
"""
def write_script(category, spec, items, minutes, block_plan=None):
    words = words_for(minutes)
    if DRY_RUN:
        return {"title": f"{spec['label']} (dry run)", "script": "Dry run. " * (words // 2) + "\n\nTalking points\n- none",
                "sources": [{"outlet": i["outlet"], "title": i["title"], "url": i["url"]} for i in items[:5]]}
    own_rules = ownership_rules(block_plan)

    feed_text = "\n".join(
        f"- [{i['outlet']}] {i['title']} :: {i['summary']} ({i['url']})" for i in items[:FEED_ITEMS]
    ) or "(no feed items today)"
    mail = (NEWSLETTERS or {}).get(category, [])
    mail_text = "\n\n".join(f"### {m['outlet']}: {m['subject']}\n{m['text']}" for m in mail[:MAIL_PER_BLOCK])
    if mail_text:
        feed_text = ("Subscriber newsletters received today. These are the primary source; the feed items "
                     "below are the backstop.\n\n" + mail_text + "\n\nFeed items:\n" + feed_text)

    if spec.get("mode") == "companies":
        prompt = f"""Today is {TODAY}. Identify the ten companies most talked about in business, markets and
technology news over the last 48 hours, worldwide with a Canadian tilt. Scope: {spec['brief']}
Use the feed items below to see what is being covered. You have at most {SEARCHES_PER_BLOCK} web
searches; spend them confirming the ranking, not researching companies the sources already cover.
Watch list companies that appear in the news go first.
{WATCH_RULE}

Write it as a spoken {minutes} minute segment. Ten sections, one per company, each about
{words // 10} words, one sharp paragraph: who they are in a clause, why they are in the news, the
tailwind, the headwind, and what an evidence-based advisor says to a client who asks. Rank by how
much coverage they received.
{length_rule(minutes)}

{STYLE_RULES}

You are a summary surface, so companies whose news another block owns will appear here. That is
fine. Cover them through the company lens only: one clause of orientation, then straight to what
it means for the company. Never re-explain an event another block owns.
{own_rules}
Feed items:
{feed_text}

{FORMAT_SCRIPT}"""
    else:
        prompt = f"""Today is {TODAY}. Write today's {minutes} minute spoken briefing for the category
"{spec['label']}" for a wealth advisor in Winnipeg who wants to be informed and have talking
points. Scope: {spec['brief']}

{length_rule(minutes)}

Below are items pulled from feeds in the last day. Use them as the base. You have at most
{SEARCHES_PER_BLOCK} web searches: spend them on the largest gap in the sources, not on confirming
what they already say. Preferred outlets when you do search: {", ".join(spec['prefer_web'])}.
Prefer original and reputable sources. Skip anything you cannot attribute.
{WATCH_RULE}

{STYLE_RULES}
{own_rules}
Feed items:
{feed_text}

{FORMAT_SCRIPT}"""

    data = parse_fields(claude(prompt, 12000, web_searches=SEARCHES_PER_BLOCK, label=category),
                        "TITLE", "SCRIPT", "SOURCES")
    return enforce_length(data, minutes, label=category)


def write_front_page(blocks, minutes):
    words = words_for(minutes)
    if DRY_RUN:
        return {"title": "Front page (dry run)", "script": "Dry run front page. " * (words // 4)}
    # Blocks are summarised from their talking points, not their scripts, so the long versions
    # cannot leak back in. The script is only there as a fallback when a block has no points.
    digest = "\n\n".join(
        f"### {b['label']} ({b['minutes']} min): {b['title']}\n"
        + ("\n".join("- " + p for p in b["talkingPoints"]) or b["script"][:600])
        for b in blocks if b["id"] != "lessons")
    prompt = f"""Today is {TODAY}. Below is what each block of today's briefing covers. Write a spoken front
page of {int(words * 0.9)} to {words} words, about {minutes} minutes, that tells the listener what actually matters
today and which blocks deserve his full attention. Rank by importance, not by block order. Name
the block and its length when you point to it.

You are summarising blocks the listener is about to hear in full. Give each story one line and
move on. Do not rebuild context, re-quote figures, or explain reasoning the owning block covers
properly. Your job is to rank and point, not to brief. No talking points section.

{STYLE_RULES}

Blocks:
{digest}

Write your answer as plain text in exactly this layout, labels on their own lines, nothing before the first:

TITLE: six to ten word headline for the day
SCRIPT:
the front page"""
    return parse_fields(claude(prompt, 3000, web_searches=0, label="front page"), "TITLE", "SCRIPT")


def write_lesson(track, spec, seq_label, index, lessons, words):
    title = lessons[index % len(lessons)]
    cycle = index // len(lessons) + 1
    prev = [lessons[(index - k) % len(lessons)] for k in (3, 2, 1) if index - k >= 0]
    nxt = lessons[(index + 1) % len(lessons)]
    if DRY_RUN:
        return {"title": title, "script": f"Dry run lesson: {title}. " * (words // 5), "task": "none", "drill": ""}
    prompt = f"""Today is {TODAY}. Write lesson {index + 1} (cycle {cycle}) in a progressive daily learning
track called "{spec['label']}"{f', sequence "{seq_label}"' if seq_label else ''}.
Framing: {spec['framing']}

Today's lesson: {title}
Previous lessons, assume they were covered: {"; ".join(prev) or "none, this is the first"}
Next lesson: {nxt}

Write {int(words * 0.85)} to {words} words to be read aloud, roughly {max(1, round(words / WPM))} minutes. {words} is a hard
ceiling. Teach one thing properly and nothing else: the concept, one worked example with real
numbers, the one mistake people make, and a single practice task for today that takes under
fifteen minutes. If the track asks for a drill, add one that could be scored.
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
    data = parse_fields(claude(prompt, 3000, label=f"lesson {track}"), "TITLE", "SCRIPT", "TASK", "DRILL")
    if data.get("drill", "").strip().lower() == "none":
        data["drill"] = ""
    return data


def write_lessons(minutes):
    """One block, three lessons, one per track, sharing the lessons budget. Weekdays only."""
    if WEEKDAY in ("sat", "sun"):
        return None
    curriculum = json.loads((HERE / "curriculum.json").read_text())
    per_lesson = words_for(minutes) // max(1, len(curriculum))
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
            data = write_lesson(track, spec, seq_label, index, lessons, per_lesson)
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
    if TTS_PROVIDER == "openai":
        return voice_openai(text, path)
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


def voice_openai(text, path):
    audio = b""
    for i, chunk in enumerate(chunk_text(text, OPENAI_CHUNK)):
        for attempt in range(3):
            r = requests.post(
                "https://api.openai.com/v1/audio/speech",
                headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "content-type": "application/json"},
                json={"model": OPENAI_MODEL, "voice": OPENAI_VOICE, "input": chunk,
                      "instructions": OPENAI_INSTRUCTIONS, "response_format": "mp3"},
                timeout=300,
            )
            if r.ok:
                audio += r.content
                break
            log(f"openai tts chunk {i} attempt {attempt} failed: {r.status_code} {r.text[:200]}")
            time.sleep(5)
        else:
            raise RuntimeError("OpenAI TTS failed three times")
    path.write_bytes(audio)


# ---------- 4. manifest and feed ----------

VOICELESS = []   # blocks published as text only because the voice step failed


def make_block(slug, label, title, body, points, sources, day_dir, release):
    """Voice the block and build its manifest entry.

    The script has already been paid for by the time this runs, so a voice failure must not
    throw it away. On failure the block is published with an empty audio field and the
    dashboard shows it as readable but not playable."""
    path = day_dir / f"{slug}.mp3"
    audio, size = "", 0
    try:
        voice(body, path)
        size = path.stat().st_size
        audio = f"https://cdn.jsdelivr.net/gh/{REPO}@courier-audio/{TODAY}/{slug}.mp3"
    except Exception as e:
        log(f"voice failed for {slug}, publishing text only: {e}")
        VOICELESS.append(slug)
        if path.exists():
            path.unlink()
    words = len(body.split())
    return {
        "id": slug, "label": label, "title": title,
        "audio": audio,
        "bytes": size,
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
            if not b.get("audio"):
                continue                                   # text-only block, nothing for a podcast app to play
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
    global NEWSLETTERS
    NEWSLETTERS = fetch_newsletters()
    day_dir = OUT / TODAY
    day_dir.mkdir(parents=True, exist_ok=True)
    release = f"courier-{TODAY}"
    blocks = []

    failed = []
    minutes = budget(sources)

    # Feeds first, all of them, so the story plan can see the whole day before any block is written.
    log("== Feeds")
    with ThreadPoolExecutor(max_workers=8) as pool:
        items_by_block = dict(zip(sources, pool.map(lambda s: fetch_items(sources[s]["feeds"]), list(sources))))

    log("== Story plan")
    try:
        story_plan = plan_stories(sources, items_by_block)
    except Exception as e:
        log(f"story planning failed, blocks will run unplanned: {e}")
        story_plan = {}

    def build_block(slug):
        spec = sources[slug]
        log(f"== {spec['label']} start, {minutes[slug]} min")
        try:
            items = items_by_block.get(slug, [])
            data = write_script(slug, spec, items, minutes[slug], story_plan.get(slug))
            body, points = split_talking_points(data["script"])
            block = make_block(slug, spec["label"], data.get("title", spec["label"]), body,
                               points, data.get("sources", [])[:20], day_dir, release)
            log(f"== {spec['label']} done, {block['minutes']} min")
            return block
        except Exception as e:
            log(f"block {slug} failed, skipping it today: {e}")
            failed.append(slug)
            return None

    # four blocks at a time; each is a long Claude call followed by a long voice call
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(build_block, list(sources)))
    blocks.extend(b for b in results if b)   # keeps sources.json order
    if not blocks:
        raise RuntimeError("every block failed")

    log("== Lessons")
    try:
        lessons = write_lessons(minutes.get("lessons", 0)) if "lessons" in minutes else None
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
        fp = write_front_page(blocks, minutes["frontpage"])
        blocks.insert(0, make_block("frontpage", "Front page", fp["title"], fp["script"], [], [], day_dir, release))
    except Exception as e:
        log(f"front page failed, skipping today: {e}")
        failed.append("frontpage")

    total = round(sum(b["minutes"] for b in blocks), 1)
    cost = estimate_cost(USAGE)
    log(f"usage total: {USAGE['calls']} calls, input {USAGE['input']:,} + cache read {USAGE['cache_read']:,} "
        f"+ cache write {USAGE['cache_write']:,}, output {USAGE['output']:,}, {USAGE['searches']} searches; "
        f"est ${cost:.2f} at assumed rates (set COURIER_PRICE_* to match your plan)")
    if total > TOTAL_MINUTES:
        log(f"WARNING: projected run time {total} min exceeds the {TOTAL_MINUTES} min cap")
    else:
        log(f"projected run time {total} min of {TOTAL_MINUTES}")

    manifest = load_manifest()
    manifest["days"] = [d for d in manifest["days"] if d["date"] != TODAY]
    manifest["days"].insert(0, {
        "date": TODAY,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "release": release,
        "budgetMinutes": TOTAL_MINUTES,
        "plannedMinutes": sum(minutes.values()),
        "projectedMinutes": total,
        "voiceless": list(VOICELESS),
        "usage": {**USAGE, "estimatedCost": round(cost, 2)},
        "plan": [{"event": s["event"], "owner": slug} for slug, v in story_plan.items() for s in v["owns"]],
        "blocks": blocks,
    })
    manifest["days"] = manifest["days"][:KEEP_DAYS]
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    write_feed(manifest)

    # tell the workflow which days of audio to keep on the courier-audio branch
    (OUT / "keep-days.txt").write_text("\n".join(sorted(d["date"] for d in manifest["days"])))
    log(f"done: {len(blocks)} blocks, {total} min, manifest holds {len(manifest['days'])} days"
        + (f"; FAILED blocks: {', '.join(failed)}" if failed else "")
        + (f"; TEXT ONLY (voice failed): {', '.join(VOICELESS)}" if VOICELESS else ""))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"FAILED: {e}")
        sys.exit(1)
