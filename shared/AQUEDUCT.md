# Aqueduct: entry recovery and statement review

This pass updates the existing `the-aqueduct.html` dashboard. Its Book, Paycheque, Plan, Goals, Wealth and Review areas keep their existing calculations and records under `aqueduct:v2`. Atlas remains a reference hub. No tax, compensation, investment-return or planning assumptions are changed or independently audited in this pass.

## Changes

- Household amount, date and source survive changing the source, changing tabs and reloading. Unfinished statement text also survives. These drafts live under `_drafts` in the existing record; they do not add household entries or statement transactions until submitted.
- Statement dates such as `2026-09-01` stay on that calendar day in Winnipeg. Invalid dates remain in an explicit Undated group. Numeric slash dates use month/day/year unless the first component is greater than 12. Existing signed-amount conventions are stated beside the import control.
- Reviews retain all imported transactions up to an explicit 10,000-transaction limit. Larger imports are rejected without replacing the review. CSV/text files are limited to 5 MB. Unrecognized rows are counted and disclosed. The parser supports CSV, tab and semicolon delimiters and escaped quotes; it is not a PDF or universal bank-statement parser.
- A month selector keeps different months out of each other's totals. Comparisons use the current plan, not a historical plan snapshot. Undated rows are excluded from dated months. Merchant search, category filters and 50-row pagination expose every retained transaction. Category selectors include Money in and Ignored.
- Repeated-charge suggestions remain available, with wording that asks for review of frequency and amount. Similar charges alone do not establish a monthly bill.
- Delete Undo restores only the removed expense, debt, goal, account, household or spending entry. Clearing the household ledger requires confirmation and its Undo preserves later entries. Clearing a statement requires confirmation; Undo refuses to overwrite a newer review.
- Backup and Restore are available from every tab. The header, forms, navigation and confirmation dialogs receive safe-area spacing, readable labels, 44-pixel touch controls and keyboard support. The six-tab navigation scrolls horizontally on narrow phones and reveals the selected tab.

## Saving and recovery

`aqueduct-records.js` loads before migration. Unreadable saved data blocks editing and writing instead of replacing it with defaults. Recovery exports retain the original bytes; these are for repair, not normal Restore. Legacy keys are read without being deleted or overwritten.

Writes verify readback and report failures. A failed save retains the current state in the tab for Retry or Backup. Household submission clears its draft only in the same in-memory state as the new entry, so retrying the save cannot append that entry twice. An observed change from another tab blocks a stale overwrite. This is best-effort local-storage conflict protection, not a transactional multi-device database.

Version 1 backups use `{app: "the-aqueduct", version: 1, exportedAt, state}` and include settings, all record lists, current statement review, rules, history and unfinished entries. Restore validates structures, IDs, dates and numeric fields; requires explicit confirmation; and saves the replacement before switching the visible state. A failed restore retains the current in-tab state. Later file selections supersede earlier pending reads.

Browser storage remains device-specific. Downloads still require the user to save the file in the browser's Files or Downloads flow.

## Verification

Synthetic tests execute the original engine and controls with fictional records. They cover all six views, draft reload, source switching, calendar boundaries, a 453-transaction statement, month isolation, search, paging, recategorization, write failures, complete backups, confirmed restores, malformed data, stale file reads, another-tab writes, deletion Undo and clearing confirmation. Shared mobile checks cover the Aqueduct home-screen fallback in portrait and landscape while retaining Forge and Life Map behavior.

Physical iPhone layout, Dynamic Island clearance, browser download dialogs, keyboard appearance and assistive technology have not been verified on a device. No browser QA was requested in this pass.

## Delivery

Aqueduct runs on the original GitHub Pages origin linked by Atlas. Its HTML and three new assets must be shipped together. Saving an Atlas source version alone does not update that live Aqueduct page.

## Aqueduct Household chat updates

Aqueduct Household accepts a prepared update from the chat where the user provides statements. On the start screen or Overview, **Apply chat update** opens the file picker. The app applies the chosen file once the device ledger is unlocked. It has no upload or ledger-sync endpoint.

### Preparing a file

Use a UTF-8 JSON file with a name such as `Aqueduct-November.aqueduct-update.json`. Keep only the fields the dashboard needs. Replace account numbers with stable nicknames, remove identifying headers, and reconcile the posted transactions before approving coverage. Ask the user about choices that materially affect the plan. Leave an unsure transaction as `Review` with its question. Do not round amounts to whole dollars, infer lender terms, or mark an incomplete export as fully covered.

The envelope has `"format":"aqueduct-chat-update"`, `"version":1`, and a unique lowercase `id`. Every record reference uses a stable lowercase `key` rather than a financial account number. Use ISO dates and integer CAD cents with withdrawals negative and deposits or card-payment credits positive. The implementation and fictional test fixture in `atlas/tests/aqueduct-household.test.mjs` define the accepted entries. Optional sections include accounts, statements, projects, bills and paydays, loans, goals, category targets, baseline-month exclusions, and explicitly agreed plan assumptions.

A statement entry uses `key`, `account`, `label`, `start`, `end`, and `transactions`. Each transaction uses `date`, `description`, and `amount`, with optional `kind`, `category`, `project`, `external`, `question`, `note`, and a two-part `allocations` split. Set `coverageConfirmed` only for a complete interval and `reconciled` only when verified totals tie. For a new classification of an already-imported row, use `corrections` with the existing account key, date, description, original amount, and reference if available. Keep the same account, project, bill and loan keys across updates. Do not import payment transfers as new expenses.

The update augments the encrypted ledger and skips duplicates. Its entire application uses the existing encrypted save. It preserves newer account balances and previously configured category targets. The standalone raw CSV tools remain available under Import & review.
