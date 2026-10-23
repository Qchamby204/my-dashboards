# Release safeguards

`npm run check:generated` runs the normal build and fails if any tracked file
differs from HEAD afterward, including staged changes. Run it from a committed
checkout. A failure prints filenames rather than large generated diffs. Review
and commit generated changes before repeating it. Ignored build products in
`dist/` are not committed outputs and are outside this check.

The always-triggered `Release consistency` workflow provides the uniquely named
`release-consistency` check for every PR and main push, without path filters.
Existing jobs that generate files also run this gate before testing. The full
Node test suite and its dependency install run once in Release consistency; the
dashboard regression job runs its browser journeys and idle-runtime checks. The other
browser workflows retain their focused triggers; changes to their shared browser
installer or version pins trigger all six browser workflows.

Browser tooling is centralized in `.github/browser-tooling.json` and installed by
`.github/actions/setup-test-browsers`. On October 18, 2026, npm's published
`playwright-core@1.62.1` tarball and PyPI's published `playwright==1.62.0` wheel
contained identical `browsers.json` manifests. Python does not publish a 1.62.1
binding. Both pins select Chromium revision 1234 and WebKit revision 2336.
The installer verifies these revisions before downloading browsers. Update both
pins together after comparing the packaged manifests; do not assume matching
patch numbers exist. CI runs both Chromium and WebKit for both bindings.

Read-only check workflows cancel superseded PR runs within that workflow and PR.
Main checks use a separate branch group with cancellation disabled. Courier's
publication concurrency remains unchanged. Its weekday build job was
resumed by the owner and runs on schedule.
The GitHub-managed Pages deployment workflow is unchanged.

## Administrator setting still required

Main was confirmed `protected: false` on October 18, 2026. This change does not
enable branch protection, and the connected GitHub tools cannot change repository
administration settings. An administrator should add a rule for `main` requiring
a pull request and the `release-consistency` GitHub Actions check, require the
branch to be current before merging, block force pushes and deletion, and apply
the rule to administrators if bypasses are not intended. The always-run check
avoids making a path-filtered workflow a universally required status.

Focused browser checks must also pass for the affected release before merging.
Pages currently publishes main independently of test completion. The repository
changes make failures visible; branch-rule enforcement still needs the setting
above. No claim is made that this gate orders or blocks the managed Pages job.

Browser emulation does not establish physical iPhone touch scrolling, VoiceOver,
larger text, keyboard, rotation, Dynamic Island clearance, Home Screen launch or
save/close/reopen persistence. Those checks remain outstanding.
