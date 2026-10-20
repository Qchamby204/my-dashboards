# Atlas visual direction

The suite keeps its warm stone and night indigo palette, Figtree type, bronze actions and horizon identity. Apple’s guidance informs the hierarchy and behavior; this is a web implementation with its own identity, not a reproduction of native Liquid Glass.

## Published foundation · updated October 18, 2026

The earlier aesthetic attempts were published. PR [#103](https://github.com/Qchamby204/my-dashboards/pull/103) merged at `f6a43b79ff9dbc60ce4604645dbb325e13f16940`; PR [#105](https://github.com/Qchamby204/my-dashboards/pull/105) merged at `008d93e8a33ba503739c56b8a87817d39da433b4`. Their `shared/core-app-finish.css` and script remain in main. Navigation and header refinements through [#115](https://github.com/Qchamby204/my-dashboards/pull/115), individual craft passes through [#121](https://github.com/Qchamby204/my-dashboards/pull/121), and Ledger refinements through [#126](https://github.com/Qchamby204/my-dashboards/pull/126) are merged. Physical iPhone sign-off remains outstanding.

The October 15 review found excessive outlined pills, weak differentiation of text from controls, inconsistent native form surfaces, a neon edge on Ledger’s activity card, redundant level metadata in its header, and XP explanation competing with the check-in. The later app-specific passes address those findings. Improvements to shared colors and passing interaction tests alone do not establish aesthetic completion; inspect the rendered app and its actual device behavior.

A separate cache-versioning defect was confirmed: the dynamically loaded Ledger, Forge, Communicator, Hourglass and Baby Brain stylesheets retained older version values after CSS edits; the mobile stylesheet had no version. The files on the server matched the released source, but an existing browser cache could continue displaying an earlier appearance. The build now versions nested CSS dependencies before hashing their script and theme loaders. This is a possible explanation for changes appearing absent on an existing installation, not proof of what any particular device cached.

## Visual contract

| Element | Direction | Review evidence |
| --- | --- | --- |
| Main task | Put the current record or next useful action first. Supporting progress follows it. | The first phone screen makes its main action obvious, without chrome covering it. |
| Typography | Figtree; 32px screen title, 21–24px record title, 16px body, 13–14px metadata at the default size. Tight heading tracking, relaxed body leading, proportional scaling with larger text. | Populated, narrow, landscape and larger-text views retain clear reading order. |
| Content surfaces | Solid, calm cards with a subtle separator against the canvas. Use spacing and alignment before borders. Avoid gradients, glows and raised or inset shadows on ordinary records. | Records remain distinct in both themes, including scrolled and expanded details. |
| Floating controls | Restrained glass for navigation. Ledger’s Save day belongs inside its check-in card. Readable labels, defined edges, controlled shadow. Solid material for reduced transparency or increased contrast. | Busy content does not remain readable through labels; hidden controls cannot intercept taps. |
| Actions | Bronze for the main commitment, tonal styling for an action within a record, plain styling for secondary links. One or two prominent actions per view. Pills are compact actions, not a treatment for all text. | Controls have visible press, selection and focus states; saved and failed states include words. |
| Choices | A segmented control is one quiet group with a distinct selected segment. Normalize native fields in each theme. Keep controls at least 44 CSS pixels in each operable dimension. | Touch targets, keyboard navigation and selected state remain clear at increased contrast. |
| Headers | Home, identity, related tools and Appearance in a stable arrangement. Avoid repeating progress metadata in the header and body. Icons share a consistent line weight and optical size. | Status-area clearance, no clipped titles and no tool wrapping at supported widths. |
| Information | Keep necessary labels and feedback visible. Put longer explanations behind named, keyboard-operable information disclosures. | Expanded help does not overlap controls or conceal the active record. |

These are product choices derived from Apple’s principles, not measurements mandated by Apple. Native Dynamic Type, VoiceOver, actual touch physics and Home Screen behavior require physical-device verification.

## Current reference: Life Ledger

The header keeps identity and tools in one row. Original full-colour habit imagery stays in activity records; navigation and utility controls retain their line icons. Records use solid surfaces without glows or raised/inset shadows.

The October 19 phone screenshot still showed the former Levels DOM, including the removed summary row and combined chart panel. An already-open cloud browser tab reproduced that older DOM at the same public address where a refreshed tab displayed all three new opening cards. This establishes that an open document can remain stale; it does not identify the exact lifecycle or address of the user's Home Screen installation. Ledger now checks its versioned enhancement release on launch and resume (at most once per minute), with a cache-bypassing same-origin HTML request. An available update offers a compact Refresh Ledger action; History's management tools also have Check for updates. Refresh waits for verified draft persistence and refuses to navigate over open editors, invalid fields, failed writes or conflicts. It returns to the current section and never clears records. Already-running older code needs one fresh document load to receive this behavior. Physical iPhone confirmation remains outstanding.

| Section | Current arrangement |
| --- | --- |
| Today | Check-in cards or the list alternative only, with a compact Cards/List and entry-count toolbar. One frame groups the activity selector, title-led record, original artwork, entry control, Previous/Next and inline Save day. No progress, reward or reminder panels follow it. |
| Levels | The original five-colour constellation is the opening title illustration, inside an indigo card titled Levels by value. Its five labelled value shortcuts sit in the separate action footer. Lifetime XP and rewards follow below that opening, then individual value details and personal rewards. The constellation is a defining part of Ledger and must not be replaced by a generic emblem or hidden in a disclosure. |
| Achievements | The chosen projected milestone leads in the same illustrated indigo card, with the collection count in its rail, saved progress and a separate action footer. The 60 illustrated badges, earned/locked states, filters and award details follow. State/category filters share a row where space permits. |
| History | An illustrated saved-record card leads with the number of dated saved days, latest date, unfinished check-ins and actions to browse the record or open backup tools. Saved entries follow, then check-in tools, management and archives. Reminders preserve their unfinished completion code through redraws. |

Save feedback uses Ready to save, Saved and explicit failure/retry states. Today has one bottom navigation clearance, with extra scrolling room only while the keyboard is visible. Today’s activity face uses a solid deep indigo surface with cream text, brighter value accents and a framed full-colour activity illustration. The activity title has a larger, tighter typographic hierarchy. A separated theme-aware footer groups navigation, save status and Save day. Quantity fields, help and recorded states share the face’s readable colours. Entered-state borders and brief press feedback preserve a clear focal card. Reduced motion disables scale feedback.

Milestone projections use dated saved activity from the last 28 days, at least three active dates and a minimum seven-day observation window. Drafts, future entries and weekly catch-up do not invent pace. Sparse history shows the remaining amount without a fabricated date. Choosing from the selector or badge detail saves the preference through Ledger’s verified draft/settings storage, includes it in backups and retains it across reloads. An earned or unavailable selection falls back to an eligible upcoming milestone. Choosing a milestone does not save a day or change XP. Failed preference writes retain the selection in the current tab and use the existing retry/recovery notice. Explicit progress reset archives the preference with the previous record.

Ledger component styling belongs in `shared/ledger-enhancements.css`; the retired competing Ledger decorations have been removed from `shared/core-app-finish.css`. Do not add a second aesthetic override layer. Data adapters, record formats, rewards and save behavior are outside this visual change.

The app-specific passes below have shipped. See [the suite verification record](suite-release-2026-10-15.md) for their evidence and the outstanding real-iPhone checks. Browser evidence does not complete physical touch, VoiceOver or installed-app sign-off.

## Primary guidance

- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials): reserve Liquid Glass for the functional layer and use it sparingly.
- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout): order content by importance, align related elements and group related functions.
- [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography): preserve legibility and hierarchy as text scales.
- [Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons): distinguish preferred actions by style, limit prominence and provide comfortable targets and press feedback.

### Life Map: next action before capture

Home presents its existing chosen task before the original capture controls, preserving their draft and handlers. Planning, area records, day blocks and project tools remain in their existing sections. Content uses solid surfaces with no raised shadows; only navigation uses glass. Area selection uses an underline and weight, and supporting controls use quiet tonal surfaces. Native date fields follow the selected theme.

The October 19 craft pass extends the opening hierarchy to Home, Plan, all six Areas, Board and All records. A solid blue/ink face, cream title, full-width title illustration and separate action footer give each view a focal record. Home uses a route scene, Plan an agenda, Board a set of record columns, and each of the six Areas has its own household, food, family, health, work or admin illustration. The active area opening precedes its category selector, followed by the original tasks and routines. The artwork is decorative and never represents invented progress. Counts come from the existing selected-day tasks and routines; they never create a plan or award completion. Home presents the Board action once. Date navigation remains between the opening card and agenda; capture stays after the scheduled tasks. The full record still contains the original overview, Focus, Horizon, area map, Projects, Chores and Momentum.

Task and routine records have separate surfaces and action rows. Project progress retains its saved fraction; the decorative layer that obscured its fill is removed. Editors use legible headings, rectangular fields, stacked phone columns and native date sizing that fits doubled text. The existing Save controls and error/retry feedback sit in a fixed sheet footer while the form scrolls, including when the keyboard reduces the viewport. Utility actions use inline line icons rather than missing font glyphs. Public `lifemap_v1` and the private connected adapter remain separate; viewing does not seed, move or rewrite task records. The shared private bundle is prepared by the build; that is not a claim that its hosted Site has been deployed.

Browser evidence covers 24 main opening states, each of the six categories, All records, task/project/chore editors, long titles, both themes, 320/393px phones, landscape and 200% text. The task journey captures, schedules, completes and reopens a saved record. Existing Life Map journeys retain save failure recovery, calendar handoff and draft behavior. Physical iPhone and VoiceOver verification remain separate.

### Forge: session and next set

Forge home and each of the four goal pages lead with an indigo title card and a separate action footer. Full-width equipment illustrations identify the training focus: a barbell and timer on unchosen Home, a bench rack, a floor barbell, a running scene or a basketball hoop. Chosen Home retains the chosen goal’s illustration. These are decorative title images, not charts of saved training or controls. Goal pages retain a compact title and target context above the current session. Home preserves the four first-goal choices and the selected-plan continuation. Regular workout records have clear titles and metadata, and the active exercise and its actions precede the supporting last-session record. Saved-session rows remain distinct; the decorative layer that hid regular progress fills is removed. Native set fields use 14px corners and large set numbers, with saved/unfinished states and existing handlers preserved. The repeated weekly count is removed from the header and remains in the season panel.

Goal and exercise records use solid surfaces without lifted shadows. The existing current-session action leads the editor. The next or unfinished set has an explicit Next/Editing label and step semantics; saved sets retain their distinct completion state. Week and day controls remain full-size and quieter, and rest stays with the exercise. No workout records or adapters change.

### Communicator: one practice, quieter alternatives

Today, Learn, Practice, Topics, Progress and the monthly reflection use purple/indigo title cards with separate action footers. Each has its own full-width illustration: conversation bubbles, an open book, a microphone, topic cards, steps toward a flag, or a review sheet. Investing uses a financial-statement scene. These are decorative identities; real XP, scores and completion remain in their saved-data controls. Active drills retain a compact illustration so the real timer and controls remain prominent. Learn’s title image precedes subject controls; saved receipts keep the score and its denominator aligned. The investing reference views and active/saved practice use the same framing. Existing DOM controls and labels move in place; timer, transcript, rubric, source context and verified saves keep their existing handlers. Progress leads with the saved rank or fresh receipt, with comparisons and investing detail below. Native editors use rectangular fields, lesson/topic/history records have distinct surfaces, and the progress fills previously obscured by a decorative layer are visible. Header XP remains in Progress. External grading copy describes optional feedback without presenting it as an objective measure of skill.

Today retains one next challenge or unfinished practice. Topic management stays in Topics, practice alternatives and focus remain named disclosures, and learning and progress stay in their existing sections. Challenge, learning and receipt records use solid surfaces; alternatives read as disclosure rows rather than raised panels. Expanded ladder stages retain aligned identities, readiness text and keyboard actions. Timer, transcript, rubric, XP and save behavior are unchanged.

### Chef: a distinct opening before the recipe records

Ingredients, Mood, Planner, Groceries, Planned recipes and Favourites each lead with a sage/ink title card and a distinct kitchen illustration. Mood keeps the existing full-colour meal artwork. Recipe cards, tonight’s dinner, portions, preparation dates, ratings and grocery checks retain their original record layouts and behavior. Planner and Groceries move the original Add a meal and Copy for Muse buttons into the opening footer; the same nodes return to their original containers before each redraw. Browsing never changes the saved record. The remaining actions move to the existing choices below the title image. Narrow native filter fields keep full labels in the option picker while ellipsizing the selected value; expanded recipe ratings wrap without shrinking their touch targets.

### Library: reading, collection and understanding

Topics, All books and My understanding lead with ink-blue title cards: a bookshelf, an open volume and a notebook. Every topic workspace combines the open-book or synthesis scene with its original gold and full-colour subject symbol. The fourteen original sculpted topic badges remain in the topic grid, and book jackets remain in Continue reading, Up next and the Finished collection. The existing Add book and Make this my focus actions sit in the opening footer; learning scope, guidance, reading goals, notes and synthesis editors follow. First-use aims appear below the title image. Opening pages never rewrite saved reading records, goals or notes.

### Hourglass: a distinct opening for each perspective

Weeks, Reckoning, The Climb and Setup lead with plum/ink title cards, cream headings and a separate action footer. Calendar, hourglass, mountain path and date-book scenes distinguish the views. Their opening actions scroll to the existing calendar, perspective, projection inputs or date fields without saving a record. The original gold hourglass emblem remains in the supporting time overview; its real statistics and year-progress fill remain below the opening. Decorative layers covering the existing year, life and target progress fills are removed. The original full week grid, wallpaper, live countdown, financial assumptions, milestones and bonds keep their existing handlers, calculations and record formats. Floating page names stay whole when content text is enlarged.

### Aqueduct: a distinct opening for all six work areas

Book, Paycheque, Plan, Goals, Wealth and Review lead with teal/ink title cards, cream headings and full-width book, paycheque, calendar, target, mountain and statement illustrations. Separate footer actions scroll immediately to the existing content, clear of the sticky header, without saving or changing financial assumptions. The original household ledger, income cascade, allocation charts, goals, accounts, projections and statement review remain intact below. Backup and restore tools follow the content; unsaved or blocked-record notices retain their prominent recovery position. Identity, Undo and Appearance share a stable header row at enlarged text. Primary dock labels and More remain whole; Wealth and Review remain available through the existing More menu.

Browser checks cover six views across both themes, narrow phones, landscape, doubled text and empty records, plus byte-for-byte record preservation, unchanged income calculations, household save/reload and statement review. Physical iPhone and VoiceOver checks remain separate.

### Herald: story, calendar, rhythm and results

Script Vault, Calendar, Cadence and Metrics each lead with plum/ink title cards and a full-width slate, calendar, rhythm or chart scene. Script Vault keeps the original full-colour gold trumpet emblem. The opening action scrolls immediately to the existing editor or records, clear of the sticky header; it never saves or changes content. The original Assembly rail and season summary follow the active page content, retaining their filters and navigation. The duplicate brand panel yields to the page title. Saved scripts, packaging, scheduling, weekly logs, metrics, sync and backup controls retain their original handlers and record formats. Script-readiness fills are visible again, and enlarged-text header and Metrics labels remain contained.

Browser checks cover all four views in both themes, 320/393px phones, landscape, doubled text and empty records, plus unchanged saved bytes, script creation/reload, retained edits, scheduling and App tools. Physical iPhone and VoiceOver verification remain separate.

### Operations Cadence: a distinct opening for every rhythm

Today, Daily, Weekly, Monthly, Quarterly, Annually, Ad-Hoc, Captured tasks and Insights each lead with a green/ink title card and a full-width clock, clipboard, week agenda, month calendar, quarter folders, annual planner, toolbox, inbox or results scene. Today keeps the original full-colour Operations emblem. Separate footer actions scroll to the existing controls without saving a record. The original scheduled-items summary and explanation follow the workspace. All routine tasks, period resets, notes, completion history, scheduling, capture and backup controls remain in place. Selecting a page returns to its title image; redraws within the same page retain the opening node and the original capture field. Completion summaries and clear actions wrap at enlarged text.

Browser evidence covers nine views across both themes, narrow phones, landscape, doubled text and empty records. It checks unchanged saved bytes and original task counts, capture-node identity, capture/reload, notes, completion and schedule editing. Physical iPhone and VoiceOver checks remain separate.

### Courier: the selected edition before the listening controls

Courier leads with an ink-blue title card, the actual selected edition date, a headphone-and-paper scene and the original paper-plane emblem. Text-only editions keep the paper scene and use a reading title. The original Play all / Continue all node moves into the separate action footer; Browse edition scrolls immediately to the section records. Edition selection, speed, the short queue, saved-position resume, the runtime rail, transcripts, sources, practice and the original audio player follow. No new control starts playback automatically. Missing editions keep an opening with the existing unavailable status below. The decorative layer covering the real heard-section progress fill is removed, and the summary reflows at enlarged text. A late canplay event on finished audio now processes completion before attempting playback, preventing a WebKit event-order race from restarting the same section. A focused regression test reproduces the former failure.

Chromium and WebKit checks cover audio, text-only and unavailable editions in both themes, narrow phones, landscape, doubled text and empty listening history. They verify unchanged history while browsing, original Play all and audio node identity, real audio pause/resume and automatic continuation, saved positions, edition switching and transcript reading. Published episodes, manifests, sources and paused generation remain unchanged. Physical iPhone audio, background playback and VoiceOver verification remain separate.

### Remaining suite: shared chrome and content audit

The visual audit covers Operations Cadence, Hourglass, Aqueduct, Herald, Chef, Library, Courier, Baby Brain and Neural Map in light/dark populated and expanded states. Their individual record formats remain intact; ordinary content surfaces lose raised shadows while functional floating controls keep separation. Herald’s backup and sync controls move into its named App tools disclosure. Courier receives the same home/identity/appearance arrangement, with existing edition and playback controls below it; no publication or episode data changes. Atlas remains a passive hub. Physical iPhone verification is still outstanding.

## Ledger section completion · October 19, 2026

The opening-card treatment now extends beyond Today to Levels, Achievements and
History. Every section has a large title, framed illustration, indigo face with
cream text, and a theme-aware action footer. Supporting value cards, rewards,
badge filters, saved days and tool disclosures use consistent spacing, rounded
surfaces and control styles. Native disclosure glyphs in the affected controls
are drawn in CSS so the controls do not depend on a fallback font glyph.

Existing calculations, saved days, draft handling, reward rules and milestone
preferences are retained. New browser evidence covers empty/populated records,
320/393px phones, landscape, both themes, 200% text, long chosen milestone names,
expanded help and the opening actions. This remains browser evidence rather than
physical iPhone or VoiceOver sign-off.
