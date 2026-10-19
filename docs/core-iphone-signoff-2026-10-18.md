# Core dashboard iPhone sign-off

Status: **Not run on a physical iPhone.** Browser screenshots and emulated touch do not complete these checks. Record the iPhone model, iOS version, Safari version, display/text settings and release commit before testing. Repeat in Safari and from the installed Home Screen app.

| App | Live link | Device result |
| --- | --- | --- |
| Life Ledger | https://qchamby204.github.io/my-dashboards/life-ledger.html | Pending |
| Life Map | https://qchamby204.github.io/my-dashboards/life-map.html | Pending |
| Forge | https://qchamby204.github.io/my-dashboards/workout-forge.html | Pending |
| Communicator | https://qchamby204.github.io/my-dashboards/communication-trainer.html | Pending |

Before testing, export each app's existing backup. Keep the existing records; do not reset or clear storage. Use an identifiable test entry only where needed, and remove it through the app afterward. Keep a screenshot and exact reproduction steps for each failure.

## Navigation, touch and display

- [ ] Scroll a populated screen slowly, then flick quickly. Controls respond once, content does not jump, and the final record can scroll clear of the floating navigation.
- [ ] Open every main tab, any More menu, a disclosure and a dialog. Return using their controls and browser Back where applicable. The selected view and keyboard focus remain understandable.
- [ ] Repeat at the largest supported text setting, with Increase Contrast, Reduce Transparency and Reduce Motion. Check full words, selected/focus states and access to every action. Compact navigation labels may stay smaller than content; they must remain readable and distinct.
- [ ] Rotate both ways while scrolled and while editing. Check the Dynamic Island/status area, both landscape safe areas and the Home indicator.
- [ ] Open the software keyboard, enter text, then tap Save once. The control stays reachable and saves once. Dismiss the keyboard and confirm navigation returns without covering the active record.

## VoiceOver

- [ ] Turn on VoiceOver. Swipe through the header, navigation, active record and its actions. Every control has a meaningful name, selected/expanded state and logical order; decorative imagery is not repeated as instructions.
- [ ] Use the heading rotor to reach the main content. Expand and close a disclosure, open and dismiss a dialog, and confirm focus returns to its trigger.
- [ ] Edit a value and save. Confirm the successful save is announced; an unfinished entry is never announced as a saved record.

## Save, close and reopen

- [ ] Ledger: enter a value, switch tabs, close and reopen. Recover the unfinished entry. Save the day once; close and reopen and verify its History entry. Select a projected milestone and verify that preference after relaunch.
- [ ] Map: leave unfinished capture text, change the Board date, visit Plan and return. Close and reopen; verify the draft and saved tasks. Create or edit one identifiable task for the selected day and verify it after relaunch.
- [ ] Forge: enter mandatory set values and optional effort, leave the goal and return. Close and reopen; verify the draft. Save once and verify the same set in its original goal/session after relaunch. Test the regular split separately.
- [ ] Communicator: leave an unfinished transcript, browse Learn and return. Close and reopen; verify it remains unfinished. Save a practice and verify one history record; complete a lesson and verify the next lesson after relaunch.
- [ ] Launch each installed Home Screen app after a full close. Confirm its own identity, current interface, working navigation and existing records.

## Record the outcome

For each check, record **Pass**, **Fail** or **Blocked**, the release commit and the observed result. Keep failed checks open until reproduced, fixed and retested on the device. No device result is inferred from CI.
