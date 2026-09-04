# The Courier: one hour edition

Three files change. Upload them to the repo at these paths, replacing what is there.

    courier.html
    scripts/courier/build.py
    scripts/courier/newsletters.json

Nothing else in the repo needs to move. The workflow you committed this morning is fine.

## What is different

**Hard one hour cap.** `TOTAL_MINUTES = 60` in build.py, or set a repository variable
`COURIER_MINUTES` to change it without touching code. Every block gets a share:

    front page 3, lessons 8, markets 8, practice 7, The Ten 7, Manitoba 5, politics 5,
    climate 4, tech 4, health 3, parenting 2, sports 4

Change any of them by adding `"minutes": N` to that category in sources.json. If the numbers
you set add up to more than the cap allows, they are scaled down so the cap always holds.
Word targets are derived at 140 words a minute, a little under real narration pace, so the
audio lands under the hour rather than on it. Weekends have no lessons, so they run about 52.

**Each block is told its length is a hard ceiling,** and any block that comes back more than
15 percent over gets one tightening pass. The tightening call is cheap: no web search, short output.

**The same story no longer appears in five blocks.** Before any block is written, one planning
call reads every headline and newsletter subject for the day, collapses them into distinct
stories, and gives each story exactly one owner block. Other blocks may refer to it in a single
clause if they have a different angle, and otherwise are told not to mention it. The Ten is a
summary surface and gets the stories as context rather than a ban. The decisions are saved in
the manifest under `plan` so you can see what the planner chose on any day.

**A voice failure no longer throws the script away.** Yesterday you paid for twelve scripts and
got nothing because OpenAI had no credit. Now a block whose voice fails is published as text:
readable in the dashboard, greyed play button, tagged "Text only", skipped by Play all, and left
out of the podcast feed. The log ends with a `TEXT ONLY (voice failed):` list when it happens.

**The front page is written from talking points, not scripts,** so it cannot leak the long
versions back in, and it names each block's length when it points to it.

**Dashboard** shows the day's run time against the cap in the rail, and each block's minutes,
share and start time.

**newsletters.json** now routes the senders that showed up unmapped in this morning's log
(CBC, Globe newsletters, Stronger by Science) plus the rest of your subscription list, and has
an `_ignore` list for receipts and account mail so they stop cluttering the log. The old
`substack.com` catch-all is gone: it was filing any unknown Substack under tech. Unknown
Substacks now show up as unmapped so you can place them.

One sender is still unmapped on purpose: `buzz@tx2.beehiiv.com`. That is a shared beehiiv
sending domain, so it could be The Peak or BetaKit. Open one of those emails, look at the From
name, and add the line.

## Small fixes

- `fetch_newsletters` logged a blank when the inbox was empty; now says "none".
- `write_front_page` was parsing TASK and DRILL fields it never asked for.
- The podcast feed skipped nothing before; it now skips blocks with no audio, so podcast apps
  never get an enclosure pointing at an mp3 that was not made.

## How it was checked

Run end to end in DRY_RUN with feeds stubbed: 12 blocks, 56.5 minutes projected against 60,
prior day preserved, feed valid. Then 26 unit checks with the APIs mocked: the budget under
oversized configs and on weekends, text-only fallback, feed skipping, story ownership routing,
the tightening pass firing only when it should, the ignore list, and the front page digest.
The dashboard was exercised against the manifest the new build.py wrote, including a text-only
block. Not checked: real API calls. Watch the first live run.
