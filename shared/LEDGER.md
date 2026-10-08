# Life Ledger: ongoing progress and weekly rhythm

The original Life Ledger URL, visual language and device-local records remain in place. This extension changes the goal model and check-in flow without introducing new health or body targets.

## Goals and progress

Each habit can be an ongoing practice, a milestone, or an actual deadline. Practices have normal and smaller weekly targets, measured in completed days or the habit's amount. Milestones start from a saved baseline of accumulated progress; only actual deadlines require a date. There is no automatic December 31 finish or season reset.

Lasting totals include saved past records, undated legacy history, and remembered weekly catch-up. Recent weekly rhythm is shown separately. Future-dated entries do not count yet. Earned achievements remain claimed after smaller weeks, goal changes, or Undo. Archived season settings remain available in backups.

Up to three focus habits appear in the main check-in. All other enabled habits remain available through Show all habits and goal settings. LinkedIn Strategy is excluded from active habits; its historical entries remain stored and exported.

Blank days are unknown. A dated check-in can explicitly record "Didn't do" or return to unknown. Quick catch-up records a whole remembered weekly total and optionally completed-day count. It adds only the difference above individually dated entries, so filling in those dates later does not double count. It does not invent daily dates or streaks.

## Screen time

The leisure controls now track scrolling and video games combined, with a fixed daily boundary of strictly less than 60 minutes. There is no habit-based gaming unlock or reading penalty. The manual timer measures only sessions started in Ledger; it does not access system Screen Time or block apps. Confirm or edit the full day's total, including usage outside the timer, to update the habit. Exactly 60 minutes does not qualify. A timer crossing midnight splits its recorded minutes by local date.

Legacy gaming totals and reading-reset fields are retained. An old gaming-only record does not automatically confirm a combined screen total. Guardrails, slips and reset notes remain separate from the daily outcome.

## Storage and backups

Existing keys remain `lifeledger:v2`, `lifeledger:goals:v2`, `lifeledger:model:v1`, `lifeledger:metrics:v1`, `lifeledger:season:v1`, and `lifeledger:drafts:v1`. Weekly goal settings, focus, week choices, catch-up and earned achievement names live inside `drafts.rhythm`, included in version 3 backups. Opening the app does not migrate or rewrite saved history. The prior season and habit simplifiers are skipped when the ongoing core is loaded.

Drafts persist separately from saved days. Saving updates by date and preserves hidden or unknown habit values. Undo affects only the last saved date. Writes verify readback; failed saves show Retry and Backup and do not claim success. Backups validate structures before confirmed restore. Older backups remain accepted and omitted fields preserve current values. Malformed records block editing and offer the original bytes in a recovery download. Browser storage remains specific to this device.

The private Atlas transfer remains restricted to its established check-ins and notes; the new fields are not transferred automatically.

## Verification

`node --test atlas/tests/ledger-original.test.mjs atlas/tests/ledger-rhythm.test.mjs` exercises saved-data compatibility, weekly calculation, catch-up deduplication, unknown/missed days, fixed screen-time boundaries, timer checkpoints, drafts, failed writes, backups, Undo and navigation. `atlas/tests/ledger-browser.py` covers isolated mobile browser journeys in Chromium and WebKit through the Life Ledger UI workflow. Physical iPhone and home-screen behavior requires separate device verification.
