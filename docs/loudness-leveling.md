# Volume leveling and track joins

One recording is mastered loud, another quiet. Without a correction the listener turns the volume down
for one and up for the next, and in the Radio the next track can jump out of the speakers. This page
says how the app now levels recordings, what is measured where, what works on a phone and what only
in a browser, and what has been verified.

## 1. The idea in three lines

1. The **server measures** each recording once: integrated loudness in LUFS and true peak in dBTP.
2. The **app turns each track up or down** toward one common level while it plays: `gain = reference - loudness`.
3. At the **join** of two tracks the volume is handed over before or just after the join, so the
   level is the same on both sides. A crossfade is possible only where the player can overlap two tracks.

## 2. Terms

- **LUFS** (also LKFS): how loud a recording sounds on average, weighted for the human ear (ITU-R BS.1770,
  gated so silence does not count). A bigger number (closer to 0) is louder: -9 is loud, -20 is quiet.
- **True peak (dBTP)**: the highest point of the sound wave, including the peaks between samples. Above
  0 dBTP the sound distorts. It limits how far a quiet track can be raised.
- **ReplayGain**: the same idea as a tag in the file (a gain to apply, and a peak). Reference -18 LUFS.
  We keep the numbers in the database instead of in the files.
- **Limiter**: a stage that squeezes peaks so a boosted track does not clip. We do not use one: a boost
  is capped by the measured true peak instead.
- **Gapless**: the next track starts the instant the previous ends, with no silence.
- **Crossfade**: the end of one track fades out while the start of the next fades in.

## 3. What the others do (sources in the board `Для-Дады/громкость-и-переходы`)

- Spotify: -14 LUFS by default (Quiet -19, Loud -11); turns up only as far as the peak allows; a limiter
  only for Loud. support.spotify.com, "Loudness normalization".
- Apple: Sound Check stores a gain in the file's metadata and applies it on playback (Apple Digital
  Masters PDF). Apple Podcasts asks for about -16 LKFS and true peak -1 dBFS or lower.
- EBU R128: -23 LUFS for broadcast, true peak -1 dBTP at most. ReplayGain 2.0: -18 LUFS reference.
- YouTube: not confirmed by Google (third parties report -14 LUFS and turn-down only).
- Speech reads 2 to 3 LU louder than music at the same number (AES TD1008, reported by Production Expert),
  so a discourse gets its own, lower reference.

## 4. What the app does

| Piece | Where |
| --- | --- |
| Measurement (ffmpeg `ebur128=peak=true:dualmono=true`) | `apps/api/app/services/recording_loudness.py` |
| Stored on each upload | `recordings.loudness_lufs`, `true_peak_db`, `loudness_measured_at` (migration `0048_recording_loudness`) |
| Archive recordings (PS songs) | `media.metadata_json["loudness"]`, filled by the backfill script |
| Fields in the API | `RecordingOut.loudness_lufs/true_peak_db`, `MediaItemResponse.loudness_lufs/true_peak_db` |
| Backfill (manual) | `apps/api/scripts/measure_recording_loudness.py` |
| The arithmetic | `apps/mobile/lib/loudness/levels.ts` |
| Volume handover on the phone | `lib/loudness/leveler.ts`, `lib/playback/levelingBridge.ts` (called from `rntpCatalogPlayer.ts`) |
| Crossfade plan and curves | `lib/loudness/crossfade.ts` |
| Web Audio engine (boost, overlap) | `lib/loudness/webAudioEngine.ts` |
| Switch "Volume leveling" (default on) | `stores/loudnessStore.ts`, `app/volume-leveling.tsx`, a row in the profile sheet |

### Levels

| | Music | Speech (Baba's audio discourses) |
| --- | --- | --- |
| Target | -14 LUFS | -16 LUFS |
| Phone (can only turn down) | -18 LUFS | -20 LUFS |

Why the phone reference is 4 dB lower: the native volume goes from 0 to 1 only, so a quiet track cannot be
raised. With the reference at -18 most recordings sit above it and are brought exactly onto it; tracks
quieter than -18 stay as they are and are reported as "cannot boost". Spotify's own Quiet setting is -19.
A player that can boost (Web Audio) uses the full target and raises quiet tracks by
`min(target - loudness, -1 dBTP - true peak, 12 dB)`. A cut is never deeper than 24 dB, so a broken
measurement cannot mute a track. A track without numbers, silence and a failed measurement all play unchanged.

### The join on the phone

The native player (react-native-track-player v5) has one volume for the whole queue and one active track.
So there is no overlap and no per-track volume. The next track is already queued by the Radio and by lists
(`enqueueTrack`), so the join is gapless, and the leveler moves the one volume:

- the track that follows needs a bigger cut (it is louder): the volume is lowered in the last 1.2 s of
  the current track, so the loud one never starts at the old volume;
- it needs a smaller cut (it is quieter): after the join the volume rises over 280 ms;
- after a skip the cut is immediate, the rise a ramp.

The slider volume and the sleep-timer fade are multiplied in: `nativeSetVolume` now sets the listener's
volume and the leveler sets the real one.

### The crossfade

`planTransition` crosses two tracks only when both are measured and within 4 dB after leveling, of one
class (a discourse is never mixed into music), and not longer than a fifth of the shorter track; the
fade is 1 to 3 s (default 2) on equal-power curves (cos and sin, power sum 1; linear fades dip 3 dB).
The phone's player cannot overlap, so the phone does a level-matched gapless join. The overlap lives in the
Web Audio engine, which has two decks, preloads the next track 25 s ahead and starts the fade a fade-length
before the end. A native overlap needs a different engine (see questions in the board).

The Radio keeps its mixer (`lib/radio/mix.ts`) and its anti-repeat rules untouched: leveling only changes how
loud a picked track is played and how the join sounds, never which track is picked.

## 5. What works where

| | Phone (RNTP) | Web Audio engine | Web preview of the redesign |
| --- | --- | --- | --- |
| Turn a loud track down | yes | yes | no sound at all (simulated player) |
| Raise a quiet track | no | yes, to the true-peak ceiling | no sound |
| Gapless join | yes (queued next track) | yes | no sound |
| Level handover at the join | yes | yes | no sound |
| Overlapping crossfade | no | yes | no sound |
| Settings switch | yes | yes | yes (shows the phone's behaviour) |

The Web Audio engine is built and tested but nothing in the app starts it: the app has no real web player.
It is the engine for one, and the reference for a native engine with overlap.

## 6. What was verified, and what was not

- Unit tests (vitest): the arithmetic, peak limit and bounds, speech vs music, the curves, the planner,
  the leveler on a hand-driven clock, the native wiring on a fake player, the Web Audio engine on a fake context.
- Headless Chromium with the real Web Audio API and two synthetic tones whose loudness differs by 6 dB:
  with leveling on the output level was -13.36 dBFS before and -13.33 dBFS after the join (step 0.03 dB) and
  stayed within 0.26 dB through the 2 s crossfade; with leveling off the same pair stepped 6.03 dB.
  Chrome's `DynamicsCompressorNode` adds automatic makeup gain (+1.7 dB measured), so the engine has no compressor.
- API: parsing of ffmpeg's summary, validation, a fake ffmpeg, the upload path, migration 0048 (head, repeat,
  downgrade) and the backfill script. A test with the real ffmpeg runs when ffmpeg is installed.
- **Not verified:** playback on a real iPhone or Android phone; PostgreSQL (the tests use SQLite; the migration is
  plain `add_column`); ffmpeg on the production server; the listening result with real recordings.

## 7. Server

- Install `ffmpeg` in the API image (`apt-get install -y ffmpeg`). Without it nothing breaks: recordings
  are stored with no numbers and play unchanged. Set `RECORDING_FFMPEG_PATH` if it is not on the PATH.
- Run the migration (`alembic upgrade head`, revision `0048_recording_loudness`).
- Measure what is already stored, by hand, from `apps/api`: `python scripts/measure_recording_loudness.py` is a
  dry run that only counts; `--execute --limit 20` is a pilot; `--source media` measures the Prabhat Samgiita
  archive recordings (downloaded politely, `--delay`); `--report loudness.csv` writes a line per item. It is safe
  to repeat (items that have numbers are skipped; `--remeasure` redoes them), commits each item on its own, and
  asks for a typed `yes` before it writes. Never run it against production without a backup.
- Cost: about 300 to 500 times faster than real time, so a 5-minute recording takes under a second of CPU
  and an hour-long discourse a few seconds. No extra storage: two floats and a timestamp per recording.
