# Original Prospecting Command Center reliability

The original dashboard, contact catalog, message templates and `hq_v1` record key stay in place. The shared appearance loader adds these enhancements only to `prospecting-command-center.html`. No messages are sent by the code or by verification, and no external prospect data is queried.

## Finding and updating contacts

Database search updates the results without replacing the input or moving its caret. It matches all words across names, titles, companies, email addresses and saved notes. Explicit search includes industry peers so a known contact can be found; it does not add them to outreach queues. Stage and source filters stay available, with Clear filters and labelled inputs.

A manual change to Messaged schedules the configured follow-up interval when no date is already set. Meeting defaults to seven days. Existing chosen dates remain intact, while Pool, Replied and closed stages clear the old reminder. Repeated selection of the same stage does not log a second send. Follow-up dates are validated as calendar dates.

Today explains where each queue comes from. Its session count uses the same deduplicated queue as Run my day. Due follow-ups now respect the existing industry-peer setting consistently.

## Working a session

Skip leaves the person for a later session rather than re-adding them indefinitely. Session completion distinguishes updated and skipped contacts. Rapid duplicate actions and held keyboard shortcuts cannot consume the next card. Native activation of a focused button does not also trigger the document-level shortcut.

Undo restores only the most recent action in the current session. It removes that action's own log entries, preserves later unrelated activity and notes, and restores a temporary pitched flag. Starting a new session invalidates the old Undo.

Copy message reports success only when the clipboard write or fallback succeeds. If both fail, the field is selected for manual copying. The adjacent profile link is a separate user action, avoiding an unreliable compose URL and a popup opened after an asynchronous clipboard result. Copying does not change a stage or record a send. The user still sends the message and then records its outcome.

## Saving and recovery

Failed storage writes retain current progress in memory, with Retry saving and Download backup in the dashboard and active session. Exports use that current state. A backup download does not imply the browser has durably saved the file, and browser warnings on closing unsaved work are best effort.

The head loader retains a copy of the saved bytes before the original boot tries migration. The enhancement validates saved state; if it cannot be read, it restores those original bytes where storage permits and pauses editing. The original bytes remain downloadable. Retry loading and restoration from a valid backup provide recovery paths. The snapshot is held in page memory only.

Restore requires the existing Chambers HQ version 1 envelope and validates record shapes, stages, dates, settings, activity and templates before changing progress. It then presents an explicit replacement action and an option to download the current state first. Unknown contact IDs are retained; unsupported record shapes and unsafe object keys are rejected. Imports are limited to 10 MB. The original JSON export format remains compatible.

CSV exports preserve quoting and multiline text, include a UTF-8 marker, and treat leading spreadsheet formula characters as text. Downloads release temporary object URLs after use.

## Mobile and verification

Tabs use the measured header height, controls have descriptive labels, search fields keep their active state, and template/session panels use the shared safe-area and visible-height values. Light, dark and system themes continue through the existing style variables.

Tests run the original workflow with synthetic contacts only. They cover search field preservation, queue deduplication, follow-up defaults, skip and Undo, repeated activation, clipboard denial, failed writes, malformed saved data, explicit backup restoration and CSV escaping. Physical iPhone keyboard, clipboard, download and home-screen behavior remain untested. These changes do not revise the embedded contact intelligence, outreach text or financial assumptions.
