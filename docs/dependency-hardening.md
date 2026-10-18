# Development dependency maintenance — October 18, 2026

The root development-tooling audit had six findings: two high and four moderate.
The updated lockfile reports zero findings with `npm audit`. These were dependency
advisories, not evidence of an exploited production application.

| Package | Before | After |
| --- | --- | --- |
| drizzle-kit | 0.31.4 | 0.31.11 |
| drizzle-orm | 0.44.5 | 0.45.4 |
| source-map-js (transitive) | 1.2.1 | 1.2.2 |
| esbuild through @esbuild-kit/core-utils | 0.18.20 | 0.25.12 |

Drizzle Kit still declares the deprecated `@esbuild-kit/esm-loader` chain. A
targeted override replaces only core-utils' esbuild with 0.25.12, the same version
used directly by the updated Kit. Other esbuild consumers retain their own
compatible versions. Keep the override until upstream removes or updates this
legacy chain, then remove it and repeat the loader and migration tests.

Drizzle Kit now uses tsx for configuration loading. The lockfile adds its declared
tsx dependency and removes the older esbuild-register chain. Vite remains pinned
at 7.3.6. Regenerating the lockfile also resolves compatible transitive patches:
Rollup 4.63.1 → 4.64.10, PostCSS 8.5.28 → 8.5.30 and nanoid 3.3.18 → 3.3.20.
All packages remain development dependencies.

The ORM and source-map changes address the ranges reported by
[GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9) and
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
The legacy esbuild override clears
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
and the inherited findings for its parent packages.

## Verification

`npm ci --ignore-scripts` reproduces the fixed dependency tree. Both workflows
that run the complete root test suite now install that tree before testing.

The four dependency integration tests use temporary schema/migration copies and
synthetic in-memory SQLite records. They verify that:

- Generating the current schema changes no existing SQL, snapshot or journal bytes.
- Adding a nullable column appends a migration and journal entry, preserves all
  prior SQL/snapshots and journal entries, retains existing records, and passes
  SQLite integrity checks. Regenerating afterward produces no further changes.
- Quoted SQL identifiers remain identifiers and cannot execute their text as SQL.
- The overridden legacy loader still compiles TypeScript enums and module exports.

No schema, applied migration or user record is changed by this release. Local
validation includes the normal build, all 757 Node tests, the committed generated
consistency gate, and the zero-finding npm audit. PR and deployment results belong
in the release PR once GitHub completes those checks.
