# Scoped asset loading — October 18, 2026

## Hourglass cache invalidation

A temporary-copy experiment changed only `hourglass-enhancements.css` and ran
the actual asset-version build. Previously, its nested script hash changed the
shared theme loader, which invalidated **19 HTML files**, including Life Ledger,
Life Map, Chef and unrelated apps.

Hourglass now declares its own deferred enhancement script. The shared appearance
loader no longer owns that app-specific dependency. The normal build still
versions its nested stylesheet and script, preserving cache freshness.

Repeating the same experiment now changes only **one HTML entry**,
`the-hourglass.html`, plus the Hourglass enhancement script's CSS version. Both
shared theme loaders and all unrelated HTML remain unchanged. Separate regression
tests exercise CSS-only and script-only changes through the real build.

The initial move changes the shared theme hash once, so this release refreshes
the existing theme references on the other pages. Their content and styles are
unchanged. Future Hourglass changes no longer create that shared invalidation.
Hourglass's existing behavior, CSS, storage and backup formats are preserved.
Its browser recovery journey also verifies that exactly one enhancement script
is present.

## Development dependency discovery

Vite's default HTML discovery scanned archived pages, including the source-only
Life Map legacy document. Its relative asset paths produced dependency-resolution
warnings even though the preview serves the Atlas client through its existing
development bridge.

`optimizeDeps.entries` now identifies `atlas/app.js` as that client entry. A fresh
cache test starts the actual configured server, waits for dependency discovery,
checks that no discovery errors are logged, serves the preview, and transforms
the real JavaScript and CSS. No production routes or deployment settings change.

## Evidence and limits

The local build, all 760 Node tests, and the generated consistency gate pass.
All existing CSS files are byte-identical; unrelated HTML differs only in its
shared theme version. Browser recovery, populated layout and navigation checks
run in the release PR. Rendered Hourglass views should be compared before merge.
This measures invalidation scope and development discovery, not runtime speed.
Physical iPhone checks remain outstanding.
