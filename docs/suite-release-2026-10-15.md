# Suite completion evidence — updated October 18, 2026

The browser-verifiable release stages below are complete. The suite is **not signed off as professionally finished**: physical iPhone, VoiceOver and installed Home Screen verification is still required.

## Released stages

| Stage | Review | Verified behavior |
| --- | --- | --- |
| Navigation recovery and startup | PR #106 | Repeated hide → focus → reveal cycles in Chromium and WebKit, including unchanged focus; upward scrolling; hidden hit testing; overflow and selected state. Save was reachable in the original accessory; Ledger now uses inline saving, covered by the later check-in journeys. Crucible’s redirect document loads no interface helpers; direct link, redirect, reload and back cycles produce no runtime errors. Library assertions wait for exact settled opacity and completed animations. |
| Shared headers and materials | PR #109 | Consistent line icons, single-row Operations Cadence/Hourglass headers, keyboard-operable app tools, quieter surfaces and stronger glass separation. Light/dark final screenshots reviewed. |
| Life Ledger | PR #110 | Check-in emphasis; labelled, quieter value graphic; consistent Save Day. Section round trips retain scroll and unfinished entries. Draft and saved check-in survive reload. |
| Life Map | PR #111 | One planning title, shorter instructions, contextual capture, retained original planning tools. Failed-save recovery remains visible in every view. Drafts, food planning, calendar links and saved tasks retain their existing formats and adapters. |
| Forge | PR #112 | Current session and next set lead. Week controls have comfortable targets. Goal switches preserve unfinished sets and session position. Set/session saves and reloads pass in both engines. |
| Communicator | PR #113 | One next practice or Resume practice. Alternatives and optional focus are secondary choices. Learning stays in Learn; rank/coaching stay in Progress. Original learning-prompt copy action, investing sources, drafts, records and backups remain available. |
| Individual visual craft | PRs #116–121 | Ledger’s original activity imagery and calm materials; Life Map’s current action before capture; Forge’s explicit next/editing set; quieter Communicator alternatives; remaining suite headers and record surfaces. Light/dark, populated, expanded, narrow, landscape and larger-text browser views reviewed. |
| Ledger navigation and achievements | PRs #122–124 | Inline Save day; card-only Today; dedicated Levels, Achievements and History; removal of three focus summaries. Collection of 60 illustrated achievements, saved-progress filters/details and a selectable projected milestone. Drafts do not unlock awards or invent pace. |
| Ledger card and page length | PRs #125–126 | Title-led card with original artwork and one Previous/Next/Save footer. One bottom navigation clearance; temporary keyboard clearance; reminder controls in History with unfinished input retained. Chromium/WebKit save/reload, keyboard and end-of-page checks passed. PR #126 passed 735 Node tests and all 19 checks at `4568c05af5cf9ad7be0c88e50d786886d7b3ce5a`. |

Each stage passed its applicable GitHub checks before merging. Public Pages deployments are checked separately from the owner-private Site deployment. Public application records remain browser-local. Private Life Map retains its connected adapter. No stage moves or seeds records merely by opening a page.

## Ledger milestone preference · October 18

Both milestone entry points now save the chosen award through the existing verified draft/settings writer. Reloads retain the choice; earned or unavailable awards fall back to an eligible upcoming milestone. The preference is included in backups and archived on explicit progress reset. Selecting it does not commit a day or alter saved progress or XP. A failed preference write retains the choice and unfinished check-in in the current tab, with the existing retry/recovery notice.

Local validation passes all 737 Node tests, including preference reload/backup coverage, failed-write retry with an unfinished entry, and earned/unavailable fallback without record writes. The Chromium/WebKit acceptance journeys exercise both entry points through reloads and verify unchanged saved-activity bytes, alongside the existing core-four save/reload, keyboard, responsive layout and feedback checks. Browser results belong to the corresponding Actions run; they do not establish physical iPhone sign-off.

## Accessibility and feedback verification

PR #114 extends checking to each navigation section and expanded disclosures in both themes and engines. It verifies accessible names, keyboard semantics and 44px targets for controls; inline prose links use the inline-target exception. Graphs offer equivalent native selection controls for every resource/topic while retaining their pointer gestures. Browser reports and screenshots are stored in the corresponding Actions artifacts.

Fault-injection journeys use synthetic, isolated records. They inspect empty, unfinished, saving, saved, failed-save and recovery states; verify that failed attempts retain work; retry; then reload and confirm saved records. Only asynchronous storage presents a sustained saving state. Synchronous local saves do not introduce artificial loading delays.

Reduced motion and increased contrast are browser-emulated. Reduced-transparency CSS rules are rendered explicitly because Playwright does not expose the operating system setting. This is rendering evidence, not an actual iPhone accessibility-setting result. The original single observer stack on the leaving Crucible document was not captured; the release removes all helper initialization from that document and verifies the entry journeys without errors.

The final map-header follow-up gives Baby Brain and Neural Map the shared Atlas / identity / Appearance / App tools row. The original search, reset, backup controls and branch text stay available in App tools. The maps retain their existing selection and zoom actions. Browser checks cover alignment, names, targets and Escape focus restoration.

## Required physical iPhone sign-off

No row below has been performed or passed in this environment.

| Check | Required evidence | Result |
| --- | --- | --- |
| Device and software | iPhone model, iOS version, browser/installed launch mode and date | Not run |
| Touch navigation | Repeated hide/reveal, upward touch scroll, taps through hidden navigation, overflow and selection | Not run |
| Layout and keyboard | Actual larger text, keyboard opening/dismissal, portrait/landscape, safe areas and Dynamic Island | Not run |
| VoiceOver | Names, reading/focus order, selected/expanded states, all controls and recovery actions | Not run |
| Accessibility settings | Real reduced transparency, increased contrast and reduced motion over busy content | Not run |
| Check-in persistence | Save a Ledger check-in; reload, close and reopen its installed app; confirm draft and record | Not run |
| Workout persistence | Save a Forge workout; reload, close and reopen its installed app; confirm unfinished set and record | Not run |
| Practice persistence | Save a Communicator practice; reload, close and reopen its installed app; confirm transcript draft and record | Not run |
| Private Life Map | Save/reopen on the existing signed-in private copy; verify its record independently from the public browser copy | Not run |

Record failures with the app, exact entry route, state before the action and recovery outcome. Preserve the working copy and backup before investigating a device failure. A browser viewport, user-agent string or simulated keyboard does not complete this sign-off.
