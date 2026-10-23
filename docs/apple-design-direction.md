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

### Baby Brain: a book opening and the original branches

Topics opens with a plum book-and-seedling scene and the original full-colour moon emblem. Browse topics scrolls to the existing filters and focuses the original search field. Topic cards keep their full titles, paths and stage metadata on separate rows. Map leads with a compact title and its original interactive branching diagram, topic chooser, progress, legend and zoom controls. The original notes progress moves into the map introduction; map fitting reserves space for the introduction and lower navigation. No extra entry screen is added to the map. Topic reading panels sit between the app header and page navigation so the title and close control stay reachable. Closed panels are hidden rather than peeking over the dock.

Browser evidence covers both views in both themes, narrow phones, landscape, doubled text, empty records and desktop. It checks the original SVG and search node identity, all topic records, unchanged saved bytes while reading, retained search queries and focus, map selection, and notes saving/reload. Existing recovery, restore, question and safe-resource tests remain in force. Reference content and record formats are unchanged. Physical iPhone and VoiceOver verification remain separate.

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

### Life Map: choose a planning date from task actions

Task actions include Choose date beside Today, Tomorrow and This week. Its focused sheet shows a month calendar, previous/next month controls, a selected day and the existing date field. Arrow keys move between days and across month/year boundaries; Enter selects. Back or closing the sheet leaves the saved task unchanged. Schedule task uses the existing verified planning transaction, failure/retry feedback and Undo. The task’s actual deadline, notes, status and other records remain unchanged. Public and connected builds share this implementation. Browser checks cover calendar clicks, weekday alignment, year navigation, short months, cancellation, empty-date validation, persistence/reload, failure/retry and Undo across both engines and narrow, landscape and enlarged-text layouts.

### Neural Map: illustrated resource opening

List & search opens with a violet connected-resource scene and the original full-colour brain emblem. Browse resources scrolls to the existing filters and focuses the original search. Map leads with a compact title and actual catalog counts while retaining the original interactive resource diagram, chooser, zoom controls and legend. Resource cards keep full titles, location notes, availability distinctions, original destinations and review disclosures. Detail panels clear the app header and page dock. Selecting List & search returns to the title image while preserving the query. Existing favourites and link-review preferences retain their formats and write only after an explicit change. Browser checks cover both themes, narrow phones, landscape, enlarged text, original map/search identity, filtering, map selection, Escape focus and preference save/reload.


### Supporting-card refinement · October 20, 2026

This pass extends the existing title-image direction through Life Ledger, Life Map, Forge and Communicator. The openings, original artwork and Ledger constellation remain intact. Changes are confined to each app's existing CSS and generated asset-version references; HTML structures, JavaScript behavior and saved-record formats are unchanged.

- Ledger: separate activity list cards; stronger value titles; distinct expanded activity records with visible progress tracks; responsive achievement tiles; clearer reward, history and editor spacing.
- Life Map: stronger task and routine titles; quieter supporting actions; separate Morning/Work/Home disclosures; more comfortable editor labels, fields and planning shortcuts. Native selects retain their picker with a theme-aware face.
- Forge: roomier exercise records, aligned prescriptions, rectangular set controls with distinct next/saved states, a contained set editor, and clearer regular-workout/history typography.
- Communicator: module headings provide context above distinct lesson cards; expanded lessons have comfortable reading measures and a separated practice action. Topic, ladder and saved-practice records use stronger titles, aligned metadata and quieter actions.

Validation: 794 existing unit tests passed after installing the pinned project dependencies. WebKit checks passed 18 Ledger section states, 24 Life Map opening states and task/editor journeys, 30 Forge opening states and goal/regular-workout editors, and 96 Communicator opening/reference states with draft/save/reload coverage. The existing enlarged-text matrix passed 132 core views at 200% text and increased contrast. Ledger's update/recovery browser checks also passed. The existing suite accessibility audit passed 258 WebKit views and 52,770 controls with no reported issues. Opening, scrolled and expanded screenshots were visually inspected in both themes. Final committed-tree generation consistency and GitHub checks are required before merge; public deployment is verified separately. Physical iPhone and VoiceOver sign-off remain outstanding.

### Ledger activity deck and touch follow-up · October 21, 2026

The main activity deck now gives every original full-colour habit image a full-width illustration panel beneath its title. Five solid value-coloured faces distinguish Health, Growth, Wealth, Discipline and Connection, with the entry action and save footer retaining their existing hierarchy. Artwork contracts slightly around reserved safe-area space so the initial activity clears the Home Screen navigation. List records have separate rounded surfaces, larger original imagery and a value accent. The Levels constellation and other dashboards are unchanged.

When a quantity or note is being edited, Ledger prevents the compatibility mousedown from moving focus to Done, Save day, steppers and deck actions before their native click. This avoids dismissing the keyboard ahead of the action. It does not activate on pointerdown, forward synthetic clicks or save from an interrupted press. Existing daily checks, amounts, separate Save day, verified persistence and XP rules remain intact. Hover movement is disabled on touch-only pointers.

WebKit touch gestures cover quantity Done, steppers, all daily checks, list toggles, Save day and reload in both themes and motion settings, with browser and simulated Home Screen insets. The focus-order assertion fails against the previous script and passes with this fix. Ordinary taps also worked in the earlier browser simulation; the exact reported physical-phone missed tap was not reproduced. Visual review includes the five card faces, both themes, list records and enlarged text. All 794 unit tests, 18 Ledger section states, Ledger update/recovery checks and the 132-view enlarged-text matrix pass locally. Physical iPhone keyboard timing and VoiceOver remain unverified.

### Complete first-screen openings · October 21, 2026

Forge Home is the alignment reference. At default text on portrait phones, the opening card begins 24px below the app header and ends about 24px above the floating navigation. This includes the card's action footer. Supporting records follow the complete opening. Larger text, expanded help and short landscape windows retain natural scrolling rather than clipping or scaling down text.

Ledger's date/activity selector and Cards/List control share the card rail. Today no longer has a separate large heading before the illustrated activity. Levels, Achievements and History keep their page headings in the rail, with the original constellation, milestones and saved-day artwork intact. Life Map's date stays in its rail, page actions move into its footer, and the supporting planning heading follows the opening. Forge's goal-detail navigation and summary follow its session opening. Communicator's lead card precedes its supporting controls. Existing DOM controls, records and save handlers remain in place.

The shared presentation code measures only header/navigation space, with synchronous layout before existing scroll restoration. It observes chrome rather than document height, so card layout does not feed back into its own measurements. Artwork uses the remaining body space with a readable minimum. The new Chromium/WebKit opening matrix captures default-text Home Screen layouts across all core pages at 393px and 430px. Existing enlarged-text, save/recovery, navigation and artwork checks remain required. Local browser binaries could not be downloaded; runner artifacts provide the rendered review. Physical iPhone and VoiceOver sign-off remain separate.

### Ledger cold-launch handoff

The October 21 iPhone recording shows the retired season overview painting before the current Today interface. The legacy renderer still prepares its DOM, but an inline startup gate keeps that intermediate screen out of sight until the current interface, its stylesheet and initial page resources are ready. The reveal also measures the current chrome before the first visible frame. A neutral loading state and reload recovery remain available for slow or failed assets. Ordinary launches open Today, explicit Levels links keep their destination, and resuming a live window keeps its selected section. Startup code does not read or write records. The Chromium/WebKit regression exercises delayed scripts/styles, reloads, direct Levels links and recoverable asset failures in both themes, sampling visible sections during launch rather than checking only the final page.

### Direct Ledger entry · October 22, 2026

Ordinary launches render the current Today interface directly. The retired renderer does not mount an initial overview; only the current interface may call it to build its controls. The activity stylesheet loads with the document; the existing early script request initializes Today directly. The separate loading screen, hidden-app gate, timeout and window-load reveal are removed. Actual failed assets retain an inline reload action. Explicit Levels links and live-window resume keep their destination; saved history and unfinished entries keep their existing ownership.

### Floating Liquid Glass controls · October 22, 2026

The supplied 7.3-second navigation recording is the reference for translucent floating controls and a moving rounded selection lens. Core navigation uses a more transparent, softly highlighted material with background blur, a stable reading tint in each theme and one selection lens. Existing tab controls retain their handlers, semantics and labels. The lens follows the current selection and, when Ledger rebuilds the bar, resumes from its visible position. No drag gesture, sound, record write or new navigation action is introduced. Header tools and modal surfaces use related materials; activity artwork, hero compositions, the constellation and supporting content faces remain intact. Expanded editors gain spacing and recorded/completed records gain restrained state edges. Existing Ledger save status gains a non-animated marker for draft, saving, saved and failed states. A connected appearance control is returned to the core header if it mounted before that header existed, retaining its existing listeners.

This is a web treatment using backdrop filters, tint, highlights and discrete tab transitions, rather than Apple's native refractive renderer. Reduce Transparency and Increase Contrast use solid surfaces; Reduce Motion removes lens movement. Unsupported backdrop filters retain a solid fallback. The glass browser check samples rendered navigation over black and white content, checks text contrast, interrupted tab selection, first-screen and scrolled views, and modal sheets in both themes. Existing opening, enlarged-text, save/recovery and startup checks remain required. Physical iPhone and VoiceOver verification remain separate.


### Life Map three-destination flow · October 23, 2026

The user's October 23 direction replaces the former Home / Plan / Areas / Board navigation with Home / Projects / Calendar. The existing illustrated Home card keeps its first-screen alignment and exposes Add task directly; Daily mandatory is the next section, with checkbox-style saved completion. Quick entry and its sheet show title, category and date together. Project and parsing options stay behind a disclosure.

Projects combines project cards, their expandable tasks and standalone tasks with an All category and six category filters. Calendar uses an indigo month face with quiet date targets, a selected-day accent and the active project names. Below it, saved project ranges have distinct timeline bars and an agenda. Next 12 months offers a compact two-column month selector on phones. Date edits use the existing verified project editor and do not move task deadlines. Legacy records, food coverage, Ops and the complete original record remain available through contextual tools. Floating navigation retains the existing Liquid Glass lens and theme/accessibility behavior.

Validation includes the full local Node suite, calendar boundary and adapter round-trips, and the repository's Chromium/WebKit checks for single-form capture, save failure/retry, filtering, project ranges, checklist completion/reopen, enlarged text, keyboard and Home Screen layout. See PR #170 for the exact remote check outcomes and rendered artifacts. Public Pages and the private hosted deployment remain separate release targets. Physical iPhone and VoiceOver verification are not inferred from browser simulation.
