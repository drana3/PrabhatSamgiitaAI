# Audio stack: expo-av removal and react-native-track-player status

Status: plan only. No code is changed by this document.

## Why

- `expo-av` is deprecated. It was removed from the Expo Go bundle in SDK 54 and is dropped in SDK 55. The
  Expo replacements are `expo-audio` (sound) and `expo-video` (video). Staying on SDK 54 keeps it working;
  the next SDK upgrade is blocked until it is gone.
- `react-native-track-player` is pinned at `5.0.0-alpha0` (the line that supports the new architecture).
  It is an alpha: no stable 5.x release, API and native behaviour may still change, and it is the only audio
  engine that drives lock-screen controls, the media notification and background playback.

## Where expo-av is used (6 files)

| File | Use |
| --- | --- |
| `lib/playback/expoCatalogPlayer.ts` | catalog player: `Audio.Sound.createAsync`, `setAudioModeAsync`, status callback |
| `lib/playback/catalogAudioEngine.ts` | shared sound instance, preload, `retireSoundInstance` |
| `stores/playerStore.ts` | `Audio` types and mode |
| `lib/harmoniumPlayback.ts` | many short sounds (pool, drone, held notes), volume and rate |
| `components/songs/NotationMatraSheet.tsx` | notation playback |
| `components/admin/CaptureListenPlayer.tsx` | admin listen player |

`rntpCatalogPlayer.ts` + `trackPlayerBridge.ts` + `playbackService.ts` (registered in `index.js`) already run the
song player on RNTP. So the work is about the harmonium, notation and admin sounds, plus whatever
`expoCatalogPlayer` still serves as fallback.

## Plan

1. Decide the fallback. If `rntpCatalogPlayer` is the only catalog engine in production, delete
   `expoCatalogPlayer.ts` and `catalogAudioEngine.ts` (and their tests) instead of porting them.
2. Add `expo-audio`. Port in this order, one commit each, tests green between steps:
   1. `CaptureListenPlayer` (admin only, lowest risk) to `useAudioPlayer`/`createAudioPlayer`.
   2. `NotationMatraSheet` (single sound).
   3. `harmoniumPlayback` (pools, drone loop, per-sound volume and playback rate). Needs a device check for
      latency and overlap; `expo-audio` players are cheap to create but verify 8+ simultaneous notes.
3. Audio mode: `Audio.setAudioModeAsync({ playsInSilentModeIOS, staysActiveInBackground, interruptionMode... })`
   becomes `setAudioModeAsync({ playsInSilentMode, shouldPlayInBackground, interruptionMode })` from `expo-audio`.
   Keep `UIBackgroundModes: ["audio"]` in `app.json`.
4. Remove `expo-av` from `package.json`, the `expo-av` entry in `app.json` plugins, and
   `constants/featureParity.ts` references. Re-run `npx expo-doctor`.
5. Tests: the many `__tests__/*Playback*`/`playerStore` suites mock `expo-av`; replace the mock with an
   `expo-audio` fake in one shared setup file (`__tests__/setup/`, next to `fakeTrackPlayer.ts`).

Effort: about 2 to 3 days including device checks (iOS and Android), mostly harmonium.

## RNTP alpha: what to do

- Pin stays exact (`5.0.0-alpha0`, no caret) so builds are reproducible.
- Smoke-test lock screen controls, headset buttons, interruptions (call, other app) and a 30 minute background
  session on a real iOS and Android build before every store release. Unit tests use `fakeTrackPlayer`; they
  do not prove native behaviour.
- Watch the project's releases for a stable 5.x; switch the pin when it appears and read its changelog.
- `registerPlaybackService` must run at app start in the JS entry. It is registered in `index.js` (and the
  bridge registers it again defensively); keep exactly one effective registration if either file is edited.
- Fallback if the alpha breaks on a new OS release: `expo-audio` has lock screen controls
  (`setActiveForLockScreen`), but queue and notification features are thinner. That is the reason to finish
  this migration before the alpha forces a rush.
