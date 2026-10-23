# Dashboard repository functional review — October 19, 2026

Reviewed `Qchamby204/my-dashboards` at main `934657b`, including the 531-file
tracked tree, public app entry points, shared runtime dependencies, generated
private Worker bundle, retained storage/recovery code, migrations, npm dependency
audit, nine workflows and the shared browser installer. This is a functional
maintenance review, not a claim that every historical feature or physical device
has been exhaustively tested.

## Update, October 23, 2026

- Courier publication has resumed. The daily workflow publishes a new edition,
  manifest and feed on weekdays. The note under "Retained deliberately" saying
  publication remains paused described October 19 and no longer applies.
- The three Ledger compatibility files (`ledger-reward-hotfix-20260916.js`,
  `ledger-season-reset-20260915.js` and `ledger-simplify-20260916.js`) were
  retired. No page loaded them, and a regression test now keeps them removed.

## Findings and changes

| Finding | Change | Evidence |
| --- | --- | --- |
| App-specific hashes were embedded in the common appearance loader, causing unrelated HTML changes and CI fanout | Move those versions to each owning page's inert JSON manifest; keep synchronous pre-boot record snapshots and conditional loading | Eleven asset-edit probes each change only their owning HTML; shared theme entries remain unchanged |
| Nested JS/MJS references retained date or `v=1` cache keys after child changes | Resolve all local shared JS/MJS/CSS dependencies from leaves upward before hashing parents | Transitive edit propagation, external URL preservation, idempotence, and cycle-before-write regressions |
| Modern Ledger requested superseded reward, season and simplification patches | Remove reward/simplification startup injection; retain compatibility files at their original URLs | Browser resource check; modern reward final-frame tests; existing Ledger interactions |
| Legacy migrations could resume after modern Ledger took ownership | Recheck `LedgerRhythm` inside each delayed migration/install attempt | Both compatibility scripts stop retries and pageshow writes after takeover |
| Shared chrome scanned all controls on text-only timer changes | Filter text-only mutations in appearance, mobile, core finish, refinements and page navigation | Five browser fixtures: 20 text updates each produce zero control scans; structural redraw and keyboard support still work |
| Navigation still needs label and selection changes without a redraw | Retain attribute observation and text changes inside the original navigation | Browser tests change selection attributes and a native navigation label |
| Courier redundantly imported its player from the shared refinements layer | Let the existing Courier HTML own its player script | Courier-only asset invalidation probe; retained Courier browser journeys |
| The build ran the experience/hash pass twice and generated the Communicator alias in two builders | Run the hash pass once, after app generation, and generate the alias there | Complete build and generated-output consistency check |
| Dashboard regression repeated the always-run Release consistency dependency install and full Node suite | Keep those steps in Release consistency; keep browser checks in dashboard regression | Workflow diff; browser tests and generation use Node built-ins and their separate pinned browser runtime |
| Shared theme documentation described the superseded mineral-grey design | Align maintenance documentation with the established warm stone/night indigo contract | No palette or interface redesign in this change |

The modern Ledger startup change removes two obsolete script requests: the reward
hotfix and the simplification script. The season-reset URL remains available only
through the legacy compatibility hotfix when the modern owner is absent.
It also removes the hotfix's persistent DOM scan. The Courier cleanup removes a
second player import. These are request/work reductions, not measured claims
about real-device launch time or battery use.

## Private bundle follow-up

The final bundle check found six directly referenced chrome files and the
mobile activity script missing from the private Worker's asset map. Its Figtree
URLs also pointed at a public origin excluded by the private content policy.
The packaging follow-up includes those seven scripts/styles, embeds the three
existing font files as authenticated binary routes, and rewrites only private
CSS font URLs to the same origin. Public assets and the content policy are
unchanged. Tests resolve bundled entry references through the actual Worker,
compare font bytes, and check that anonymous requests remain protected. The
private hosted Worker still requires its separate deployment. All 791 Node
tests pass with this follow-up, and the synthetic private Chromium check opens
the hub and Life Map without missing shared assets.

## Retained deliberately

- No unreferenced shared runtime asset was established by the filename-reference
  inventory. Compatibility URLs are not safe deletion candidates merely because
  the current startup no longer requests them.
- Historical private workspace modules still support archive, ownership, backup,
  transfer and recovery routes. Retain them with the applied database migrations.
- Embedded Chef/Baby Brain reference content and the calendar parser are active
  functionality. The large file sizes alone do not justify deleting their data.
- NorthPlan and YourWealth are independently deployable app trees. Their similar
  framework assets are not duplicate downloads within one dashboard session.
- Public Life Map continues using `lifemap_v1`; private Life Map keeps its connected
  adapter. This cleanup does not transfer or migrate records, alter schemas, or
  change the saved-record contract.
- Courier publication remains paused. Generated manifests, episodes, feeds,
  credentials and recovery requests are outside this cleanup. Gang Ops and the
  two test-booking dashboards remain outside suite-wide maintenance hooks.

## Validation

Baseline: build plus 762 Node tests passed. After cleanup, all 789 Node tests
passed. The implementation adds cache-scope,
transitive versioning, manifest/bootstrap and delayed-migration tests; existing
focus/artwork mocks now deliver actual structural MutationRecords.

- npm dependency audit: zero reported advisories at review time. This is not a
  general security certification.
- Static page inventory: 297 relative `src`/`href` references resolve; external
  services and absolute private routes are outside that filesystem check.
- Existing suite browser run: 17 dashboards × four theme/viewport combinations,
  including narrow phones and desktop, with no runtime errors or horizontal
  overflow and retained saves/goal setup.
- Core acceptance: eight app/theme cases covering Ledger, Life Map, Forge and
  Communicator; save/reload, draft retention, keyboard clearance, large text,
  landscape and accessible control names passed.
- Existing storage recovery browser run: corrupt bytes, raw export, stale-tab
  merge/conflict and explicit restore passed.
- New idle-runtime browser run: Ledger, Forge, Communicator, Hourglass and
  Operations passed; Ledger requests no superseded patches.

Local browser evidence uses Chromium 153 with Playwright's npm 1.62.1 binding.
It does not substitute for the pinned Chromium/WebKit CI matrix or physical
Safari, Home Screen, VoiceOver and touch-device verification. Check the PR's
Actions results for the final exact-head CI status.

## Remaining follow-up

1. Main remains unprotected. Require PRs and the always-run `release-consistency`
   check in repository administration; the connected app cannot change that
   setting. Pages currently deploys main independently of checks completing.
2. PR #137 contains separate large-text diagnostics and was conflicted at review
   time. It has not been silently merged, discarded or used as the cleanup base.
3. The private hosted Worker is a separate release target. Preparing and testing
   its generated bundle does not deploy it. GitHub Pages deployment only updates
   the public dashboard tree.
4. Physical iPhone/VoiceOver testing remains useful. Browser emulation establishes
   the tested conditions, not device-wide accessibility or performance claims.
