# Original Communication Trainer reliability

These changes extend `communication-trainer.html` through the existing appearance loader. The original dashboard, curriculum, topics, scoring model and `mc_*` record keys are retained. There is no replacement trainer inside Atlas.

## Practice controls

The timer uses an absolute deadline while running and retains milliseconds when paused. A delayed interval updates from elapsed time rather than subtracting one second per callback. Start, Pause, Resume and Time's up remain consistent after a screen render. Expiry stops dictation and leaves the transcript for review; it does not log a rep automatically.

Leaving the page, hiding the app or navigating away from Train pauses the timer and stops dictation. Returning requires an explicit resume. Opening prep within the same rep preserves the scroll position. Restart rep accurately describes the existing reset action: it resets the clock and clears the transcript. Its Undo is limited to the same rep and cannot overwrite newer work.

## Dictation

The original feature uses the browser's speech recognition service, not an audio recorder. Controls now say Start/Stop dictation. No audio file is saved by this dashboard. Speech-service processing and support depend on the browser; typed transcripts and keyboard dictation remain available.

Recognition callbacks are scoped to the active engine and rep. Stopping invalidates those callbacks, retains the displayed transcript including interim text, and aborts that engine. Old results, errors and restart callbacks cannot affect the next rep. Recognition errors stop automatic retries and show a manual recovery action. The timer starts when recognition reports that listening has started, rather than while microphone permission is pending.

The distinction between [SpeechRecognition stop and abort](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) matters: stop may return a later result, while abort ends recognition without attempting a new result. The [start event](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start_event) is used to mark active listening.

## Progress and recovery

Exports include grades and pending feedback, which the original export omitted. Export reads current in-memory progress so it also captures edits whose storage write failed. Those failures show Retry saving and Export progress. A successful retry writes the existing record keys without changing their schemas.

Imports validate recognized field and record shapes before writing, then request confirmation in the existing in-page dialog. An older backup updates the categories it contains and retains omitted categories such as grades. The plain JSON export format stays compatible with the original progress importer.

Active, unlogged transcripts remain in memory for the current page session, as before. Progress export covers logged records and preparation notes; it is not a recording archive or automatic backup of an unfinished rep.

## Verification

Synthetic tests execute the original script plus the enhancement. They cover delayed timer callbacks, pause/resume precision, navigation and visibility, microphone denial, stale recognition events, countdown expiry, reset Undo, complete exports, rejected imports, older backups and failed clipboard operations. No microphone, speech service or external grading provider is called by these tests. Physical iPhone testing remains outstanding for actual speech recognition, safe-area presentation and installed home-screen behavior.
