# Atlas OS: first working milestone

Atlas now has a private, server-backed workspace for the daily and weekly commitment loop. The existing GitHub Pages apps retain their original URLs and storage. Gang Ops and both test booking dashboards are outside this change.

## What works

- Capture and edit a commitment with a connected app, optional project, due date, week, and time estimate.
- Choose up to three priorities for the current local day. Complete, reopen, or archive commitments; undo completion and archiving.
- Plan across weeks, see earlier unfinished work, and compare estimates with an editable weekly time budget.
- Save a weekly reflection and export all new Atlas records as JSON.
- Import a reviewed Life Map project snapshot from a Life Map export or the existing Atlas Vault format. Imports use stable source IDs and preserve links when refreshed.
- Open all 13 specialist surfaces, including a clearly labelled legacy Wealth HQ entry. Atlas Home is the fourteenth surface.

## Scope of the connection

New commitments and reviews are saved in D1 and scoped to the authenticated user. Imported Life Map projects are snapshots. Completing a commitment does not update the original Life Map project. App links open the existing GitHub Pages workspaces; browser-local records there are not automatically synchronized or copied into this Site.

The JSON importer reads only Life Map projects. It sends only source ID, project title, area, due date, and status to the server after review. It does not send the original backup, contact databases, API keys, notes, or data from other apps. Importing a new snapshot updates existing projects and does not delete absent projects. Atlas exports are portable records for inspection and recovery; a full Atlas restore flow is a later milestone.

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

Tests exercise the built Worker's fetch handler against a real in-memory SQLite database through a D1-compatible adapter. They cover owner isolation, origin and identity checks, import filtering and atomicity, duplicate import identity, duplicate capture protection, concurrent focus capacity, stale writes, reviews, export, and database failure handling. These are API and data tests; a browser interaction or visual QA session has not been run.

## Next implementation priorities

1. Add an explicit, reversible live adapter for Life Map after resolving its authoritative storage location.
2. Extend activity coverage beyond Life Map, communication reps, and Courier practice.
3. Add durable event history and connect daily preparation to private Atlas OS commitments.

## Completed: daily workflow batch

Atlas Home now shows overdue and upcoming Life Map deadlines, the next uncompleted Courier lesson in available editions, and seven days of activity from completed Life Map projects, communication reps, and explicit Courier practice. These views read existing browser records without changing the source apps. A missing or unreadable source is labelled; published lesson dates are shown so an older edition cannot look like today's briefing.

Courier now displays each published lesson's task and drill, with explicit completion and undo. Listening and content publication never count as practice. Completion records are saved locally, verified after writing, included in Atlas Vault backups, and linked back from Home to the correct available edition. Switching Courier editions stops existing playback before changing its date context. The listening-history Reset does not remove practice records.

Home includes all 13 specialist app links and its existing private Atlas OS link. Prospecting's summary uses the current HQ log, numeric or ISO timestamps in the browser's local date, and the configured target. Operations counts task records completed today rather than obsolete checkbox fields.

See [the daily workflow contract](shared/WORKFLOW.md) for record ownership, publication versus completion, and coverage limits. All new surfaces use the existing Light/Dark/System appearance.

## Completed: original Vault recovery

Atlas Home now prepares scoped backups and previews restores by app. It reads the existing file, clipboard, and bare-map backup formats, plus the new version 2 envelope. It validates supported values before writing, saves a recovery point, verifies each write, and attempts verified rollback when a restore fails. Undo survives a reload in the same tab. Credentials in recognized structured fields and unrelated dashboards are excluded; personal notes remain in exported records.

This is the browser-local Vault on GitHub Pages. It does not restore or synchronize the private Atlas OS database. See [the Vault contract](shared/VAULT.md) for supported records, recovery limits, and failure behavior.

GitHub remains the development source. The existing Pages deployment is not switched to the new Worker by merging files alone.
