# Kiirtan page

The page of one Kiirtan recording: `apps/mobile/app/recording/[id].tsx`. For a recording with a chord cycle it is built
from tabs.

## Layout, top to bottom

1. Hero (cover, title, authors) and the tags.
2. **Play** and the **"How does it feel?"** menu on one row. The menu (`MoodBlock collapsible`) shows the chosen mood
   under the question and opens the options below it; it does not take the page any more.
3. **Tabs**, always in this order: **Chords, Video, Notes, Story** (`lib/recordingExtras/kiirtanTabs.ts`,
   `components/recording-extras/KiirtanTabs.tsx`). They are the Prabhat Samgiita song page's own menu
   (`SectionTabs` of `components/song-page/ui.tsx`: text tabs, a 3 px underline on the chosen one, the answer on
   touch-down): the type, spacing and motion are one thing in both places, not a copy. The page opens on Chords. A link may name a tab (`?tab=video`); a
   notification about a reply opens Story.
   - Chords: the chord cycle (`CycleBlock`): the tune chips, the ring, the chord line, then "All the chords of this
     tune" with the instrument picker and the strip of chord cards.
   - Video: the video and the other links.
   - Notes: the piano notes.
   - Story: the stories and memories (comments).

Other kinds of recording (bhajan, Baba's audio) keep their layout; only the mood menu changed.

## Chord ring

`CycleRing`: 4 to 8 chords on a circle, wide (up to 340 px, the whole row on a phone), discs 56 to 64 px, no text in the
middle. The rounds ("x4"), the key and the start chord are said under the ring. The measures live in
`lib/recordingChords/ringGeometry.ts` and are tested: two neighbouring discs never touch, also with 8 chords at 360 and
390 px. A tap on a chord opens its chord card (`docs/chord-card.md`).

## Entry screen (chord cycle wizard)

See `docs/kiirtan-cycle.md`. On this screen the number of tunes and the choice of tunes are pop-up sheets
(`components/recording-extras/TuneSheets.tsx`), not a stepper and a grid of 30 numbers.

## How a listener finds the page

A Kiirtan page has chords, video, notes and stories, and nothing in the player said so. The recommended entry is a chip
under the title in the player: **"Chords · Video · Notes ›"** (`components/player-v2/RecordingPageChip.tsx`, shown for a
Kiirtan that has a page, not in drive mode). A tap closes the player and opens the page. The other options that were
considered (a card on the recording tile, a label on the shelf, a one-time hint) are on the board
`киртан-аккорды-и-видео`; the chip is the one built.
