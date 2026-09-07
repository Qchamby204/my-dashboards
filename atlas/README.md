# Atlas: a reference hub

Atlas is a passive directory of dashboards. Both the original index and private root show app links and brief descriptions, with light, dark, and system appearance. The hub does not load the planning client, query user records, generate tasks, rank priorities, or run reviews.

Earlier workspace records remain accessible through a secondary archive link. Existing databases and original app storage are retained. Individual dashboards own their functions and records.

## Dashboard 1: Life Map

Purpose: manage projects, dates, notes, and recurring household chores.

The private Life Map opens to Projects, with Chores and Timeline as separate views. Capture a project, search title or notes, filter area/status/priority, open its editor, or complete it directly. Status changes have Undo that preserves other edits. Notes support multiple lines. Native dialog controls support keyboard editing.

Chores show remaining work or all chores, with clear calendar-cycle recurrence. Backup restoration validates dates, record lists, duplicate IDs, and unsafe fields before review. Cancelling an edit and searching do not strand an unsaved-data guard. Delete Undo restores only the affected record; restore Undo refuses to replace newer changes.

The original Life Map source and browser records remain unchanged. Atlas links to the improved private Life Map. The remaining dashboards are reviewed individually, with The Herald next.

## Shared records

The full Life Map and Herald interfaces run privately at `/apps/life-map` and `/apps/herald`. Their records are saved privately across devices. Scripts, notes, checklists, and chores are retained. Edits and completion remain within their app records. Mark published records a publication; it does not post to a platform.

Earlier records stored in the original browser apps need one reviewed transfer through Settings. The transfer reads only the two supported app stores and excludes contacts. Original app copies remain unchanged and do not receive background synchronization. Other original apps remain separate.

## Saving and recovery

Owner-scoped APIs enforce same-origin writes, revision checks, shared priority capacity, and atomic source/detail updates. Idle refresh protects active drafts. Failed saves retain the latest draft in the open tab, with a download option. This is online saving; unsaved drafts are not persisted after closing the tab.

Migration 0009 adds source priorities and connected app details. Applied migrations 0000 through 0008 remain unchanged. Workspace backup format 8 retains these records and supports earlier formats conservatively.

## Validation

Run `node atlas/build.mjs`, then `node --test atlas/tests/*.test.mjs`.

175 checks pass, including actual app editor scripts, project completion and Undo, shared source updates, concurrent saves, ownership, import review, and recovery. Tests use synthetic records and mock page elements. No live user records were transferred during development.
