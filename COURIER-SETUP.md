# The Courier: setup

Files, keeping the paths (easiest: unzip, then Add file, Upload files on GitHub and drag
everything in, folders included; press Cmd+Shift+period in Finder to see the hidden .github folder):

    courier.html
    courier/manifest.json
    scripts/courier/build.py
    scripts/courier/sources.json
    scripts/courier/watch.txt
    scripts/courier/curriculum.json
    scripts/courier/voice_test.py
    .github/workflows/courier.yml
    COURIER-SETUP.md

Then in the repo: Settings, Secrets and variables, Actions. Add three repository secrets:

- ANTHROPIC_API_KEY (console.anthropic.com)
- ELEVENLABS_API_KEY (elevenlabs.io; the Creator tier at about US$22 a month covers an hour a day)
- ELEVENLABS_VOICE_ID (optional; pick a voice in the ElevenLabs library, copy its ID; defaults to Rachel)

Run it once by hand: Actions, The Courier daily briefing, Run workflow. About five minutes.
After that it runs every day at 5:00 CDT. Open courier.html from the Pages URL.

Listen in a podcast app: subscribe by URL to
https://qchamby204.github.io/my-dashboards/courier/feed.xml
(Apple Podcasts: Library, three dots, Follow a Show by URL. Overcast: plus, Add URL.)
The feed is marked private so directories will not index it. Each day publishes ten
episodes: a three minute front page that ranks the day, then the nine blocks.

## Newsletters (the premium sources)

1. Make a dedicated Gmail address for the Courier and subscribe to newsletters with it.
2. In that Gmail: Settings, See all settings, Forwarding and POP/IMAP, enable IMAP.
3. Google Account, Security, turn on 2-Step Verification, then search "App passwords", create
   one named courier, copy the 16 characters.
4. GitHub secrets: COURIER_MAIL_USER (the address) and COURIER_MAIL_PASSWORD (the app password).

Each run reads the last day of that inbox and routes each newsletter to blocks using
scripts/courier/newsletters.json (sender domain to block list). Newsletters become the primary
source for a block; RSS and web search are the backstop. Senders that are not in the map are listed
in the run log as "unmapped senders" so you can add them.

## Voice provider

Default is OpenAI (gpt-4o-mini-tts, voice cedar), about US$1.50 to $3 a day at full length with no
plan to buy. Secret: OPENAI_API_KEY. Change the voice with a repository variable OPENAI_TTS_VOICE
(cedar, marin, onyx, ash, echo, sage and others) and the delivery with OPENAI_TTS_INSTRUCTIONS, a
sentence or two describing how to read. Audition with:

    OPENAI_API_KEY=... python scripts/courier/voice_test.py cedar marin onyx

ElevenLabs sounds better but bills one credit per character, and a full day is about 100,000, so it
needs the Scale plan. To use it anyway, set the repository variable TTS_PROVIDER to elevenlabs.

## Choosing and tuning the narrator (ElevenLabs)

The voice is the whole product, so spend twenty minutes here before the first run.

1. In ElevenLabs, open Voices, Explore. Filter for English, Conversational or Narrative, and
   listen to the previews. Ignore anything tagged "characters" or "ads". Shortlist three.
   Good starting points: Adam, Brian, George, Daniel for a warm male narrator; Sarah or
   Matilda if you prefer a female voice. Copy each voice ID from the voice's menu.
2. Audition them on Courier text, not the ElevenLabs sample:

       ELEVENLABS_API_KEY=... python scripts/courier/voice_test.py ID1 ID2 ID3

   It renders the same paragraph (a rate decision, a client note, a Jets line) in each voice to
   out/voice-test/. Listen on the speakers you will actually use, in the car or on earbuds.
3. Put the winner's ID in the ELEVENLABS_VOICE_ID secret.

Tuning. Three knobs, all overridable as repository variables (Settings, Secrets and variables,
Actions, Variables tab) without touching code:

- ELEVENLABS_STABILITY, default 0.45. Lower is more expressive and varied, higher is flatter
  and more consistent. Robotic usually means this is too high; 0.35 to 0.5 is the range for
  news reading. Below 0.3 it starts to wander.
- ELEVENLABS_STYLE, default 0.35. How much the voice performs. 0.2 for a straight newsreader,
  0.5 if you want it closer to a podcast host. Higher costs a little clarity.
- ELEVENLABS_MODEL, default eleven_multilingual_v2, which is the most natural for long
  narration. eleven_turbo_v2_5 is cheaper and faster but noticeably flatter; eleven_v3, if
  your plan has it, is the most expressive and worth testing with voice_test.py.

Pronunciation. The script already spells out abbreviations and avoids tickers. If the voice
mangles a recurring name (Scheifele, Kinew, Bombers), add a line to STYLE_RULES in build.py
telling Claude to write it phonetically, for example "Kinew (say kin-YOU)". Cheaper and more
reliable than an ElevenLabs pronunciation dictionary.

The other half of naturalness is the writing. Sentence length variation, contractions, and
attribution phrases ("per the Globe") do more for a human sound than any voice setting, and
those live in STYLE_RULES. If the audio sounds robotic, read the script text first; if the
text reads like a press release, fix the prompt, not the voice.

Where things live:
- Audio goes to a GitHub Release per day (tag courier-YYYY-MM-DD), pruned after seven days,
  so the repo history does not grow by 30 MB a day.
- Scripts, talking points, and sources live in courier/manifest.json; the podcast RSS is courier/feed.xml. Both are committed daily.
- Listening position, listened marks, and speed live in localStorage under courier:*.

Watch list: scripts/courier/watch.txt, one item per line. Anything on it gets flagged wherever it
appears, and watch list companies lead The Ten.

Lessons: scripts/courier/curriculum.json holds three tracks (analysis, planning, communication).
The analysis track rotates by weekday to match The Crucible. Progress is in courier/progress.json,
one integer per track, advanced once per weekday. Edit the integer to skip ahead or repeat.
The communication lesson carries a scoreable "drill" field in the manifest for Master Communicator.

To change what gets covered, edit scripts/courier/sources.json. Each category has feeds
(RSS, verified working) and prefer_web (outlets Claude will search for directly, which is how
the paid or RSS-less sources like TSN, Bloomberg, and the Free Press get in).
