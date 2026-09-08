# Original Operations Cadence: clear task sources

Operations Cadence remains the existing checklist dashboard at `operations-cadence.html`. The shared appearance loader extends it in place. Its built-in reference tasks, custom entries, record key and completion history remain available. No external systems are connected and no financial or compliance guidance is changed.

## A simpler Today

Today has three sections:

- **Scheduled work:** open tasks whose explicit date or repeat schedule is due. Each row identifies the date and the schedule that put it there. The same task appears once when an older record has overlapping schedules.
- **Captured tasks:** the five newest open, undated captures, with Done, Set date, and a link to all captured tasks. A new capture no longer disappears from the screen.
- **Routine checklists:** links to the original daily, weekly, monthly, quarterly, annual and ad-hoc lists. Unscheduled routines and built-in month hints are reference material, not inferred overdue work.

The header and Today count show scheduled items due. They no longer label checkmarks from several different periods as work completed today. The on-screen explanation makes clear that these are local checklists for work completed in other systems.

## Scheduling and completion

The schedule editor offers one choice: checklist only, a single date, weekly, monthly, yearly or every N days. Repeat schedules show a starting date and exclude occurrences before it. Existing schedules retain their current interpretation until edited. Day-of-month schedules clamp to the last day of short months.

Every-N-day intervals use calendar-day differences, so daylight-saving changes do not shift the occurrence. Long intervals no longer depend on the old 400-day look-ahead. Completion for a repeating task follows its occurrence rather than the containing checklist's reset period. A fresh occurrence can be checked off with one action.

A single-date reminder is consumed when completed from a checklist or Today. Setting a new date reopens that reminder. Completing an older repeat does not discard a future single-date reminder on a legacy record that contains both.

Today completion offers Undo for that exact completion and event. Later notes and unrelated history remain intact. Captured-task completion uses the same event identity and timestamp fields in both views, including undo compatibility with older Today events. Captured tasks can change dates after creation. Deletion Undo restores only the removed item, and custom-task restoration retains an edited name without creating duplicates.

Search opens and focuses the matching task, rather than only its section. Result controls support keyboard activation. Notes and custom system labels are escaped when inserted into legacy markup, preserving them as literal text.

## Storage and recovery

Failed writes retain edits in memory and show Retry saving and Download backup. Backup contains the current full state, including notes, schedules, custom tasks, captured items and history. Restore validates the Operations Cadence version 1 envelope and known record shapes before an explicit replacement confirmation. Imports are limited to 10 MB. The stored record remains `operationsCadence.v1`.

The head loader retains the original saved bytes before the legacy migration runs. If saved data cannot be parsed or has invalid shapes, the original bytes are restored where storage permits, a recovery download is offered, and editing is paused. The pre-boot copy exists in memory only. If storage was inaccessible and no saved bytes could be read, recovery begins with Retry loading or a valid backup.

The day refreshes when the app returns or rolls over at midnight. Refresh waits while a field or dialog is active, preserving unfinished input. This does not add reminders outside the app or background synchronization.

## Verification

Synthetic tests run the original script with generic checklist fixtures. They cover source clarity, capture visibility, recurrence periods, daylight-saving transitions, long intervals, overlapping legacy dates, completion and deletion Undo, direct search focus, literal note rendering, save failures, invalid saved data, validated restore and day rollover. The regular project test suite and custom build are also required before publication.

Shared light, dark and system appearance is retained. Mobile controls and panels use the existing safe-area and visual-viewport values. Physical iPhone keyboard, date picker, downloads and home-screen behavior remain untested.
