# Dashboard design and maintenance

For interface changes, read `.agents/skills/apple-design/SKILL.md` and apply its relevant guidance. This project uses the MIT-licensed skill from https://github.com/emilkowalski/skills/tree/main/skills/apple-design (source blob `66f56807cb503fd482b86c4e0aaee5a080918242`). Its license is retained alongside it.

## Established product choices

- Improve one dashboard at a time. Atlas is a passive reference hub.
- The October 9 dashboard suite update plan establishes warm stone and night indigo surfaces, Figtree typography, bronze actions, 24px panels, pill controls, 14px fields and an abstract horizon mark. Life Ledger remains the interaction reference. Use the shared palette and material tokens; do not restore the former condensed headings or mineral-grey design.
- Life Map must retain its original quick capture, Today, progress overview, Focus, Horizon, area board, Projects, Chores, Momentum, and editors. Its original composition lives in `atlas/life-map-legacy.html`. Do not replace these with a generic tabbed list.
- Keep explanations behind tappable, keyboard-operable **i** disclosures. Keep necessary field labels, action feedback, and errors visible.
- Life Map's header comes first. Transfer and recovery tools stay by the footer and must not leave an empty panel at the top.
- Preserve Dynamic Island clearance, rotation support, touch targets, and room for the on-screen keyboard.
- Add gesture physics or dependencies only when an actual requested gesture needs them. Native scrolling and discrete press feedback are sufficient for ordinary lists and forms.
- Respect reduced motion, reduced transparency, and increased contrast without losing state feedback.

## Implementation and records

- Extend the existing interface in place. Keep unrelated dashboards unchanged.
- Public Life Map uses the existing `lifemap_v1` browser records. Private Life Map uses its existing connected adapter. Do not move records between them automatically, seed over existing data, or migrate records merely by opening a page.
- Build with `node atlas/build.mjs`. It generates public `life-map.html` and the private assets; edit the source modules, then regenerate.
- Keep public asset references versioned when their content changes. Check the actual Pages deployment before reporting GitHub publication, and the private deployment separately when publishing there.
- `shared/atlas-refinements.js` and `.css` extend the remaining dashboards in place. The build updates their content hashes. Keep this layer free of record writes, skip Life Map's separate interaction layer, and use the shared Figtree typography. Scope new rules to the dashboard being improved.
- The source checkout's Courier manifest may lag GitHub. Never include generated episodes, manifests, recovery requests, feeds, credentials, or records in an unrelated UI publish.
- Retain the original Life Map composition and persistence checks when changing its controls. Report browser/iPhone testing only when it was actually performed.

## Shared experience contract

- Atlas remains a passive reference hub. Recently opened reads only the existing activity log and never creates tasks.
- Streaks use shared/atlas-streak.js: saved local completion days, one missed day per rolling seven days, no count for grace days or launches. Counts can be hidden from Appearance.
- Home changes to its evening set at 18:00 local. Public projections remain read-only; private priorities retain source ownership and revision checks.
- Never embed prospecting contact datasets in public source. Imports belong to the existing private/browser record and backups.
- Completion feedback follows a verified save; no confetti, sound or animated counters. Scripted motion must check reduced motion.
