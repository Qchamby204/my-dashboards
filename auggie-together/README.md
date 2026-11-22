# Auggie • Together

Editable source for the family care dashboard launched from Atlas. The main screens are Log, Play and Tracker. Start in `app/care-app.tsx`; Tracker is in `app/care-tracker.tsx`, and the illustrated tummy-time logger is in `app/play-journal.tsx`.

This public working copy uses example household settings and synthetic test fixtures. Production records live in the private site's D1 database. GitHub changes are not automatically deployed to the journal.

## Development

Use Node 22.13 or later and pnpm. From this folder run `pnpm install --frozen-lockfile` and `pnpm dev`. The app requires a compatible Sites runtime with sign-in and a local D1 binding for data-backed flows. Schema migrations are in `drizzle/`.

Run `node --experimental-strip-types --test tests/*.test.ts` for unit checks. After a production Worker build, run `node tests/api.integration.mjs` against an isolated test database. For a separate deployment, configure your own Site project and database. The source folder is independent of the private deployment.
