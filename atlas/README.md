# Atlas: a reference hub

Atlas is a passive directory of dashboards. Both the original index and private root show app links and brief descriptions, with light, dark, and system appearance. The hub does not load the planning client, query user records, generate tasks, rank priorities, or run reviews.

Earlier workspace records remain accessible through a secondary archive link. Existing databases and original app storage are retained. Individual dashboards own their functions and records.

## Dashboard 1: Life Map

Purpose: manage projects, dates, notes, and recurring household chores.

The private Life Map opens to Projects, with Chores and Timeline as separate views. Capture a project, search title or notes, filter area/status/priority, open its editor, or complete it directly. Status changes have Undo that preserves other edits. Notes support multiple lines. Native dialog controls support keyboard editing.

Chores show remaining work or all chores, with clear calendar-cycle recurrence. Backup restoration validates dates, record lists, duplicate IDs, and unsafe fields before review. Cancelling an edit and searching do not strand an unsaved-data guard. Delete Undo restores only the affected record; restore Undo refuses to replace newer changes.

Atlas now opens the upgraded Life Map at the original GitHub Pages `life-map.html` address. Projects, Chores, Timeline, editing, and backups use the existing `lifemap_v1` browser store. Opening performs no seed or migration writes. The first successful change preserves the previous bytes in `lifemap:before-github:v1`. Read failures block editing, save failures remain visible, and conflicting changes from another tab are not overwritten.

`atlas/build-life-map.mjs` generates the public page from `atlas/life-map-legacy.html`, the shared dashboard, and the browser-local adapter. The private build continues using the preserved legacy template and its existing connected adapter. Its database and private records are retained. To move private records, download a backup in the private Life Map and use Restore backup on GitHub; the public page explains that restoration replaces the current browser board after confirmation. No private records are embedded in GitHub files.

## The Herald: original dashboard

Atlas links directly to the existing GitHub Pages Herald at `https://qchamby204.github.io/my-dashboards/the-herald.html`. The mistaken private `/apps/herald` route redirects to that same address. The private build no longer contains a Herald dashboard, replacement editor, or its styles.

The original `the-herald.html` and its browser storage are unchanged. Existing private Herald records and backup APIs remain available for recovery through the earlier workspace. Nothing is automatically copied into, merged with, or removed from the original app.

## Shared records

The private Life Map runs at `/apps/life-map` and saves its records across devices. Earlier private Herald records are retained for recovery. Herald now opens its original dashboard; it does not share storage with the private workspace.

Earlier records stored in the original browser apps need one reviewed transfer through Settings. The transfer reads only the two supported app stores and excludes contacts. Original app copies remain unchanged and do not receive background synchronization. Other original apps remain separate.

## Saving and recovery

Owner-scoped APIs enforce same-origin writes, revision checks, shared priority capacity, and atomic source/detail updates. Idle refresh protects active drafts. Failed saves retain the latest draft in the open tab, with a download option. This is online saving; unsaved drafts are not persisted after closing the tab.

Migration 0009 adds source priorities and connected app details. Applied migrations 0000 through 0009 remain unchanged. Workspace backup format 8 retains these records and supports earlier formats conservatively.

## Validation

Run `node atlas/build.mjs`, then `node --test atlas/tests/*.test.mjs`.

Automated checks cover the original Herald link and redirect, the absence of a replacement Herald interface, Life Map editing, publication date round trips, shared source updates, concurrent saves, ownership, import review, and recovery. Tests use synthetic records and mock page elements. No live user records were transferred during development. Browser testing was not performed for this pass.
