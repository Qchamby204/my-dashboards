# Mobile baseline

Mobile support extends the existing dashboards through their shared theme loader. No dashboard is replaced, moved, or given a different storage origin. Gang Ops and the two booking dashboards remain excluded.

`atlas-mobile.js` loads `atlas-mobile.css`, enables device safe-area insets, removes viewport zoom restrictions, measures wrapping headers and fixed navigation, and supplies the current visual viewport height for editors. Scrollable table regions contain wide data instead of widening the whole page. Existing clickable tiles receive keyboard activation without replacing their click handlers or intercepting native form controls.

CSS keeps touch controls at least 44 CSS pixels where space permits, uses 16px form inputs, offsets sticky tabs by the actual header height, and reserves room for bottom controls. Narrow Herald calendars can scroll within their card. Graph canvases retain their pan and zoom gestures.

Device insets follow [WebKit's safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/). This is browser layout support around the camera housing and home indicator, not a native Dynamic Island Live Activity integration.

| Existing surface | Baseline emphasis |
| --- | --- |
| Atlas reference hub | Safe-area margins, touch links, appearance |
| Herald | Wrapping header, sticky tabs, dates, script fields, sync sheet |
| Life Map | Header, project dialogs, table scrolling, connected toolbar |
| Life Ledger | Header, dialogs, form sizing, table scrolling |
| Forge | Header, dialogs, form sizing |
| Aqueduct and Hourglass | Header, bottom navigation, content clearance |
| Communication Trainer | Header, bottom navigation, toast clearance |
| Prospecting Command Center | Header, sticky tabs, runner overlay |
| Operations Cadence | Header, sticky navigation, table scrolling |
| Courier | Viewport insets, transport/seek targets, measured player clearance |
| Baby Brain | Canvas controls, safe-area header, sheet sizing |
| Neural Map | Canvas controls, safe-area header and legend |
| Wealth HQ (earlier dashboard) | Header, form sizing, table scrolling |
| Earlier private workspace and transfer page | Form controls, modal space, safe-area margins |

## First feature pass: original Herald

`herald-enhancements.js` keeps the original Script Vault, calendar, cadence, metrics, packaging prompts, and storage key `herald:v1`. It adds vault search, title editing, live word count, and copying the script. Select all shown follows the search filter.

Unfinished new-script fields, title edits, and packaging replies are retained under `_writingDrafts` in the same Herald record. Script input saves after a short debounce, with a flush when the page is hidden or closed. Storage is still device-local. A quota or blocked-storage failure retains the current state in the tab, shows Retry/Download controls, and cannot display a successful-save toast. Delete Undo restores only deleted records, preserving unrelated writing. Clipboard fallback checks the actual copy result.

## Verification and next passes

Automated checks run the original Herald scripts with synthetic browser storage, exercising draft reload, write failure and retry, search/selection, title edits, packaging, copy failure, and Undo. Mobile checks cover changing header height, keyboard viewport values, keyboard activation, excluded apps, and private asset delivery. All original inline script bundles are syntax checked.

Physical iPhone behavior and visual layout have not been verified in this pass. Remaining device checks include portrait/landscape, installed home-screen mode, Dynamic Island clearance, keyboard opening/closing, enlarged text, and Courier transport. A baseline is not a claim that every screen and button has received an end-to-end test.

Feature work proceeds individually in the existing dashboards. Courier is next for publication and playback reliability; later dashboard priorities should follow concrete defects and the user's workflow.

## September 30, 2026 browser acceptance pass

`atlas/tests/dashboard-mobile.browser.mjs` serves the checkout locally and runs
Playwright/Chromium using an iPhone user agent, touch input, the standalone flag,
reduced motion, and 390×844 / 844×390 viewports. All 34 layout checks passed with
no horizontal page overflow or uncaught page errors across Atlas, Life Ledger,
Library, Communicator, Forge, Courier, Life Map, Herald, Chef, Crucible, Hourglass,
Operations Cadence, Aqueduct, Baby Brain, Neural Map, Review, and Compass.

Completed browser journeys with synthetic browser-local records:

- Life Ledger: select the Screen Discipline guardrail, log a slip and its trigger,
  record a reading reset, Save day, close the tab, reopen, and rotate. Its draft,
  history, rollover, and failed-save paths also have unit coverage.
- Library → Communicator: save a takeaway, preview, start 60-second practice,
  pause/resume, type, reload, protect an existing draft on a second handoff, save
  once, and preserve the source note. A reduced viewport checks transcript focus
  and scrolling with less available space; this does not emulate the iOS keyboard.
- Library's existing desktop and mobile interaction suite: reading goals and
  remainder, check-offs, notes, priorities, persistence, and backup restoration.
- Life Map: quick capture and reopen. Herald: add a script and reopen.
- Forge: enter actual cardio minutes, pause, reload, resume, and save the session.
- Courier: play/pause and automatic advance through two synthetic PCM tracks using
  the real audio element; retain the selected section. Published audio, generation,
  and publication files are not edited by these tests.

The full Node regression suite passes (492 tests). Screenshots were inspected for
the scrolling card, Library handoff, practice, and Forge session layout in light
and dark appearance during this pass. Other dashboards received opening/rotation
checks, not a claim that every control was exercised.

Physical iPhone acceptance is still outstanding: native Dynamic Island safe
areas, real keyboard opening/closing, home-screen relaunch, wake-lock behavior,
background/lock-screen audio, microphone permissions, and download dialogs. The
container has no physical iPhone access. Browser emulation is not device sign-off.

Run with Playwright available:

```sh
node atlas/tests/dashboard-mobile.browser.mjs
```

`LIBRARY_CHROMIUM` optionally selects a local Chromium executable; `QA_OUTPUT`
selects the screenshot/report folder. `BASE_URL` can target an already served
copy. Each run uses a fresh browser context and synthetic test records.
