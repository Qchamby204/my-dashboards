# Atlas: the daily workflow

The main navigation is Today, Apps, and Settings.

Today shows pinned records and overdue or due-today tasks, projects, and content. It shows up to six items, with the full list one click away. When nothing is due, up to three upcoming items appear. Completed work is collapsed. There is no required weekly review or priority setup.

Add task needs a name. Its visible date starts at today, or the selected planning week. Clear the date for unscheduled work. Further planning fields are optional. Saved dated tasks appear automatically. Pinning an existing item is optional and never creates a duplicate task.

Apps opens the suite. Settings contains appearance, one-time transfer, backups, recovery, and optional planning tools. Light, dark, and system appearance are retained.

## Shared records

The full Life Map and Herald interfaces run privately at `/apps/life-map` and `/apps/herald`. They share source records with Today. Scripts, notes, checklists, and chores are retained. Edits and completion update the source record. Mark published records a publication; it does not post to a platform.

Earlier records stored in the original browser apps need one reviewed transfer through Settings. The transfer reads only the two supported app stores and excludes contacts. Original app copies remain unchanged and do not receive background synchronization. Other original apps remain separate.

## Saving and recovery

Owner-scoped APIs enforce same-origin writes, revision checks, shared priority capacity, and atomic source/detail updates. Idle refresh protects active drafts. Failed saves retain the latest draft in the open tab, with a download option. This is online saving; unsaved drafts are not persisted after closing the tab.

Migration 0009 adds source priorities and connected app details. Applied migrations 0000 through 0008 remain unchanged. Workspace backup format 8 retains these records and supports earlier formats conservatively.

## Validation

Run `node atlas/build.mjs`, then `node --test atlas/tests/*.test.mjs`.

174 checks pass, including actual app editor scripts, title-only task creation, shared source updates, concurrent saves, ownership, import review, and recovery. Tests use synthetic records and mock page elements. No live user records were transferred during development.
