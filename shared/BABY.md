# Original Baby Brain

This pass extends `baby-brain.html` through the shared theme loader. It preserves the original URL, reference tree, supplied reading content, voice engines, and device-local `babybrain.v1` records. Atlas remains a reference hub. No medical content, clinical recommendation, API credentials, or external integration is changed.

## Find and read

Phones open Topics, an alphabetical list with full-text search, area, stage, and notes/link filters. Desktop opens the original Map. Both views remain available, and switching views retains filters. Stage filtering includes topics marked as relevant to every stage. This is a reference filter, not a personalized developmental assessment.

Search requires every entered word to match the topic's title, path, summary, questions, reference body, or saved notes. A leaf no longer receives a match merely for being a leaf. Map search displays at most 60 results with a visible count and narrowing instruction. The topic list contains all matching leaf topics. Search cards use native buttons and plain text.

Topic pages retain their original reading and notes surface with Read, Notes, and Resources shortcuts. Closing returns keyboard focus to the matching topic or the search field when that topic is filtered out. Map nodes, question checkboxes, and status controls have keyboard semantics. The map counter reports topics with personal notes or links; seeded reference material does not inflate that count.

## Notes and recovery

Each note input updates the existing record and attempts a synchronous write with readback verification. No delayed note timer remains in this extension. A failed write keeps the latest notes in memory and shows Retry saving and Back up notes. Backups contain that current state, including compatible older topic records. Download feedback says a file was prepared; it does not claim the browser completed a disk save. Notes remain local to this browser and device.

The theme loader captures the original saved bytes before the legacy boot. Malformed or unreadable state pauses editing and saving, leaves a browseable reference, and offers a download of the original bytes when available. Recovery requires an explicit confirmed restore. A blocked-storage read cannot recover bytes that the browser never provided.

Restore accepts the existing `{v:1,saved,data}` format or a plain notes object, with a 5 MB file limit, structural validation, rejected prototype-related keys, and at least one recognized topic. It previews differing existing topic records and offers Keep existing notes or Use backup for matching topics. Both preserve other topics. Replacement of an unreadable record is separately labeled. Later file selections supersede slower earlier reads. A restore that cannot persist explicitly remains in the current tab with the same recovery notice.

User-added resource URLs are limited to HTTP(S), with credential-bearing URLs and duplicates rejected. Existing unsafe links lose navigation without erasing their saved bytes. Remove is a separate button rather than a clickable element nested inside a link. Reference links and notes are not sent to a new service.

## Mobile and verification

Scoped styling uses the shared light/dark tokens, measured header and toolbar clearance, safe-area and keyboard viewport variables, 44 px controls, 16 px reading/input text, and a wrapping audio transport. Map framing accounts for the added toolbar. Reduced-motion users receive immediate viewport changes and hidden pulse marks.

Synthetic tests run the original engine and extension with a small generic reference tree. They cover true/nonmatching search, full-text and notes search, filters, view persistence, note saving and quota failure, latest-state backup, keyboard question activation, focus return, literal note text, URL validation, conflict choices, malformed backups, corrupt-state recovery, unknown compatible topic retention, and out-of-order file reads. No real notes, cloud voice calls, or live user data are accessed.

Physical iPhone layout, home-screen mode, Dynamic Island clearance, keyboard behavior, download dialogs, and voice playback remain device verification items. This pass does not claim new background playback reliability or a content-source audit.
