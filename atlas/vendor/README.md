# Calendar parsers

`apple-calendar-parsers.mjs` is an unminified, dependency-free ESM bundle of
ICAL.js 2.2.1 (MPL-2.0) and fast-xml-parser 5.11.2 (MIT), produced with esbuild
0.25.12. ICAL.js source is present in the bundle; upstream source:
https://github.com/kewisch/ical.js/tree/v2.2.1
https://github.com/NaturalIntelligence/fast-xml-parser

Entry: `import ICAL from 'ical.js'; import {XMLParser,XMLValidator} from
'fast-xml-parser'; export {ICAL,XMLParser,XMLValidator};`
Build with esbuild `--bundle --format=esm --platform=neutral --main-fields=module,main`.
Bundled dependency licenses are retained alongside this file. No application
credentials or records are embedded in this bundle.
