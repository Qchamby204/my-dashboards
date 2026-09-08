# Original Hourglass improvements

The Hourglass is a life calendar with milestone dates, relationship spans and a chosen planning horizon. Its existing dashboard stays at `the-hourglass.html`. The shared appearance loader adds `hourglass-enhancements.js` and its scoped stylesheet only on that page. The original HTML, seeded dates, tabs and storage key remain intact.

The Weeks screen now shows the next three milestones. Today and Tomorrow use calendar dates rather than elapsed hours, so daylight-saving changes do not shift the day count. Edit opens the matching Setup field; Add milestone creates and focuses one new entry.

Milestone names and emojis now update their respective properties. Text and date changes save without rebuilding the form, preserving the active mobile field. Bond end dates cannot precede their start dates. Milestone and bond deletion Undo restores only the removed item and retains later edits or additions.

The original countdown refreshes both values immediately, pauses updates while hidden and recalculates from the clock when the app returns. The horizon field is labelled as a planning assumption. These changes add no health predictions or financial calculations.

Saving still uses `hourglass:v1` on this device. A failed write displays Retry saving and Download backup instead of quietly appearing to succeed. Backup creates a JSON recovery file; it does not add a cloud sync or import workflow.

Mobile improvements include separate rows for milestone dates, wider name fields, descriptive input/delete labels, clearer bottom navigation labels, and room for the existing dialogs and toasts. Colors follow the shared appearance preference.

Verification runs the original dashboard script and enhancement in a synthetic environment. It covers independent name/emoji edits, calendar ordering, safe deletion Undo, invalid date ranges, save recovery, countdown lifecycle and direct edit/add focus. Physical iPhone and visual browser testing remain outstanding.
