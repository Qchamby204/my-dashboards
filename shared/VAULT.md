# Atlas Vault contract

The Vault on Atlas Home backs up supported browser-local Atlas records. `atlas-vault-core.mjs` owns the storage rules; `atlas-vault.js` owns the review and recovery controls. Neither sends records over the network.

## Backup scope

`TOOLS` is an exact storage-key allowlist. It covers Life Ledger, The Forge, current and legacy Prospecting records, Operations Cadence, The Herald, Master Communicator, Life Map, The Aqueduct, legacy Wealth HQ, Baby Brain, The Hourglass, Courier, and appearance. Neural Map has no persisted app records. When an app adds a storage key, review its format and sensitivity before adding it to this registry.

Unknown keys are excluded before their values are read. Gang Ops and the two test booking dashboards are outside this registry. Baby Brain voice connection settings (`babybrain.tts`) are excluded. Recognized nested credential fields cause the entire containing entry to be excluded, preserving its original structure and keeping current credential-bearing entries out of restore and recovery. This is not a general secret scanner: free-text notes remain personal data, and exported files are not encrypted.

New files and copied backups use `{ app: "atlas", version: 2, exportedAt, keys, data }`. Values in `data` are the exact stored strings. Version 1 file backups, version 1 clipboard backups using `v` and `at`, and old bare key/value maps remain readable. Unsupported entries in those older backups are skipped and counted in the preview.

## Review and restore

1. Parse the envelope and enforce bounded size (20 MiB), entry count (256), key names, JSON structure, scalar types, and known list fields. Reject unsafe object-property names. This is structural validation, not a complete migration or semantic validator for every legacy app version.
2. Capture current values and show additions, replacements, and unchanged entries by app. The user chooses which apps to restore. Entries absent from the backup stay in the browser; unchanged entries are not written.
3. Check that selected current values still match the preview. Build and verify a recovery journal in `sessionStorage` before the first application write. If recovery space is unavailable, stop without changing app records.
4. Write each selected entry and read it back. Verify the entire selection again before reporting success. On failure, attempt rollback and report whether the original values were fully verified or recovery remains incomplete.

Malformed supported entries fail validation rather than being silently omitted. A malformed current entry also stops its preview; repairing already-corrupt app data is outside this release. Download feedback confirms that the browser download was started, not that the user saved a file. Clipboard fallback must report a successful copy before advancing the backup timestamp.

## Recovery limits

- One recovery point is stored under `atlas.vault.recovery.v2` in the current tab's `sessionStorage`. It survives reload in that tab; do not rely on it after the tab closes. Starting another restore replaces that point, as explained in the review.
- The journal keeps exact previous values and SHA-256 fingerprints of incoming values. Undo restores previous values and removes entries newly added by that restore. Newer edits that match neither state are preserved and reported as conflicts.
- Recovery is complete only when every recorded key matches its previous state. Failed or partial recovery keeps the journal for retry and download. The previous-records download contains non-null previous values; it cannot represent deletions. Use in-tab recovery to remove newly added entries.
- `localStorage` is not a cross-tab transaction system. Close other Atlas app tabs before restoring and reopen them afterwards. Checks detect changed snapshots and many concurrent edits, but cannot make independent legacy writers atomic.
- Browser storage access, capacity, or integrity can fail. Recovery cannot promise durability after storage eviction, manual clearing, or tab closure. Keep a downloaded backup before moving or replacing records.
- The private Atlas OS workspace has separate D1 data and its own Export action. This Vault neither reads nor restores that database.

## Validation

`atlas/tests/vault.test.mjs` uses synthetic storage records to exercise supported formats, exclusions, selective restore, stale previews, unavailable recovery space, quota failures, silently dropped writes, rollback failures, recovery after reload, exact undo, newer-edit conflicts, forged recovery keys, and concurrent backup changes. No personal records are used. Browser interaction and visual QA are separate from these storage tests.
