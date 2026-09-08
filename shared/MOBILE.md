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
