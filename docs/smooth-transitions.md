# Smooth transitions between songs

What the app does at the join of two tracks, what the big apps do, and why a true overlap is not built.

## 1. What is built

An **equal-power fade-out at the end of a track and a fade-in at the start of the next one** (not an overlap: the two tracks never sound together).

- The setting is 0 to 6 s in steps of 0.5 s, on its own screen (`/transitions`, profile menu, next to "Volume leveling"). Two values: **in the Radio** (default 2 s) and **in playlists and queues** (default Off). Stored in `stores/playbackPrefsStore.ts` (`transitionRadioSeconds`, `transitionListSeconds`).
- The fade is a volume multiplier. Effective volume = user volume x leveling gain (`docs/loudness-leveling.md`) x fade. So the fade and leveling do not fight each other.
- `lib/playback/transitionFade.ts` drives it from the playback position (the player reports progress about once a second, so the position is extrapolated with a 100 ms tick). The gains come from `equalPowerGains` in `lib/loudness/crossfade.ts` (cosine and sine, constant power, no 3 dB dip in the middle).
- The fade never takes more than 20 % of a short track (`MAX_FADE_SHARE`).
- Which value applies is decided by `transitionSecondsFor` in `lib/playerV2/playbackPrefs.ts`: the Radio is running when `playbackMode === "random"` and drive auto-advance is on.

Verified: the logic in unit tests (`__tests__/transitionFade.test.ts`, `playbackPrefs.test.ts`). **Not verified: how it sounds on a phone** (the browser preview has no sound).

## 2. Do professional apps do it? (sources)

- **Spotify** has crossfade, a Premium feature. The help page says it "overlaps 2 tracks by fading out of the first while fading in the next", with a slider in Settings > Playback. Gapless is a separate switch, Automix is separate. The official pages do not state the slider range or the default; third parties say 12 s maximum, so do not quote that as official. It cannot be set while playing through Spotify Connect.
  - https://support.spotify.com/us/article/tracks-transitions/
  - https://support.spotify.com/us/article/Crossfade-feature/
- **Apple Music** has crossfade for everyone, 1 to 12 s ("Crossfade Duration from one to 12 seconds"); the default is not stated. AutoMix (beat-matched) needs a subscription. Not available with hi-res lossless.
  - https://support.apple.com/en-gb/105067
  - https://support.apple.com/guide/music/muse5e9ec085/mac
- **YouTube Music**: no official page found, so not verified.

So yes, the big apps overlap two tracks. We do a fade-out then a fade-in; to the listener it is close to a radio station's "dip", not a blend.

## 3. True overlap: evaluation (not implemented)

The player library (`react-native-track-player`, RNTP) has one active track, one volume and one rate. It cannot play two tracks at once. A real overlap needs one of:

1. **A second player** next to RNTP: two native players, the lock screen and the media session showing one of them. Risks: the OS shows the wrong track or flickers at the join; two audio sessions competing for focus; Bluetooth and car units see two sources; double memory and battery; on Android the foreground service must own both.
2. **react-native-audio-api** (Software Mansion, a Web Audio graph): two `AudioBufferSourceNode`s with a `GainNode` each give a crossfade, and it also offers `detune` and `playbackRate` with `pitchCorrection`. Risks: needs a development build; it does not talk to CarPlay, Android Auto or Cast; the lock screen works through `PlaybackNotificationManager` only while an AudioContext runs on iOS; whole recordings are decoded into memory (a one-hour discourse is large), so it suits short songs only; every integration (queue, offline files, leveling, sleep timer, resume) would have to be redone on the new engine.
   - https://swmansion.com/blog/hello-react-native-audio-api-bb0f10347211
   - https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/getting-started

Both touch the lock screen and background playback, the parts that cannot be tested without a phone. Dada's decision of 2026-11-08: a separate engine for a true crossfade is **not needed**. Kept as a plan only.

If it is ever wanted: build it behind a flag, for songs shorter than about 12 minutes, on a development build; test on a real iPhone and Android with the screen locked, with Bluetooth, and with a phone call coming in. Keep RNTP as the owner of the lock screen.

## 4. License flag

The v5 line of `react-native-track-player` moved to the commercial package `@rntp/player`. The page says it is free only for personal and educational use. The app is on `5.0.0-alpha0`. Decide the license before a public release.
