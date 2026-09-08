# Atlas material system

Atlas offers Light, Dark, and System appearance. Light uses mineral-grey surfaces; Dark uses graphite surfaces and softer highlights. Both retain directional shadows, inset controls, bronze primary actions, and labelled status colours.

## Integration

`atlas-neumorphism.css` owns the shared tokens, component states, responsive refinements, and app-specific treatments. `atlas-neumorphism-compat.css` adapts the legacy hardcoded palettes, including styles emitted by the existing application scripts. Its selectors are scoped with `:where()` so the shared component layer can override them without increasing specificity.

The fourteen root HTML interfaces opt in with `class="atlas-neumo"` and `data-atlas-app="<filename without extension>"`. Load `atlas-theme.js` synchronously in the head before styles. After the original CSS, load `atlas-palette.css`, `atlas-neumorphism-compat.css`, `atlas-neumorphism.css`, and `atlas-appearance.css`, in that order. Palette definitions provide a light/dark pair for each legacy shade; component declarations use those tokens instead of hardcoded light values. The new Atlas OS workspace opts in as `atlas-os`; its build serves the shared script at `/theme.js` and combines the palette, material, and appearance CSS with its base CSS at `/style.css`.

The ◐ button opens the Appearance dialog. System is the default and responds to device changes. A validated `light`, `dark`, or `system` preference is stored under `atlas.appearance.v1`; storage failure falls back to an in-memory choice. Same-origin tabs synchronize through the storage event. Cross-origin navigation between the Atlas suite and private workspace carries only this preference in a validated `atlas-theme` URL parameter, then removes it from the destination URL. This is a browser preference, not account or device synchronization.

Gang Ops and the two test booking dashboards are intentionally outside this theme and its navigation handoff. Existing application data, storage keys, calculations, and event handlers are preserved.

The shared script also loads the [mobile baseline](MOBILE.md) into these existing pages. Herald's small feature improvements load only on the original Herald page. No alternate Herald interface is hosted inside Atlas.

## Material and interaction rules

| Element | Treatment |
| --- | --- |
| Canvas and raised surface | `--neo-canvas`, `--neo-surface` |
| Cards and work areas | `--neo-raised`; lighter edge; 22px radius |
| Small controls | `--neo-small`; visible boundary |
| Inputs and selected states | `--neo-inset`, `--neo-well` or `--neo-pressed` |
| Primary actions | Bronze fill with a contrasting foreground in each mode |
| Keyboard focus | 3px blue outline with offset |
| Graphs and dense charts | Retain semantic colour and topology; avoid shadows on every data mark |
| Reduced motion | Disable animation and transitions |
| Increased/forced contrast | Strengthen boundaries; do not rely on shadows |

Text palette colours meet 4.5:1 against the inset surface. This token check is not a claim that every legacy view has received a complete accessibility audit. Preserve labels, focus indication, selected-state borders, and existing responsive behavior when extending the theme. Keep new colours in the token layer instead of adding inline palette literals.

Atlas Home's backup controls use these same light/dark tokens in `atlas-vault.css`. Their separate storage and recovery contract is documented in [VAULT.md](VAULT.md).

`atlas-workflow.css` extends the material system for Home's daily preparation and Courier practice. Both use `atlas-workflow.js`; their data contract is documented in [WORKFLOW.md](WORKFLOW.md).
