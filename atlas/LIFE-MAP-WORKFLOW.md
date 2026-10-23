# Life Map: capture and task workflow

This update extends the original board; Atlas remains a passive index. It does not seed sample tasks, move records between origins, or convert existing tasks into invented projects.

## Everyday use · October 23, 2026

Life Map has three primary destinations:

| Destination | Contents |
| --- | --- |
| Home | Existing illustrated current-focus card, then Daily mandatory with direct checkbox-style completion, today's dated tasks and completed-work recap. Optional daily preparation links follow in a disclosure. |
| Projects | All project cards and standalone tasks, a compact saved-project filter plus All, and Open / All / Completed task filters. Project tasks expand within their project. Routines remain available in All projects. Food coverage and the optional operations picker remain available. |
| Calendar | The selected calendar month, its active project names and dated tasks, project range bars, a selected-day agenda and a next-12-month selector. Apple Calendar and the existing day-planning prompts are optional tools below. |

Choose **Add task** from the opening card to enter the task, category and date in one sheet, then save once. Category contains only active saved project names; choosing one saves the task under that project. Home has no separate inline capture section. A title alone remains valid; unfiled, undated tasks are available in Projects. Natural-language parsing, multiline preview and continued capture remain under More options. Project and date survive an unfinished-draft reload.

Project range bars and the project names on the calendar opening open the existing project editor with Start date and End date. Save project to update its position; task plans and real deadlines retain their own dates. Existing projects without explicit ranges use their saved task dates. Unscheduled projects have a Set dates action. Browsing months, categories and tasks never changes saved records. The next-12-month selector starts with the current month and crosses year boundaries.

Home's mandatory checklist uses saved daily routines, explicitly scheduled routines and repeating occurrences due today. Completed items remain visible for the day and can be unchecked. A future repeating occurrence is not presented as already completed. Skips retain their separate state. The source records, recurrence anchors and verified save/retry/Undo remain authoritative.

Projects' **More tools & full record** keeps the original Today, weekly shortlist, progress overview, Next/Focus, Horizon, area map, Projects, Chores and Momentum tools. Task menus retain scheduling, waiting, notes, checklists, links, context tags, bulk organization, archives and explicit project templates. The floating capture launcher is reserved for this full-record view.

Legacy `#areas`, `#plan` and `#board?day=…` links resolve into Projects or Calendar. The canonical routes are `#home`, `#projects` and `#calendar?month=YYYY-MM&day=YYYY-MM-DD`.

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

Sources: `life-map-calendar-core.mjs`, `life-map-day.js`, `life-map-workflow-core.mjs`, `life-map-dashboard.js`, `life-map-interactions.js`, `life-map-records.mjs`, and the existing local/connected adapters. `node atlas/build-life-map.mjs` regenerates the public page; `npm run build` also prepares private assets.

`node --test atlas/tests/life-map-*.test.mjs atlas/tests/connected-client.test.mjs` checks deterministic rules, preservation, failure modes, native editor state, private versioned saves and generated-script syntax. `python atlas/tests/life-map-browser.py` runs interaction tests on a local server. Set `LM_BROWSER=webkit` for WebKit; `LM_OFFLINE_BROWSER=1` uses an in-memory Chromium harness in restricted workstations. Playwright is test-only, never a production dependency.


## Earlier navigation · superseded by the three destinations above

Home opens with a single current recommendation, foundation status, category summaries and real deadlines. Plan opens on today’s to-dos and time blocks, with an explicit review and optional different-day planning. It does not require a main-priority selector. Editable ideal-day starters cover morning preparation, health, work, home, relationships, growth and downtime; opening or selecting a starter does not create saved records. Areas has Food, Household, Family, Health, Work & growth, and Money & admin tabs. Board retains the original Today, weekly plan, progress overview, Next, Horizon, area board, Projects, Chores and Momentum. Category views reference existing task/chore records; they do not create copies or migrate areas.

`mealCoverage` stores the first covered dinner, the number of prepared dinners, optional skipped dates and calendar alert time. One dinner means one household evening covered. Coverage is calculated in calendar dates without writes on opening or midnight. Five dinners Monday–Friday produce a Thursday prep reminder. The reminder remains on Home and Food until coverage is extended or replaced. Skipping an evening retains a dinner and shifts the end/reminder dates. Adding dinners after coverage has expired starts new coverage today. This is a planning projection, not a food-freshness assessment.

The in-app reminder is automatic when opening Life Map. Export calendar alert creates an ICS event with VALARM; the user must import it for an alert while the app is closed. Export again after changing coverage. There is no background push service.

`dayPlans` and `dayTemplates` are optional fields in the existing store and backup format. Starting a task/block pins the recommendation until explicit completion or a change of plan. Passing a block end never completes the block or its linked task. Marking a block done does not complete a linked task. Actual task deadlines are preserved. Time blocks must not overlap and cannot extend past midnight. Inputs persist in a separate browser draft key; saves use the existing transactional adapter, conflict/recovery checks and Undo. Public and private source assemblies share the same UI and validation; publishing the public HTML does not deploy the private Worker.

Home’s recommendation considers real deadlines, the current time block, a due dinner-prep reminder, due routines and chosen work, while preserving an explicitly started focus. Unknown dinner coverage remains visible without blocking existing to-dos. Each category has an operating overview and can create a recurring responsibility. On phone screens, paired form fields stack, native date/time controls are constrained to their field, and the floating capture button is reserved for Board. Chromium and WebKit regression checks cover individual field containment, sibling overlap, dark iPhone standalone simulation and portrait/landscape layouts.

## Retained day-planning tools

Time-block creation and ideal-day repetition are removed from the operating UI. Plan retains Build around your day: its prompts pull related existing tasks and routines, and explicit scheduling assigns them to the selected calendar date. Board is the selected day’s scheduled-task view with deadlines, routines and explicit completion. Right now links to the corresponding task on today’s Board. All records & projects keeps the original complete Life Map available. Existing saved blocks/templates remain intact for backup compatibility and do not drive Right now. This view uses Life Map tasks only; it does not connect or synchronize the user’s real calendar.
