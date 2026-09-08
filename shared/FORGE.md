# Original Forge session controls

This extension loads only in `workout-forge.html` through the shared theme. It preserves the original dashboard URL, exercise program, swaps, order, history, notes, appearance, and plate calculator. It adds generic session and storage mechanics; it does not change exercise prescriptions, body targets, or nutrition guidance. Atlas remains the reference hub.

## During a session

- Pause session freezes elapsed time. Resume excludes the paused interval from session duration. A rest timer paused by the session resumes with it; an independently paused rest timer stays paused.
- Skip for now and the Exercise selector move through the current order without marking an exercise complete. Returning to an already completed exercise does not restart its rest timer.
- A session must be finished before another is started. Hiding retains the live session, while pausing and hiding release the screen wake lock. A late wake-lock request is also released if the session has ended.
- Finish uses an in-page confirmation. Empty sessions can end without a history entry. Recorded entries retain their actual completion flags. A session spanning midnight uses its start date and records elapsed seconds separately from rounded displayed minutes.
- Cardio minutes start unrecorded. Direct entry and plus/minus controls record the entered value instead of silently substituting a planned duration. Exercise notes remain available. Incomplete set entries remain editable, while logging asks the user to complete or clear partial sets.

## Rest timer

`forge:rest:v1` stores the absolute deadline, total duration, and optional paused remainder. The timer follows wall time across browser suspension and refresh. An expired timer remains visible until dismissed and does not replay an alert simply because it was restored. Pause, resume, adjust, and dismiss controls use shared appearance tokens and reserve space beneath the live session.

This is a browser timer. Sound while backgrounded or with a locked phone is not guaranteed. No push notification, native Dynamic Island activity, or Apple Watch integration is claimed.

## Saving and recovery

The existing records remain authoritative:

| Record | Storage key |
| --- | --- |
| Sessions | `forge:sessions:v2` |
| Draft entries | `forge:draft:v1` |
| Active session | `forge:live:v1` |
| Substitutions | `forge:swaps:v1` |
| Exercise order | `forge:order:v1` |

Writes verify readback and show a notice if unavailable. Current work remains in the tab and can be exported. The original optional `window.storage` write adapter is retained with per-key promise ordering; deployed pages normally use browser local storage.

Logging first records a small pending save under `forge:pending-log:v1`. It then saves history with a stable session ID, clears only unchanged draft entries, ends the matching live session, and clears the pending record. Retry or reload resumes an interrupted save without appending that session twice. Unrelated or changed drafts are preserved. The interface pauses edits while this save needs completion. Pending saves are included in full backups.

Backup version 3 includes sessions, drafts, active session, substitutions, order, rest timer, and any unfinished save. Existing version 2 files and legacy session arrays remain accepted; older backups preserve current draft/live values that they do not contain. Imports validate structure and dates, reject unsafe object keys, require an in-page replacement confirmation, and report write failures. A later file selection supersedes an earlier unfinished read. Backup feedback states that a file was prepared, without claiming the device completed a disk save.

The loader retains original saved bytes before boot. Unreadable records block editing and saving and can be exported as a recovery file. Restore requires a valid Forge backup and explicit replacement. Recovery files preserve bytes for repair and are not directly imported as normal backups.

Deleting a session supports Undo that restores only that entry and retains later work. Clearing history requires confirmation and retains current drafts; its Undo adds back removed entries. Clearing a day's draft also requires confirmation.

## Verification

Synthetic tests run the original engine with a generic two-day fixture, without real training records. They cover pause duration, rest restoration and expiry, skip navigation, actual cardio minutes, midnight finish, partial sets, failed writes, interrupted-save recovery, complete backups, validated imports, literal input, deletion Undo, corrupt saved bytes, and late wake-lock release.

The shared mobile baseline is extended with safe-area/keyboard viewport spacing, a wrapping live-session header and action row, 44 px controls, labeled inputs, and measured clearance for the rest timer. Physical iPhone portrait/landscape, home-screen mode, keyboard focus behavior, audio delivery, and download dialogs remain unverified. No browser screenshots or end-to-end tests were run in this pass.
