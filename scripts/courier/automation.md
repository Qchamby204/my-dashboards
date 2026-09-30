# Courier independent daily timer

This is the execution contract for the existing **Courier daily delivery** ChatGPT
automation (ID `6aa0122eef3081919761c55d4178bbb8`). It is enabled on weekdays,
hourly at :17 from 05:17 through 11:17 in `America/Winnipeg`. The first check is
the normal daily wake-up; later checks are bounded backstops. Service delays are
possible. GitHub's two existing crons remain additional backstops.

The GitHub connector currently exposes content updates, not workflow dispatch.
Consequently the independent timer uses one small authenticated **push signal**,
`courier/daily-trigger.json`. This is not a new hosting service, credential, model
call, or guarantee of precise delivery. `courier/recovery-request.json` is now
reserved for explicit manual fallback. Do not run the former recovery automation
alongside this one; update it in place.

## One timer check

1. Use the actual current date/time in America/Winnipeg. Outside weekdays or
   before 05:17 or after 11:59, do nothing. Preserve finished sections, audio,
   curriculum progress, records, credentials and unrelated dashboards.
2. Through the connected GitHub tools, read `courier/manifest.json`,
   `courier/status.json`, `courier/daily-trigger.json`,
   `courier/automatic-state.json` and `scripts/courier/sources.json` on `main` in
   `Qchamby204/my-dashboards`. Use `github_fetch_file` so the signal's exact blob
   SHA is available. Read runs through `github_fetch` at
   `https://api.github.com/repos/Qchamby204/my-dashboards/actions/runs?per_page=100`;
   paginate as needed for current activity and the latest successful Pages run.
   If access, JSON, timestamps or run evidence is invalid, report the blocker and
   make no write. Never print briefing scripts, credentials or private content.
3. If **The Courier daily briefing** is queued, requested, waiting, pending or
   in progress, do not submit another signal. Report an active run older than
   90 minutes without cancelling it. If today's edition exists and Pages is
   active, wait for the next check. Do not race an in-flight publication.
4. If today's edition is absent, it needs a wake-up. If present, it must have
   nonempty blocks with valid unique IDs, scripts and generatedAt. A malformed
   edition is an error, not permission to replace it. Expected sections come
   from its `expectedSections`, or weekday `lessons` plus configured source
   keys when that field is absent. **Frontpage is retired and never a gap.**
   Missing expected blocks or missing audio are repair gaps. The workflow, not
   this checker, selects the sections to repair under the shared lock.
5. For an edition with no gaps, verify delivery before deciding it needs a signal.
   Find the latest completed successful **pages build and deployment** run on
   main; read the manifest and status at its full `head_sha`. The deployed
   edition must equal today's main edition, including generatedAt, updatedAt,
   scripts and exact audio URLs. Require a matching Complete status with the
   same timestamps and audio map, no missing sections/audio, and verifiedAt
   after the latest edition timestamp. Also require a successful Courier job
   whose non-skipped **Publish and verify the live edition** step logged
   `Courier YYYY-MM-DD: live edition verified` after the edition timestamps.
   Use `github_fetch_workflow_run_jobs` and `github_fetch_workflow_job_logs`.
   A commit, accepted signal, stale deployment or skipped verification is not
   publication proof. If fully verified, do nothing; routine success is silent.
6. For a missing/partial edition, if automatic-state already records three
   generation attempts for today, report the cap and gaps; do not signal more
   generation. The workflow also enforces this cap across the independent timer
   and GitHub crons, reserving each attempt on main before paid calls. A complete
   edition may still need publication-only verification, which uses no model or
   voice calls. Never reset or edit the automatic-state ledger.
7. If a wake-up/repair/publication check is needed, the **only repository write**
   allowed to this timer is `github_update_file` on `courier/daily-trigger.json`
   on main using its freshly read blob SHA. Its exact JSON fields are
   `schemaVersion: 1`, `date: TODAY_IN_WINNIPEG`,
   `requestedAt: CURRENT_ISO_TIMESTAMP_WITH_TIMEZONE`, `attempt: N`, with a
   trailing newline. N is 1 on a new day or today's previous integer attempt
   plus 1. Never exceed three signals per weekday, even for publication-only
   retries. The null/zero placeholder is valid only before the first signal.
   Use commit message `Courier daily trigger: YYYY-MM-DD attempt N`.
   Do not choose sections, update the manual recovery file, edit any other
   file, force a rebuild, rerun jobs, change workflows, or call model/voice APIs.
   On a SHA conflict, re-read all relevant state and runs once and reconsider;
   never overwrite a newer signal blindly.
8. After a write, keep its returned commit SHA and look for its matching Courier
   push run with at most 60 seconds of bounded waiting. Say requested/started,
   never published until the exact deployed edition, status and verification
   log pass step 5. Briefly notify for a new request, newly verified delivery,
   missing sections, exhausted attempts or a new error. Avoid repeated unchanged
   notices. Include the Winnipeg date/check time, relevant run link, and
   https://qchamby204.github.io/my-dashboards/courier.html. Send no messages to
   other people. Keep the automation enabled after each day's success.
