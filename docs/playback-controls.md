# Playback controls: sleep timer, speed and pitch, continue where you stopped

All three are in the player (`app/player-v2.tsx`), as sheets from the "..." menu (`components/player-v2/PlaybackSheet.tsx`). The Radio view shows the same menu.

## Sleep timer

Choices: 5, 10, 15, 30, 45, 60 minutes, end of this track, end of the playlist (not shown in the Radio, which has no end).

- Pure logic: `lib/playerV2/sleepTimer.ts` (kinds `off`, `minutes`, `endOfSong`, `endOfList`). Runtime and the native hand-off: `lib/playerV2/sleepRuntime.ts`; a 1 s tick (`tickSleep`) in `lib/playerV2/services.ts`.
- The sound fades out gently before the stop (the timer's own fade, separate from the track-join fade). A chip "Sleep 14:59 x" shows the countdown under the seek bar (also in the Radio view); a tap cancels it.
- "End of track" and "end of playlist" hold the native queue (`held`) so the next track does not start, and release it when the timer is cancelled or changed to minutes.
- Works with the screen closed because the countdown runs in the playback service, not in a screen.

Verified: logic and runtime in `__tests__/playerV2Timers.test.ts` and `sleepRuntime.test.ts`; the sheet and the chip in a 390 px headless screenshot. **Not verified on a phone** with the screen locked, and not on Android battery saver.

## Speed and pitch

- Speed 0.5x to 2.0x, step 0.05 (the - and + buttons) and quick choices 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 (`lib/playerV2/playbackSpeed.ts`). The rate is clamped in `stores/playerStore.ts` and `lib/playback/rntpCatalogPlayer.ts`.
- Saved **per recording** ("Remember for this recording") or as the **default for all recordings** (`stores/playbackPrefsStore.ts`: `rateByTrack`, `defaultRate`; the per-recording list is capped and sanitized by `sanitizeTrackRates`).
- **Keep the pitch** is on by default. On iPhone the track gets a `pitchAlgorithm` (`lib/playback/pitchAlgorithm.ts`): time-stretch (voice or music) when pitch is kept, linear (the pitch follows the speed) when it is off. It applies from the next track. On Android the player always keeps the pitch; the switch has no effect there.
- **Semitone steps are not possible** with this player (it has no pitch shift, only the rate). That needs another audio engine (for example react-native-audio-api, see `docs/smooth-transitions.md`).
- Leveling is not touched: the rate changes speed only; the gain is computed from the loudness numbers.

Not verified by ear: the quality of the time-stretch at 0.5x and 2x on a phone.

## Continue where you stopped

For long **local** recordings (uploaded recordings, discourses): when you open a recording longer than 10 minutes that you left more than 10 seconds in and not at the end, a small "Continue from 12:30" offer appears under the seek bar (`components/player-v2/ContinueOffer.tsx`). It is only an offer; the player never jumps by itself.

- Positions are stored by `stores/resumeStore.ts` (per account); the recorder is `createLongResumeRecorder` in `lib/playerV2/services.ts`; the rules are in `lib/playerV2/longResume.ts`.
- Prabhat Samgiita songs keep their old behavior: automatic resume with "Start over" (`ResumeNotice`).
