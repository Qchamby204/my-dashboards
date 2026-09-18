# Life Map: capture and task workflow

This update extends the original board; Atlas remains a passive index. It does not seed sample tasks, move records between origins, or convert existing tasks into invented projects.

## Everyday use

- Capture at the top or with the floating **+**. Only a title is required. Unfiled captures go into **Inbox**. Paste multiple lines for a preview; **Add & keep capturing** retains the chosen context.
- Natural-language recognition is deliberately limited: trailing today, tomorrow, weekday, ISO date, month/day, this week, next week, and an explicit **due** prefix. Interpretations are visible and can be disabled. Nothing is sent to a language model.
- **Planned for**, **planned week**, **deadline**, and **show again on** are separate. Today contains chosen tasks, genuine deadlines, and waiting follow-ups. Earlier plans offer Keep today, Tomorrow, and Next; they do not become invented deadlines.
- The completion checkbox marks Done in one action. In progress and Waiting remain intentional editor choices. Undo changes only the affected records/fields and refuses to replace newer edits.
- Areas remain the broad map. Optional projects contain tasks and show finite progress plus a next action. Tasks can have optional checklists, links, context tags and multiline notes.
- Task menus support scheduling, waiting, and editing. The expanded Projects section adds search, priority/context/area filters and selection/bulk actions. Archive is distinct from Someday.
- Chores retain their old calendar-cycle behavior unless explicitly edited. New fixed and after-completion schedules support day/week/month/year intervals. Fixed schedules preserve their original anchor through short months. Skip, complete and reschedule are distinct; only actual completions count as completed.
- Project templates are created explicitly from a project. Instantiation previews the list, creates fresh IDs, clears dates and completed states, and does not insert tasks merely by opening Life Map.

## Persistence and privacy

Public records remain under `lifemap_v1`. Existing record bytes are not rewritten just by opening the update. Optional fields are validated without a bulk migration. The existing first-change recovery copy and other-tab compare-before-write protections remain.

Unfinished capture/editor text is saved separately under `lifemap:entry-drafts:v2`; section preferences use `lifemap:view:v2`. A draft is not a completed task. A failed record save retains the form, blocks further record mutations until resolved, offers Retry/discard, and can be exported. A failed export or storage write is not reported as successful. Native confirmation dialogs remain above native task editors.

A successful record write is required before completion feedback and generic Review events are emitted. Review receives generic action types/summaries, not task titles, notes, links or waiting-person details. Draft keystrokes are not meaningful outcomes. No automatic Life Ledger credit is awarded.

Private source uses the existing authenticated/versioned connected adapter. The updated private build must be deployed separately from GitHub Pages. This release does **not** turn browser-local storage into automatic cloud synchronization, move records between the two copies, or store personal tasks in GitHub. Do not import new workflow records into an older private build.

## iPhone capture handoff

The app accepts `#capture=<URL-encoded text>&url=<URL-encoded http(s) source URL>`. A fragment avoids putting captured text in a request URL or server access log. Incoming text opens a preview and requires explicit Add; it never silently logs a task. Existing unfinished capture text is retained.

In iPhone Shortcuts, make an action shown in the Share Sheet accepting text and URLs. Get text from Shortcut Input, URL-encode it, combine it with the same Life Map URL plus `#capture=`, and use Open URLs. The Capture, saving & reminders sheet contains the address. Installing that Shortcut and choosing the intended browser/Home Screen copy are device steps; no installed Shortcut is claimed by deploying this page.

## Reminders

A saved task's Calendar reminder action creates an `.ics` event with a display alarm. The user chooses its local date/time, imports the event into their calendar, and verifies the alert. File generation alone does not schedule a notification. Floating calendar times follow the calendar's local time; check timezone when travelling.

No in-page timer is presented as background push. Native Web Push, subscriptions and notification permission are **not enabled by this release**. Existing private deployment and any future push infrastructure require separate hosting/device setup.

## Build and tests

Sources: `life-map-workflow-core.mjs`, `life-map-dashboard.js`, `life-map-interactions.js`, `life-map-records.mjs`, and the existing local/connected adapters. `node atlas/build-life-map.mjs` regenerates the public page; `npm run build` also prepares private assets.

`node --test atlas/tests/life-map-*.test.mjs atlas/tests/connected-client.test.mjs` checks deterministic rules, preservation, failure modes, native editor state, private versioned saves and generated-script syntax. `python atlas/tests/life-map-browser.py` runs interaction tests on a local server. Set `LM_BROWSER=webkit` for WebKit; `LM_OFFLINE_BROWSER=1` uses an in-memory Chromium harness in restricted workstations. Playwright is test-only, never a production dependency.
