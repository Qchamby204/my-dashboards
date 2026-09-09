# Dashboard design and maintenance

For interface changes, read `.agents/skills/apple-design/SKILL.md` and apply its relevant guidance. This project uses the MIT-licensed skill from https://github.com/emilkowalski/skills/tree/main/skills/apple-design (source blob `66f56807cb503fd482b86c4e0aaee5a080918242`). Its license is retained alongside it.

## Established product choices

- Improve one dashboard at a time. Atlas is a passive reference hub.
- Life Ledger is the user's visual reference. Preserve the suite's established panels, accents, and identity; Apple Design guides interaction quality and accessibility, not a wholesale visual replacement.
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
- The source checkout's Courier manifest may lag GitHub. Never include generated episodes, manifests, recovery requests, feeds, credentials, or records in an unrelated UI publish.
- Retain the original Life Map composition and persistence checks when changing its controls. Report browser/iPhone testing only when it was actually performed.
