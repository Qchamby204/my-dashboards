# Atlas reminder delivery

Status: Render delivery service is deployed at https://atlas-reminders.onrender.com. Background push requires an enrolled phone. GitHub Pages alone cannot deliver background reminders. No live subscription, pairing secret or VAPID key belongs in this repository.

## First release

The public `reminders.html` page supports editable weekday and one-time schedules, dashboard destinations, quiet hours, a time zone, global pause, Skip today, disconnect, and a test push. Suggested schedules are 08:00 Life Map, 20:30 Library and 21:00 Life Ledger in America/Winnipeg. Quiet hours are 21:30–07:30. Opening the page does not persist defaults or enroll a subscription.

Schedules belong to each enrolled browser/Home Screen installation. Other installations do not automatically share them. Existing dashboard records are not read, transferred or changed. Library and Ledger can explicitly link completion-aware reminders from their usual installed app contexts. Only app, current date, and activity-present boolean are synced through a scoped completion token. Library counts positive logged pages or a book marked completed today; Ledger counts a saved day with positive habit units. Corrections sync the current saved state. Reminders for other dashboards still use explicit Skip today. Offline saves must sync before a reminder is dispatched; an already dispatched occurrence cannot be recalled or re-issued after correction. Tapping a notification opens the original public dashboard URL. iOS may open that URL in a different browsing context from an existing Home Screen app; use the original app for its existing local records if necessary.

## Deploy

Use the Render connection and `reminders-service/render.yaml` as the deployment specification, with the repository root as build root. It requires one always-on paid Node 24 service and a persistent disk. Review the current quoted charge with the owner before provisioning; do not use a sleeping free service or an ephemeral database. Keep automatic deployment disabled until CI and review are complete.

1. Build: `npm ci --prefix reminders-service --ignore-scripts`.
2. Start: `npm start --prefix reminders-service`.
3. Mount a persistent disk at `/var/data`; set `REMINDER_DB=/var/data/reminders.sqlite`.
4. Generate `PAIRING_TOKEN` as a high-entropy private environment value (at least 32 characters). Do not print it in logs or commit it. The owner enters it once during pairing; the browser retains only a revocable device token.
5. Set `VAPID_SUBJECT` to a valid `mailto:` operator contact. The service generates VAPID keys once in its private disk database; preserve this database across deployments. Losing or rotating these keys requires re-enrollment.
6. Confirm HTTPS `/health` returns `{ok:true}`. Only `https://qchamby204.github.io` is permitted as a browser Origin. Do not relax that allowlist to `*`.
7. Open the public Reminders page on the iPhone, add it to the Home Screen, open that icon, enter the service address and pairing code, and tap Enable notifications. Permission is requested only from this gesture.
8. Send a test, confirm actual phone receipt with the app closed, then create a one-time reminder several minutes ahead and confirm background delivery. Check a skipped occurrence and pause before marking the system ready.

Do not declare push live based only on successful API responses or simulated browser tests. The push provider's acceptance is not a receipt from the phone. Focus, permission, connectivity and operating-system behavior affect display.

## Scheduler and records

The single process checks every 30 seconds. Real-minute matching handles DST; repeated local times share the same occurrence key, nonexistent spring-forward times are skipped. Catchup is bounded to ten minutes; reminders in quiet hours are skipped, never accumulated. Up to six scheduled notifications per device/day are attempted. Tests are explicitly requested and separately rate-limited.

SQLite persists the subscription, hashed device token, hashed completion-link token, minimal daily completion signals, preferences, revision, skip dates, and delivery claims. Claiming before network I/O prevents duplicate dispatch across restarts. Ambiguous or rejected sends are recorded but not automatically retried, favoring no duplicate nudges. A crash during a send can leave `sending` history; this does not prove delivery. Expired subscriptions are disabled. Delivery history is retained for 30 days, skips for seven days. Disconnect deletes the device and related records.

Back up the persistent disk privately. Never copy it into public source or artifacts. Keep exactly one service instance with the same disk. To revoke a lost phone, delete its row from `devices` through an authenticated host maintenance session; foreign-key cascades remove its schedules/history. Rotating PAIRING_TOKEN blocks new enrollment with the old code but does not revoke existing device tokens.

## Validation

`npm test --prefix reminders-service` checks schedule validation, DST, quiet hours, catchup, endpoint restrictions, authentication, revisions, repeated enrollment, restart deduplication, skips, expired subscriptions, daily caps, disconnect and real Web Push payload encryption. `atlas/tests/reminders.browser.mjs` checks the interface and uses a simulated delivery API; it does not establish physical iPhone delivery.

## Linking completion-aware reminders

In Reminders, Copy completion code after pairing push delivery. Paste this code once at the footer of the usual Library and Ledger installations; iOS contexts can have separate storage. The code cannot read or modify schedules or send tests. It can read the reminder time zone/date and update current-day Library/Ledger activity only. It is hashed on the server; dashboard and Reminders credentials remain separate and are excluded from record backups. Disconnecting the phone cascades revocation and deletes its completion signals. Copy reuses the valid code saved in Reminders; if that private copy is unavailable, generating a replacement revokes older activity links.

A successful saved-record event triggers sync, with online/visibility retries. No link means no activity network traffic. Malformed records or network failures must not report successful suppression. The bridge does not merge, migrate, or upload dashboard records. Completion signals expire after seven days, and suppression applies only on the matching date and device. Delivery history marks suppressed occurrences as `completed`.
