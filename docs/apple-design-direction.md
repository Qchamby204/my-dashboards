# Atlas visual direction

The suite keeps its warm stone and night indigo palette, Figtree type, bronze actions and horizon identity. Apple’s guidance informs the hierarchy and behavior; this is a web implementation with its own identity, not a reproduction of native Liquid Glass.

## Publication audit · October 15, 2026

The earlier aesthetic attempts were published. PR [#103](https://github.com/Qchamby204/my-dashboards/pull/103) merged at `f6a43b79ff9dbc60ce4604645dbb325e13f16940`; PR [#105](https://github.com/Qchamby204/my-dashboards/pull/105) merged at `008d93e8a33ba503739c56b8a87817d39da433b4`. Their `shared/core-app-finish.css` and script remain in main. Navigation and header refinements through [#115](https://github.com/Qchamby204/my-dashboards/pull/115) are also merged. The remaining problem is visual craft and consistency, rather than those PRs waiting to ship.

Review of the released Chromium/WebKit screenshots found excessive outlined pills, weak differentiation of text from controls, inconsistent native form surfaces, a neon edge on Ledger’s activity card, redundant level metadata in its header, and XP explanation competing with the check-in. Later passes must review every dashboard; improvements to shared colors alone do not establish consistency.

A separate cache-versioning defect was confirmed: the dynamically loaded Ledger, Forge, Communicator, Hourglass and Baby Brain stylesheets retained older version values after CSS edits; the mobile stylesheet had no version. The files on the server matched the released source, but an existing browser cache could continue displaying an earlier appearance. The build now versions nested CSS dependencies before hashing their script and theme loaders. This is a possible explanation for changes appearing absent on an existing installation, not proof of what any particular device cached.

## Visual contract

| Element | Direction | Review evidence |
| --- | --- | --- |
| Main task | Put the current record or next useful action first. Supporting progress follows it. | The first phone screen makes its main action obvious, without chrome covering it. |
| Typography | Figtree; 32px screen title, 21–24px record title, 16px body, 13–14px metadata at the default size. Tight heading tracking, relaxed body leading, proportional scaling with larger text. | Populated, narrow, landscape and larger-text views retain clear reading order. |
| Content surfaces | Solid, calm cards with a subtle separator against the canvas. Use spacing and alignment before borders. Avoid gradients, glows and raised or inset shadows on ordinary records. | Records remain distinct in both themes, including scrolled and expanded details. |
| Floating controls | Restrained glass for navigation and its save accessory. Readable labels, defined edges, controlled shadow. Solid material for reduced transparency or increased contrast. | Busy content does not remain readable through labels; hidden controls cannot intercept taps. |
| Actions | Bronze for the main commitment, tonal styling for an action within a record, plain styling for secondary links. One or two prominent actions per view. Pills are compact actions, not a treatment for all text. | Controls have visible press, selection and focus states; saved and failed states include words. |
| Choices | A segmented control is one quiet group with a distinct selected segment. Normalize native fields in each theme. Keep controls at least 44 CSS pixels in each operable dimension. | Touch targets, keyboard navigation and selected state remain clear at increased contrast. |
| Headers | Home, identity, related tools and Appearance in a stable arrangement. Avoid repeating progress metadata in the header and body. Icons share a consistent line weight and optical size. | Status-area clearance, no clipped titles and no tool wrapping at supported widths. |
| Information | Keep necessary labels and feedback visible. Put longer explanations behind named, keyboard-operable information disclosures. | Expanded help does not overlap controls or conceal the active record. |

These are product choices derived from Apple’s principles, not measurements mandated by Apple. Native Dynamic Type, VoiceOver, actual touch physics and Home Screen behavior require physical-device verification.

## First reference pass: Life Ledger

Ledger’s check-in leads Today. Level and achievement links follow the log. The header keeps identity and tools in one row. Activity records use solid surfaces with the original full-colour habit imagery, without neon edges or inset/raised effects. The user prefers that activity imagery; navigation and utility controls retain their line icons. Cards/List becomes a single segmented choice; the activity picker follows the theme. XP remains accurate and visible in a shorter line. Save day retains its floating accessory and navigation recovery behavior. Card and list views, help, progress, history and all record tools remain available.

Ledger component styling belongs in `shared/ledger-enhancements.css`; the retired competing Ledger decorations have been removed from `shared/core-app-finish.css`. Do not add a second aesthetic override layer. Data adapters, record formats, rewards and save behavior are outside this visual change.

The remaining dashboards still require individual visual passes against this contract. This release does not establish full-suite aesthetic completion. See [the suite verification record](suite-release-2026-10-15.md) for outstanding real-iPhone checks.

## Primary guidance

- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials): reserve Liquid Glass for the functional layer and use it sparingly.
- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout): order content by importance, align related elements and group related functions.
- [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography): preserve legibility and hierarchy as text scales.
- [Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons): distinguish preferred actions by style, limit prominence and provide comfortable targets and press feedback.

### Life Map: next action before capture

Home presents its existing chosen task before the original capture controls, preserving their draft and handlers. Planning, area records, day blocks and project tools remain in their existing sections. Content uses solid surfaces with no raised shadows; only navigation uses glass. Area selection uses an underline and weight, and supporting controls use quiet tonal surfaces. Native date fields follow the selected theme.

### Forge: session and next set

Goal and exercise records use solid surfaces without lifted shadows. The existing current-session action leads the editor. The next or unfinished set has an explicit Next/Editing label and step semantics; saved sets retain their distinct completion state. Week and day controls remain full-size and quieter, and rest stays with the exercise. No workout records or adapters change.
