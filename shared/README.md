# Atlas material system

Atlas uses a light neumorphic material: a mineral-grey canvas, soft directional shadows, inset controls, dark ink, and bronze primary actions. Meaningful status colours remain available alongside their existing labels.

## Integration

`atlas-neumorphism.css` owns the shared tokens, component states, responsive refinements, and app-specific treatments. `atlas-neumorphism-compat.css` adapts the legacy hardcoded palettes, including styles emitted by the existing application scripts. Its selectors are scoped with `:where()` so the shared component layer can override them without increasing specificity.

The fourteen root HTML interfaces opt in with `class="atlas-neumo"` and `data-atlas-app="<filename without extension>"`. Load the compatibility stylesheet first and the material stylesheet second, after the original styles. The new Atlas OS workspace opts in as `atlas-os`; its build combines its base CSS with the shared material stylesheet and serves both at `/style.css`.

Gang Ops and the two test booking dashboards are intentionally outside this theme. No application data, storage keys, calculations, or event handlers change.

## Material and interaction rules

| Element | Treatment |
| --- | --- |
| Canvas and raised surface | `--neo-canvas`, `--neo-surface` |
| Cards and work areas | `--neo-raised`; lighter edge; 22px radius |
| Small controls | `--neo-small`; visible boundary |
| Inputs and selected states | `--neo-inset`, `--neo-well` or `--neo-pressed` |
| Primary actions | Bronze fill; warm-white text |
| Keyboard focus | 3px blue outline with offset |
| Graphs and dense charts | Retain semantic colour and topology; avoid shadows on every data mark |
| Reduced motion | Disable animation and transitions |
| Increased/forced contrast | Strengthen boundaries; do not rely on shadows |

Text palette colours meet 4.5:1 against the inset surface. This token check is not a claim that every legacy view has received a complete accessibility audit. Preserve labels, focus indication, selected-state borders, and existing responsive behavior when extending the theme. Keep new colours in the token layer instead of adding inline palette literals.
