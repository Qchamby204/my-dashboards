# Atlas daily workflow

This batch improves the GitHub Pages suite. It does not change the private Atlas OS Worker, database, or access policy.

## Record ownership

| Surface | Reads | Writes |
| --- | --- | --- |
| Home daily preparation | Life Map projects and completion log, communication reps, current Prospecting log, Courier practice, published Courier manifest | None |
| Courier practice | Published lesson tasks and drills; saved practice | `courier:practice:v1` only |
| Atlas Vault | Supported app allowlist, now including Courier practice | Only reviewed, selected restore entries |

The daily view is a current projection of three activity sources, not a complete or immutable event history. Reopening a Life Map project or undoing Courier practice removes that completion from the view. The view does not imply coverage of every app or synchronization with Atlas OS commitments. Unknown stores, voice credentials, and excluded dashboards are not read by the workflow projection.

## Courier practice

Each available lesson has an explicit task, optional drill, and completion button. An edition without lesson metadata offers links to available lesson editions. Listening, finishing audio, generating content, and opening a lesson never create a practice completion. There is no mastery score or inferred skill assessment.

The record is `{ version: 1, revision, completions }`. A completion includes a stable lesson ID, publication day, title, track label, timestamp, and the browser-local completion day. IDs combine publication day, block, track, sequence, and lesson index; title corrections and manifest reordering retain identity when an index exists. Older lessons without an index use their position within the block. Published editions are independent practice opportunities, even when they revisit a topic.

Records are validated and bounded before writes. Completion and undo reread the expected state, use a same-origin Web Lock where available, and verify the stored result. Unsupported or malformed records block writes; quota failures and dropped writes do not show success. Web Locks coordinate new practice controls, not unrelated writers or the legacy Vault, so these checks do not claim atomic transactions across every tab. Close app tabs before restoring a Vault backup.

Practice is backed up and restored with Atlas Vault. Courier's existing listening-history export/import remains scoped to its original listening state. Listening Reset clears only those listening keys and preserves practice. To reverse a practice completion, use its Undo button.

`courier/progress.json` continues to represent the publisher's curriculum cursor. This browser-local ledger neither changes that file nor tells the generation workflow that a lesson was learned. Completion-based curriculum scheduling would require an authenticated connection and an explicit source of authority; it is not implemented here.

## Daily preparation

Life Map deadlines include open projects due through seven days ahead, ordered by date. Overdue and due-today items are labelled; undated projects are omitted. A project's parked month does not hide an imminent deadline, consistent with Life Map's existing due-date override. Invalid calendar dates are ignored.

Next practice is the newest uncompleted lesson in the available, non-future manifest editions. Its publication date is visible. The queue covers only retained manifest editions; completed records remain stored after an edition ages out. Failed manifest loading is reported and can be retried. This is a deterministic queue, not an AI recommendation.

Recent activity uses the browser's current day and the previous six calendar days. Date-only source values retain their original day. Timestamps use the browser's local timezone. Future and older events are excluded. Saved completion days remain stable when travelling. Project titles and practice metadata stay local; no source notes or app records are posted to a service.

Current Prospecting records are authoritative when present, avoiding duplicate counts from migrated legacy logs. The Home card reads the configured target and converts numeric and ISO timestamps to the local date. Operations shows recorded task completions with `lastDone` equal to today, rather than counting obsolete `checks` properties.

Home refreshes source projections on focus, visibility changes, relevant storage events, and a local-day rollover. Its Refresh button also reloads the published manifest. Source errors are shown without disabling other apps. Available app links cover the full suite; Gang Ops and both test booking dashboards remain excluded.

## Validation

`atlas/tests/workflow.test.mjs` covers explicit completion/undo, publication and listening separation, stable identity, stale writes, malformed data, write failures, date boundaries, current activity, source failures, actual Home card readers, and Vault restore/recovery. It uses synthetic records. Browser interaction and visual QA have not been performed.
