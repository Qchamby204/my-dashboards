# Advisor Guild

A separate browser-local wealth-advisor development dashboard at `advisor-guild.html`, linked from the passive Atlas hub. It uses the existing Figtree, warm stone/night indigo and bronze system, distinct illustrated openings, three floating glass destinations, a dedicated pillar emblem, theme controls and standalone safe-area handling. No other app records are read or changed.

## Measurement contract

- A season is 28 local calendar dates, inclusive of its start and start + 27. No records are written merely by opening the app. Creating another season is explicit and preserves previous seasons.
- Targets default to 8 qualified discoveries; 4 discovery audits; 4 planning cases; 2 investment analyses; 4 explanation drills; 4 coaching drills; 4 relationship reviews; 4 implementation audits; 4 operating reviews; 2 decision reviews. These are provisional personal training targets, not industry benchmarks.
- Targets can change before the first saved unit. Voiding a unit does not unlock them. Focus can change independently, with at most three selected trees.
- A completed unit requires all tree-specific checks, a valid season date, work type, anonymous evidence code and evidence note. Codes are unique ignoring case and outer whitespace within a tree/season. Leadership also allows at most one operating review per seven-day season week.
- Each active, non-future unit earns 25 XP; every 250 lifetime XP advances practice level. Practice level is not mastery. Progress bars cap at 100%, while additional units remain recorded. Void/restore adjusts XP without deleting the original unit.
- Mastery observations have a specific skill or related attribute, date, assessor source, 1–5 behaviour rubric and evidence. They award no XP. Future observations are excluded. Same-day observations use the newest recorded one for the skill summary.
- Execution snapshots are cumulative within a selected season. Numerator and denominator must be non-negative integers and numerator cannot exceed denominator. Empty fields remove that snapshot; 0/0 displays N/A. Shortfall uses `ceil(target × denominator / 100) − numerator`, floored at zero.
- Execution targets: discovery completeness 100%; meeting follow-through within two business days 100%; advisor action reliability 95%; service commitments 100%; pre-delivery checking 100%; issue resolution 100%. Business-day counting, holiday handling and dependencies are reported from approved systems, not inferred by this dashboard.
- Outcomes are separately entered snapshots with explicit windows/as-of dates. A conversion cohort must have matured at least 90 days after its end. Retention requires 365/366 days. Net assets exclude market movement/internal transfers. New snapshots replace the displayed view, rather than adding overlapping windows. Personal conversion/retention targets are 40%/98%; asset and household targets are not fabricated.

## Records

`advisor-guild:v1` owns seasons, units, assessments, execution snapshots and outcomes. `advisor-guild:draft:v1:<tab-id>` stores editor drafts separately; drafts do not earn XP. JSON backups can merge independent IDs; conflicting versions and overlapping seasons are refused. A fresh device restores the incoming record without merging a virtual first-run season. Corrupt records stay intact until an explicit valid restore.

Writes use the existing `AtlasRecords` read/compare/merge/write/readback guard, with Web Locks where available. Save failures retain the editor, pending recovery and retry. Cross-tab competing changes block rather than silently replace records. The shared record guard's limitations on platforms without Web Locks are unchanged. Recovery exports include original/latest raw bytes and pending work. No client records, recordings or external account credentials belong in this app; only aggregate counts and anonymous learning references.

## Release checks

`node --test atlas/tests/advisor-guild.test.mjs` covers date boundaries, completion, duplicate codes, weekly review limits, XP, exact denominator shortfall, backup safety and cross-tab conflict handling. The dedicated `advisor-guild.yml` runs the repository's pinned Chromium and WebKit with narrow/standard phone, landscape, both themes, doubled text and increased contrast. It checks openings, target sizes, save/reload, duplicate rejection, reversible voiding, failed-save recovery, rates, fresh-device backup imports and corrupt-record preservation. Runner screenshots are attached to that workflow. Browser simulation does not establish physical iPhone, VoiceOver or installed Home Screen sign-off.

Run `node atlas/build.mjs` before committing: the existing shared asset graph versions the new module and stylesheet; icon links, hub catalog and Neural Map discovery are generated consistently. No new dependencies or service worker are introduced.
