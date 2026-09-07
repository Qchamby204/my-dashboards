# Atlas OS: reliable planning and recovery

Atlas has a private, server-backed workspace for synced Life Map projects and the daily and weekly commitment loop. The original GitHub Pages apps retain their URLs and storage. Gang Ops and both test booking dashboards remain outside this work.

## What works

- Capture and edit a commitment with a connected app, optional project, due date, week, and time estimate.
- Choose up to three priorities for the current local day. Complete, reopen, or archive commitments; undo completion and archiving.
- Plan across weeks, see earlier unfinished work, and compare estimates with an editable weekly time budget.
- Save a weekly reflection and export all new Atlas records as JSON.
- Import a reviewed Life Map project snapshot from a Life Map export or the existing Atlas Vault format. Imports use stable source IDs and preserve links when refreshed.
- Create synced projects or explicitly adopt imported projects. Edit, complete, reopen, archive, and restore them with revision checks. Linked commitments retain their own status.
- Review completed projects and commitments, unfinished work, next week's project deadlines, and a dated Courier practice snapshot together.
- Download synced project updates and review them in original Life Map, preserving local notes, priorities, chores, and absent projects, with verified undo.
- Open all 13 specialist surfaces, including a clearly labelled legacy Wealth HQ entry. Atlas Home is the fourteenth surface.

## Scope of the connection

Projects, commitments, reviews, and imported practice snapshots are saved in D1 and scoped to the authenticated user. Imported projects begin in snapshot mode. Choosing “Use synced project” makes Atlas the place to manage that project and protects it from later imports. Existing task links and IDs are retained. The original Life Map browser copy is separate: the migration uses reviewed file transfers, not background synchronization between origins.

The project importer sends only source ID, title, area, due date, and open/completed status after review. Local notes, chores, contact records, and credentials stay out of the request. Imports update eligible snapshot projects and never delete absent projects. A separate reviewed Courier import saves only completion IDs, lesson titles, track labels, publication days, and completion dates. Its previous snapshot is replaced so removed completions can be reflected. Atlas export version 2 includes projects, commitments, reviews, and this practice snapshot; History & recovery now reviews and restores the complete private workspace.

Cross-device saving applies inside the private workspace. The UI refreshes on return or through Refresh, rejects stale writes, and keeps unsaved form input on save failure. This is not real-time push or offline editing. Completing a commitment never automatically completes its project. Returning a synced project to import mode retains its saved values and allows later reviewed source imports again.

This release uses deterministic planning and user choices. It does not call a language model, provide an AI recommendation, or take external actions.

## Architecture

- `atlas/index.html`, `atlas/style.css`, `atlas/app.js`: accessible, responsive, dependency-free client.
- `atlas/model.mjs`: shared validation, date helpers, safe Life Map projection, and one app registry.
- `atlas/worker.mjs`: Cloudflare Worker serving the interface and authenticated JSON routes.
- `db/schema.ts` and `drizzle/`: versioned schema and generated SQLite migrations.
- `atlas/build.mjs`: stages only the new Atlas application and migrations. Legacy HTML, embedded prospect records, and excluded dashboards are not deployment assets.

Identity comes from the trusted Sites dispatcher's `oai-authenticated-user-id` header. The Site is owner-private. Every record query and mutation is scoped to that user. Do not expose the Worker directly on another host while trusting an arbitrary client-supplied identity header. State-changing requests also require a matching Origin. D1 statements use bound parameters. Revision checks reject stale edits, and a database unique index prevents concurrent priority selections from occupying the same slot.

## Development and validation

Requires Node 24 for the `node:sqlite` test harness. Run `npm ci`, `npm run db:generate` when the schema changes, `npm run build`, and `npm test`. Do not regenerate or edit an applied migration. Append a new migration for future schema changes.

Tests exercise the built Worker's fetch handler against a real in-memory SQLite database through a D1-compatible adapter. They cover owner isolation, origin and identity checks, import filtering and atomicity, duplicate import identity, duplicate capture protection, concurrent focus capacity, stale writes, reviews, export, and database failure handling. These are API and data tests, distinct from the desktop and responsive browser checks described below.

## Next implementation priorities

1. Add a grounded daily briefing using saved deadlines, unfinished commitments, and weekly priorities.
2. Extend authenticated synchronization beyond synced projects and commitments; Courier currently uses dated, reviewed practice snapshots.

## Completed: daily workflow batch

Atlas Home now shows overdue and upcoming Life Map deadlines, the next uncompleted Courier lesson in available editions, and seven days of activity from completed Life Map projects, communication reps, and explicit Courier practice. These views read existing browser records without changing the source apps. A missing or unreadable source is labelled; published lesson dates are shown so an older edition cannot look like today's briefing.

Courier now displays each published lesson's task and drill, with explicit completion and undo. Listening and content publication never count as practice. Completion records are saved locally, verified after writing, included in Atlas Vault backups, and linked back from Home to the correct available edition. Switching Courier editions stops existing playback before changing its date context. The listening-history Reset does not remove practice records.

Home includes all 13 specialist app links and its existing private Atlas OS link. Prospecting's summary uses the current HQ log, numeric or ISO timestamps in the browser's local date, and the configured target. Operations counts task records completed today rather than obsolete checkbox fields.

See [the daily workflow contract](shared/WORKFLOW.md) for record ownership, publication versus completion, and coverage limits. All new surfaces use the existing Light/Dark/System appearance.

## Completed: original Vault recovery

Atlas Home now prepares scoped backups and previews restores by app. It reads the existing file, clipboard, and bare-map backup formats, plus the new version 2 envelope. It validates supported values before writing, saves a recovery point, verifies each write, and attempts verified rollback when a restore fails. Undo survives a reload in the same tab. Credentials in recognized structured fields and unrelated dashboards are excluded; personal notes remain in exported records.

This is the browser-local Vault on GitHub Pages. It does not restore or synchronize the private Atlas OS database. See [the Vault contract](shared/VAULT.md) for supported records, recovery limits, and failure behavior.

GitHub remains the development source. The existing Pages deployment is not switched to the new Worker by merging files alone.

## Migration and recovery rules

`drizzle/0001_tidy_hairball.sql` adds conservative snapshot defaults, project revisions/timestamps, and a practice snapshot table. The earlier migration is unchanged. Existing completed project snapshots receive no invented completion date. Projects archived in Atlas retain their commitments and are excluded from new project-update exports.

The original Life Map connection panel accepts only `atlas-project-updates` version 1 files. Users choose the project rows to apply. It changes title, area, due date, and open/completed status, adds selected new projects, and preserves richer local fields. Reopening removes the local completion record; a newly applied completion is recorded on the local application day. The panel uses Vault's verified checkpoint, rollback, stale-preview detection, and same-tab undo. Close other Life Map tabs before applying updates; independent browser writers are not an atomic transaction system.

User records were not migrated during development. All validation uses synthetic records. The supervised browser now starts through the Vite development adapter. It uses an isolated in-memory SQLite database and the built production Worker. No live records, identities, or credentials enter the preview. Build before starting it; a running instance retains its initial build and requires a fresh supervised start after rebuilding. The adapter is never packaged or deployed.


## Completed: workspace recovery and persistent history

History & recovery accepts Atlas OS exports up to 8 MB. The browser and server validate the format, record types, unique IDs, project links, dates, statuses, and priority slots. Version 1 files preserve the current practice snapshot; version 2 explicitly restores it. The practice payload is limited to 1.5 MB to remain within D1 row limits. Atlas Vault exports belong to the original Home app and are rejected by workspace restore.

The preview lists additions, replacements, removals, and unchanged values for each record type. Applying it requires review acknowledgement. Restore is a full replacement of the owner's projects, commitments, reviews, and practice snapshot. It does not change browser-local app records, appearance, history, or previous recovery copies.

Before replacement, Atlas stores the current workspace in bounded recovery chunks. A D1 batch contains a workspace-generation guard, the recovery copy, replacement records, history entries, and a restore marker. A failed guard or any failed statement rolls back the whole batch. Row revisions advance so already-open editors cannot overwrite restored records. Project identity and commitment links remain intact. A network-uncertain retry must refresh and review again.

`0002_watery_rhodey.sql` appends history, checkpoints, recovery chunks, and a transaction guard. Twelve SQLite triggers record inserts, updates, and removals atomically with each save. Existing records acquire history on their next change; no past activity is invented. Practice history stores counts and provenance, not duplicate lesson contents. Each history query returns 50 entries with a cursor. Recovery lists the latest 20 copies; older copies remain reachable through their workspace history entries. Copies and history are retained until an explicit future retention policy is implemented, so storage grows with use.

A previous task, project, or review update can be recovered only while its saved revision still matches the historical after-value. A workspace-generation guard also detects concurrent changes at commit. Reversing an edit is itself a recorded save. Created records use normal edit/archive controls; practice can be replaced with a reviewed Courier snapshot. The latest workspace restore can be reversed while no later workspace change exists. Otherwise, download its recovery copy and perform a new reviewed restore. All recovery APIs scope access to the authenticated owner.

Validation includes seven additional recovery tests: full round trips across all four record groups; checkpoint retrieval and reversal; stale and tampered previews; a save between restore validation and transaction; foreign-owner ID conflicts; atomic history failure; invalid backups; and minimal practice history. A separate check verifies the secure UUID fallback used when `randomUUID` is unavailable in the HTTP preview.

Browser QA now confirms the Capture compatibility fix on a fresh build: a commitment can be captured, saved, and retained after reload. The 390px preview also exercises Capture and saving. At 320px, synthetic backup review, acknowledgement, restore, persistence after reload, recovery-copy reversal, completion, and undo all passed. Light and dark appearances were checked, including recovery dialogs and the weekly review.

The responsive check found clipped statistic labels at 320px. Today and weekly review statistics now use one row per card below 421px, with wrapping values and labels. A fresh build verified the correction at 320px in light mode and 390px in dark mode. All 48 automated tests pass. The browser checks use real iframe widths inside the isolated preview, not physical devices, touch keyboards, or production authentication.

The development adapter exposes an optional responsive QA frame at `/?viewport=390` and `/?viewport=320`, linked from the desktop preview. Both sizes use the same built Worker and synthetic in-memory workspace. These controls are excluded from the production archive. Build before starting the supervised preview; restart it after rebuilding.
