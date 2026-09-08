# Original Life Ledger: seasons and daily entries

This extension loads only in the original `life-ledger.html` through the shared theme. Atlas remains the reference hub. The original dashboard, catalog, goals, stored history and URL remain in place. Changes cover calendar and storage mechanics, navigation and controls; no new health, exercise, nutrition or body targets are introduced.

## Requested season

The request arrived September 7, 2026 in America/Winnipeg (September 8 UTC). Tomorrow is September 8, so the fixed default season is **2026-09-08 through 2026-12-31**. This default never moves forward on refresh. An explicitly saved season choice takes precedence.

Starting a new season changes its date bounds without deleting logged days. Saved days outside those dates, including undated legacy entries, stay in storage and backups. Totals include only dated entries within the season and no later than the device's current local day. The end date includes the whole final calendar day. Season history numbering restarts at one. Empty habit groups remain numeric. Existing streaks now use adjacent calendar dates.

## Daily use

- Open Ledger and choose Log today. The existing List view is the initial preference; Cards remains available and the preference is remembered.
- Record check-ins and a note, then use Save day. Drafts save separately on this device as fields change, so a saved draft is not counted as a logged day.
- Today, Yesterday and the date picker switch dates without discarding unfinished entries. Saved days lists both logged dates and unfinished drafts, with older dates available through Show earlier days.
- A new page load opens today. On returning from the background or crossing local midnight, a view following Today advances to the new day; older drafts remain accessible.
- Saving an existing date updates that date and keeps values belonging to hidden or unknown habits. Undo affects only the last saved date and retains unrelated later work.
- Clear requires confirmation and clears only the draft until Save day is used. Start new season uses an in-page date form and preserves history. Metric deletion now writes the metric record, and the default-habit restore button no longer calls a missing function.

## Storage and backups

| Record | Key |
| --- | --- |
| Logged days | `lifeledger:v2` |
| Goal settings | `lifeledger:goals:v2` |
| Habit settings | `lifeledger:model:v1` |
| Measurements | `lifeledger:metrics:v1` |
| Season bounds | `lifeledger:season:v1` |
| Unfinished daily entries and view preference | `lifeledger:drafts:v1` |

Writes verify readback. Failed writes display a notice with Retry and Backup. A failed Save day leaves the draft and existing history in memory; after restoring saving, use Save day again. Day writes update by date, preventing duplicate dates on retry. Browser storage remains device-specific, and saving cannot guarantee protection from browser eviction or device loss.

Version 3 backups contain the original four record groups plus season and unfinished entries. Version 1/2 and legacy day-list backups remain accepted. Fields omitted by older backups preserve their current values. Restore validates dates and structures and asks for confirmation before replacement. Import failures remain visible and retryable. Multi-record restore is not an atomic database transaction; keep the backup if any write fails.

The theme captures original saved bytes before boot. If malformed records are detected, editing and saving are blocked and a recovery download preserves those bytes. A recovery file is for repair, not normal import. A valid backup can replace the unreadable state after explicit confirmation. Existing private Atlas transfer accepts version 3 while retaining its established restriction to check-ins and notes; no new data is transferred automatically.

## Verification

Tests run the original engine with generic reading and creative-work fixtures. They cover the fixed Winnipeg start date, season bounds and local midnight, draft restoration, update-by-date, hidden data preservation, failed writes, targeted Undo, confirmed backups and restores, invalid records, empty groups, card navigation, literal unit text and repaired buttons.

Shared safe-area and keyboard behavior is extended with 44 px controls, 16 px inputs, wrapping date/actions rows and labels/state for habit controls. Existing light, dark and system appearance is retained. Physical iPhone layout, home-screen mode, keyboard behavior, downloads and assistive-technology interaction have not been verified on a device in this pass.

## Reported Forge and Life Map safe-area issue

The same batch responds to the reported Dynamic Island clearance issue. Both original headers explicitly consume the safe-area inset. The connected Life Map's outer toolbar owns that inset, avoiding duplicate top padding in nested chrome. Forge's full-screen session uses the outer panel's inset once instead of applying it again inside. Life Map's editor and Forge's confirmation dialogs use the visible viewport and safe areas.

An iPhone home-screen window receives conservative fallback clearance (64 px portrait top; 64 px landscape sides) with the larger native inset retained. This is a spacing policy, not device-model detection or a claim that every iPhone reports zero insets. Normal browser tabs and desktop windows do not receive the fallback. Orientation, resume and viewport changes recompute the spacing. The native mechanism follows [WebKit's safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/). Automated checks verify mode/orientation selection and preserved asset delivery; physical Dynamic Island rendering remains unverified.
