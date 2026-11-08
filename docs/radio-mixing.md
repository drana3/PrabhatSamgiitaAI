# Radio mixing and Top Played

This document has two parts. **Part 1** is written for anyone: what the Radio does when you choose
several categories, in plain words. **Part 2** is for the people who work on the code: the exact
rules, the numbers and the reasons for them. The code is `apps/mobile/lib/radio/mix.ts` (the mixer)
and its tests `apps/mobile/__tests__/radioMix.test.ts`.

---

## Part 1. In plain words

### What you can do

When the Radio starts you choose **what to play**: Prabhat Samgiita, Kiirtan, Bhajan, Spiritual
song, Dance music, Baba's Audio Discourses. **Every category is ticked the first time**, so the
Radio plays everything the app has. You can untick some, tick only one, or press **All** again.

- At least one stays on. If you try to switch off the last one, the screen says so gently and
  keeps it on.
- Each category shows how many tracks it has. A category with 0 cannot be chosen yet.
- You can change the choice **while the Radio plays**. The track you are hearing is never cut off.
  The change begins from the **next** track.
- The Radio screen and the small player at the bottom say in words what is playing
  ("Radio · Kiirtan, Bhajan").
- The choice is remembered on this phone.
- **The Radio keeps playing until you stop it.** Leaving the Radio screen (to Top Played, Search,
  a song page, anywhere) does not stop it. The small player at the bottom shows the radio line
  ("Radio · all categories") with a **stop** button; tapping the text takes you back to the Radio
  screen. Only the stop button, or stopping on the Radio screen, ends it. (Before, leaving the
  screen stopped the Radio; this was changed on the owner's request.)

### How the next track is picked

Think of a DJ with a few rules, not a coin toss.

1. **Gather.** Take every track from the categories you ticked.
2. **Share the turns between categories.** Prabhat Samgiita has about 3,700 recordings and Baba's
   discourses may have three. If every track had an equal chance you would almost never hear
   Baba. So the categories share the turns in a fairer way: a big category gets more turns, but
   not in proportion to its size, and a small one is guaranteed a real share. A tiny category is
   also not played too often (three discourses are not played every fourth track).
3. **Shuffle like a deck of cards.** Inside a category the tracks are shuffled once and dealt
   one by one. Every track is heard once before the deck is shuffled again. This is why
   it does not play the same song twice in a short time, which a pure random pick can do.
4. **Avoid repeats.** Not a track from the last 20 picks. Not a track you listened to in the last
   hour (the phone remembers this, see "Privacy"). Not the same performer twice in a row.
5. **A small push for loved tracks.** A track many people have played gets a second place in the
   deck, so it comes a bit more often. The push is capped: the most played track comes about
   twice as often as an unknown one, never ten times as often. A new track is not hidden,
   it is just not pushed.
6. **Never run dry.** If the choice is so small that the rules cannot all hold (for example only
   three tracks), the Radio gives up the least important rule first, so there is always sound.

### What is a "play" and where Top Played comes from

A play is counted when you really listen: 30 seconds, or half of a short track, once per
listener per day. Seeking forward does not count. The same rule is used for authors'
statistics. Top Played is the list of the tracks with the most counted plays (all time, last 30
days, last 7 days), by category. A track appears only after 5 counted plays, so one person
looping a song cannot put it on the list. While the list is still thin the screen says
"Counting since <date>".

### Privacy

Your listening history stays on your phone. It is only used to avoid repeating what you
just heard. The server receives counted plays the way it already does for recordings (a listener key that
cannot be turned back into a person, one count per listener per track per day) and sends back
public totals. Nothing about *your* list leaves the phone.

---

## Part 2. Technical description

### Where things live

| What | File |
| --- | --- |
| Pure mixer (no React, no clock, no `Math.random`) | `apps/mobile/lib/radio/mix.ts` |
| Categories, selection rules (toggle, last-tick guard, All, summary) | `apps/mobile/lib/radio/categories.ts` |
| Pool from the library and the catalogue | `apps/mobile/lib/radio/pool.ts` |
| Picker that joins pool, selection, history and the mixer | `apps/mobile/lib/radio/picker.ts` |
| Real wiring (stores in, `setRadioPicker` out) | `apps/mobile/lib/radio/live.ts` |
| Live change of the choice (replace the queued next track) | `apps/mobile/lib/radio/applyChange.ts` |
| Remembered choice, persist version 2 (version 1 stored Prabhat Samgiita only as its default; that becomes "all") | `apps/mobile/stores/radioSelectionStore.ts` |
| Popularity map | `apps/mobile/lib/radio/popularity.ts`, `lib/topPlayed/popularityLoad.ts` |
| Server: counts and Top Played | `apps/api/app/services/song_plays.py`, `top_played.py`, `api/v1/top_played.py` |

The hook into the existing Radio is one function: `setRadioPicker` in `lib/playableAudio.ts`.
`randomPlayableSongNumber(exclude)` asks the picker first and falls back to the old plain
random pick when there is none or it has nothing to offer.

### 1. Candidate pool

`buildRadioPools` sorts every playable track into six categories.

- `prabhat_samgiita`: the catalogue songs that have an audio file, plus uploaded recordings of kind
  Prabhat Samgiita.
- the other five: published recordings of that kind (the removed kind `devotional_song` reads as
  Bhajan). In the preview the three sample discourses are added.

A track key is `ps:<number>` or `rec:<app id>`, the same keys the listening history uses. The
counts shown on the chips are the pool sizes. The pool is rebuilt on every pick, so a library
change is seen at once. Only the **selected** categories that have tracks go into the mixer.
If every selected category is empty the picker falls back to the default (all categories that
have tracks) (`effectiveSelection`). A category that gets its first recording later joins by
itself when the person has "all" ticked.

### 2. Fair mix between categories (with a floor)

Which category is next: smooth weighted round-robin (the same deterministic scheme used by
load balancers), with these weights:

```
raw_i   = size_i ^ 0.5                     square root: a category 100x bigger gets 10x the weight
floor   = 0.5 / k                          half of an equal share (k = number of selected categories)
cap_i   = size_i / 40                      never more than one pick in 40 per track in the category
share_i = raw_i / sum(raw), then clamped into [floor, cap_i], the freed mass is re-shared
```

The caps are dropped if they cannot add up to 100% (very few tracks in total). Examples
(`categoryWeights`, computed with the real function):

| Selected categories (sizes) | Share of picks |
| --- | --- |
| Prabhat Samgiita 3,753, Kiirtan 14 | 75% / 25% |
| PS 3,753, Kiirtan 14, Bhajan 8, Baba 3 | 67.5% / 12.5% / 12.5% / 7.5% |
| PS 3,753, Kiirtan 300, Bhajan 120, Baba 60 | 58.5% / 16.5% / 12.5% / 12.5% |
| Kiirtan 14, Baba 3 | 68.4% / 31.6% |

Why square root: a linear share makes small categories inaudible, an equal share makes a
three-track category loop. The root is the usual middle path (general practice, not a Spotify fact).
Why the floor: "every selected category must be heard" is a promise to the listener. Why the cap: a
category of 3 tracks played every 4th pick would be a loop, not a mix.

### 3. Seeded shuffle bag

Each category has a **bag**: one cycle containing each of its tracks once, shuffled with a seeded
generator (Fisher-Yates over `mulberry32`). Picks are taken from the front. When the bag is
empty a new cycle is built. Properties: every track is heard once per cycle (no starvation),
no clumping of repeats, and a session can be replayed exactly from `(seed, picks)`.
The generator state is part of the mix state, so a session can be replayed exactly from its seed
and the same inputs. A session starts with a seed taken from the clock (`startRadioMix`); tests use
fixed seeds.

### 4. Popularity boost (smoothed, capped)

```
score(p) = 0                                  if p < 5          (gate: noise, one person looping)
         = ln(1 + p - 5) / ln(1 + 200 - 5)    clipped to [0, 1] (log: 10x plays is not 10x boost)
tickets  = 1 + score(p)                       between 1 and 2
```

`p` is the all-time counted play count from the server. A track gets a second copy in its
category bag with probability `score(p)` (so `tickets` is the expected number of copies; hard cap
2 copies per cycle). The two copies of a track are kept at least `min(20, size/2)` places apart.

| Counted plays | score | expected tickets |
| --- | --- | --- |
| under 5 | 0 | 1.00 |
| 10 | 0.34 | 1.34 |
| 30 | 0.62 | 1.62 |
| 100 | 0.86 | 1.86 |
| 200 and more | 1.00 | 2.00 |

So the boost is bounded by construction (at most 2x), smoothed by the log and gated against
noise. Plays come from `play_daily` + `song_play_daily`, which already apply the counted-play
rule and its abuse caps, so the boost cannot be inflated by one device. When the server
is unreachable the popularity map stays empty and the mix is a plain shuffle (cold start).
The map is fetched at radio start (3 pages x 100, top of all time) and not more than once in 10 minutes.

### 5. Anti-repeat rules

A candidate is taken from the front of the chosen category's bag. It is accepted if all hold:

1. **Recent window.** Not among the last 20 picks overall, and not among the last
   `min(20, floor(size/2))` picks of its own category (a category of 3 cannot keep 20 apart).
2. **Heard recently (local listening history).** Not heard in the last hour (`heardMs`).
3. **Performer.** The performer text (case and spaces ignored) differs from the previous pick's. Unknown
   performers never block.

Among the next up to 12 candidates that pass, the one **heard longest ago** wins, with a soft
staleness `exp(-age / 6h)` (older listens nudge, only the last hour is a hard rule). If no candidate in
the next 64 passes, rules are relaxed in this order: performer, then heard-in-the-last-hour,
then the recent window. The pick records which rules were relaxed and sets `exhausted` when the
selection is too small for the window.

### 6. Exhaustion and edges

- One selected category: the weights are trivially 100%, the bag and the anti-repeat rules still apply.
- A pool of 1 track repeats that track (nothing else exists); a pool of 2 alternates.
- A pool that changes between picks (a new upload, a deselected category) gets a new bag
  automatically; the signature of the pool is stored with the bag.
- The picker never returns the track playing now while anything else can play.
- No track at all: the picker returns `null` and the old random pick is used instead, so the Radio does not go silent.

### 7. Cold start

A new listener has no history, a new library has no popularity: every `heard` value is empty and
every `plays` value is unknown. Then the mix is: fair category shares, a plain shuffle bag, the
performer rule and the recent window. Nothing in the algorithm needs history or popularity to work.

### 8. A change while playing

`useRadioSelectionStore` changes; the next pick reads the new choice. The native player keeps
one upcoming track queued (`radioAdvance.ts`). If that track was picked from a category that has just
been switched off, `applyRadioSelectionChange` removes it and queues a new pick; a still-allowed
track stays. The track playing now is never touched. In the web preview there is no native queue,
so the next pick simply follows the new choice.

The same replacement runs when the person blocks an author while one of that author's recordings
is the queued track. Blocked authors are left out of the pool everywhere (the library already
did; Top Played rows, the preview samples and history replay now do too), see `lib/kirtan/blocked.ts`.

### 8b. Keeping the Radio on when the screen is left

`lib/radio/keepPlaying.ts` holds one flag, `RADIO_KEEPS_PLAYING_ON_LEAVE` (true). When the Radio
screen loses focus, `scheduleDriveBlurExit` in the player store asks `driveBlurDecision`:
`keep` (a running Radio: nothing happens), `forget` (another song replaced the Radio; only the
drive flag is cleared, that song is never stopped) or `exit` (a drive playlist: ended as before).
The watcher of the choice (`watchRadioSelection`) is mounted at the root, not on the Radio screen,
so a change reaches the queued track on any screen. The mini-player shows the radio line and a
stop button while the Radio runs; the stop button calls `exitDriveMode`. Set the flag to false to
restore the old behaviour.

### 9. Counting plays and the Top Played endpoint

- Phone: `PlayTracker` (`lib/authors/plays.ts`) already counted recordings; it now also counts
  catalogue songs (`song_number` in the event). Same rule: 30 s, or half of a track shorter than
  a minute, never under 10 s; seeking does not count.
- Server: table `song_play_events` (one row per song, listener and day) and `song_play_daily`. The caps
  of `author_stats.py` are shared with recordings and **not weakened**: the daily event cap per listener and
  the per-client and per-item caps count the rows of **both** tables, in both orders.
- `GET /api/v1/top-played?period=all|30d|7d&kind=...&limit=1..100&offset=...`: counted plays from both
  daily tables, a minimum of 5 plays, sorted by plays then key, with titles and the recording record. Periods
  are whole UTC days. Cached for 5 minutes. The old open counter `recordings.plays` is not used.

### 10. Honest comparison with Spotify's shuffle

What is public: the Spotify Engineering post
[How to shuffle songs?](https://engineering.atspotify.com/2014/02/how-to-shuffle-songs) (February 2014).
It says that a uniform random shuffle (Fisher-Yates) can put songs of one artist close together,
which listeners feel as "not random", and describes an approach that spreads the songs of one
artist across the list at fairly even gaps (borrowed from dithering), shuffling inside each
artist. That is the only Spotify source used here; everything about how Spotify works today
(personal recommendations, "Smart Shuffle") is not described in a primary source we could check,
so we make no claims about it.

| Idea | Spotify (per the 2014 post) | This Radio |
| --- | --- | --- |
| Pure random is not what people want | yes | yes |
| Spread items of one group evenly | artists spread across the list | performers kept apart (rule 3) and each track once per cycle |
| Shuffles a fixed list | yes, a playlist is permuted | no: an endless stream from a library, so a bag per category |
| Several categories with different sizes | not applicable | category shares with a floor and a cap |
| Uses popularity | not stated in the post | yes, bounded (max 2x) |
| Uses your listening history | not stated in the post | yes, last hour hard, older nudges, on the phone only |

The shuffle bag, the sqrt-damped category share and the staleness decay are general practice in
music-player and game-audio design, not taken from any Spotify document.

### 11. Numbers in one place (`MIX_RULES`)

| Name | Value | Meaning |
| --- | --- | --- |
| `recentWindow` | 20 | no repeat inside the last 20 picks (smaller for small pools) |
| `heardMs` | 1 hour | a track heard in the last hour is skipped while another exists |
| `historyTauMs` | 6 hours | older listens only nudge |
| `scanAhead` / `scanMax` | 12 / 64 | candidates compared / how far rules look before relaxing |
| `categoryPower` | 0.5 | square root of the category size |
| `categoryFloor` | 0.5 | half an equal share at least |
| `categoryCapPicks` | 40 | at most size/40 of the picks |
| `boostMax` | 1 | up to one extra ticket (2 copies) |
| `boostMinPlays` | 5 | below it, no signal |
| `boostRefPlays` | 200 | plays at which the boost is full |

### 12. What the tests prove

`radioMix.test.ts` (38 tests, fixed seeds): same seed gives the same sequence and another seed
differs; no pick repeats inside the recent window; every selected category appears; measured category
shares match the weights within a tolerance; the popularity boost never exceeds 2 copies and equals
1 under 5 plays; a one-track pool and an exhausted pool still answer and flag the relaxed rules.
`radioPicker.test.ts`: only chosen categories play, a change takes effect from the next pick, history
avoidance, the stale choice fallback. `radioSelection.test.ts`: last-tick guard, count 0, All,
persist and migrate. `topPlayed.test.ts`: the screen model, the remote mapping, the demo, the popularity load.
`test_top_played.py` and `test_song_plays_migration.py`: counting, caps in both orders, the endpoint.
