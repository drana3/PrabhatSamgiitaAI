# Mini-player visibility: where it shows, where it hides, and how content stays clear of it

One rule from Dada: wherever the mini-player is visible, the page must scroll far enough that its last line can be seen
above it. And the mini-player stays away from screens that need the bottom of the display. This file is the policy; the
code is one table, `apps/mobile/lib/playerPolicy.ts`, and `apps/mobile/__tests__/playerPolicy.test.ts` checks the code
against the table below, so a change in one without the other fails the tests.

## The policy

The mini-player is the pill above the bottom edge that shows what is playing and opens the full player. It exists only
while something is loaded in the player (nothing loaded: no pill on any screen).

- It BELONGS to screens that browse. They stay useful while a song plays, and the pill is the way back to it. On the four
  tabs, Search and the pushed browse pages (song page, a collection, the library, an artist, a recording, festivals,
  notifications, the learn lists) it sits over the floating tab bar (the bar and its Upload button stay under it). On a
  pushed page that owns the bottom (flashcards, quiz, stories, harmonium) there is no tab bar, so it sits just above
  the bottom edge.
- The tab bar on the pushed browse pages is there so that no page is a dead end: one tap goes to any tab, whatever the
  number of pages opened on the way. It marks the tab the person came from (the shell under the page); tapping a tab
  closes the pages above the shell and shows that tab (`router.dismissTo`, as Search does). It is drawn by
  `components/nav-v2/DeepTabBar.tsx`, mounted by `MiniPlayerHost`, and it steps aside while a keyboard is up.
  The tab screens and Search draw their own bar.
- It STAYS AWAY from screens that own the bottom of the display: the full player (it is the big version of the pill),
  sign-in and onboarding, sheets and forms with a keyboard and a send button, settings with action buttons, the
  content rules the person must read and agree to, a live video, and the assistant (its message box is where the pill
  would be). Those screens open over everything, including the tab bar and its Upload button, which are not shown
  on any pushed screen anyway.
- In-screen sheets (Save to, share, report, pickers) are not routes. While one is open the pill and the tab bar slide
  away by themselves (`lib/sheetCover.ts`), so a sheet never has something floating over its last button.

### The table

| Screen | Routes | Mini-player | Tab bar and Upload button | Why |
| --- | --- | --- | --- | --- |
| Today | `/v2/today` | Shown above the tab bar | Shown | A home tab: the pill sits over the tab bar so the song stays one tap away. |
| Songs | `/v2/songs` | Shown above the tab bar | Shown | A browsing tab. |
| Kiirtan | `/v2/kiirtan` | Shown above the tab bar | Shown | A browsing tab. |
| Learn | `/v2/learn` | Shown above the tab bar | Shown | A browsing tab. |
| Search | `/search-v2` | Shown above the tab bar | Shown | A tab-like page: the bar stays under it, and results are played from it. |
| Song page | `/song-v2`, `/song` | Shown above the tab bar | Shown | The page is about a song; the bar under it takes the person to any tab in one tap, and the pill above it shows what is playing. |
| Songs lists and collections | `/songs-v2-collection`, `/songs-v2-index`, `/songs-v2`, `/collections-v2`, `/collections`, `/browse-shelf` | Shown above the tab bar | Shown | Browsing: the person plays one song after another, and the bar is the way back to any tab. |
| Library, saved and playlists | `/library-v2`, `/saved-v2`, `/playlist-v2`, `/playlist`, `/listening-history`, `/top-played` | Shown above the tab bar | Shown | Browsing the person's own songs; the bar is the way back to any tab. |
| Kiirtan pages (list, artist, mix, event playlists, a recording) | `/kiirtan`, `/kirtan-artist`, `/kirtan-mix`, `/recording-set`, `/my-sets`, `/recording` | Shown above the tab bar | Shown | Browsing recordings; a recording's page (chords, videos, comments) scrolls clear of the pill and the bar, and the bar hides while a keyboard is up. |
| Learn pages (songs, ragas) | `/learn` | Shown above the tab bar | Shown | Study with the song playing in the background; the bar is the way back to any tab. |
| Learn full-screen (flashcards, add a word, quiz, stories, harmonium) | `/learn/words`, `/learn/add`, `/stories`, `/story-sheet`, `/quiz`, `/harmonium-v2` | Shown above the bottom edge | Not shown | A full-screen task, card review or story: the screen owns the bottom, so no tab bar; the pill stays above the edge. |
| Festivals | `/festivals`, `/festival` | Shown above the tab bar | Shown | Browsing; songs of the festival can be played, and the bar is the way back to any tab. |
| Notifications | `/notifications` | Shown above the tab bar | Shown | A list; the bar is the way back to any tab. |
| Author pages (directory, a public page, your own page) | `/author`, `/authors`, `/my-author` | Shown above the tab bar | Shown | Browsing recordings: a page to play from; the bar is the way back to any tab and the pill to what plays. |
| Full player | `/player-v2`, `/player` | Hidden | Not shown | The player IS the full version of the pill. |
| Welcome, sign in, finish profile | `/welcome`, `/auth`, `/signin`, `/complete-profile` | Hidden | Not shown | A task with a button at the bottom; nothing is playing yet for a new person. |
| Edit profile and the profile sheets (language, appearance, script) | `/edit-profile`, `/profile-sheet`, `/script-translations`, `/review-style`, `/language`, `/volume-leveling`, `/transitions` | Hidden | Not shown | Sheets and forms that draw over the whole screen. |
| Settings (notifications, storage, contact us) | `/notification-settings`, `/storage`, `/feedback` | Hidden | Not shown | Switches and action buttons at the bottom; the pill would sit on them. |
| Upload and Add recording | `/upload-chords`, `/upload`, `/add-kirtan`, `/upload-set`, `/chords-review`, `/team-review`, `/recording-chords`, `/recording-chart` | Hidden | Not shown | Forms with a keyboard and a send button; the screen opens over the tab bar and its Upload button. |
| Become an author, edit the page, claim recordings | `/become-author`, `/author-edit`, `/author-claims`, `/author-find` | Hidden | Not shown | Forms with a keyboard and a button at the bottom (Publish, Add to my page); the pill would sit on them. |
| Content rules | `/content-rules` | Hidden | Not shown | A page to read to the end and agree to; the pill covered its last lines. |
| Kiirtan live | `/kiirtan-live` | Hidden | Not shown | A video is playing: two sounds at once would clash. |
| Assistant | `/assistant` | Hidden | Not shown | The message box sits where the pill would. |

A path in no row is "Any other pushed screen": the pill shows above the bottom edge, no tab bar. `/learn/words` and
`/learn/add` are in the full-screen row on purpose: the longest prefix wins over `/learn`. Matching is by route
prefix, segment aware (`/kiirtan` does not match `/kiirtan-live`), and the longest prefix wins.

## How content stays clear (the bottom inset)

One function decides the bottom padding of every scrolling page: `scrollBottomInset` in `lib/navV2.ts`, used through the
hook `useScrollBottomInset(extra?)` (`hooks/useScrollBottomInset.ts`). It reads the route and the player, so a screen
does not know about the pill:

| Where | Bottom padding of the scroll content |
| --- | --- |
| Tab screen, Search or a pushed browse page with the bar, pill showing | bottom safe area (at least 12) + tab bar 68 + gap 12 + pill 64 + gap 12 |
| Tab screen, Search or a pushed browse page with the bar, nothing playing | bottom safe area (at least 12) + tab bar 68 + gap 12 |
| Pushed screen without the bar, pill showing | bottom safe area (at least 12) + pill 64 + gap 12 + air 24 |
| Pushed screen without the bar or hidden screen, no pill | bottom safe area (at least 12) + air 24 |

Use it as `paddingBottom` of the `contentContainerStyle` of the ScrollView or FlatList, never a fixed number
(a fixed 190 is right on one phone and wrong on the next). A page with its own air passes it as `extra`.
Screens that are hidden-pill rows still call the hook: it then gives the bare safe area plus air, so the rule has no
exceptions and a policy change needs no screen change.

## Adding a screen

1. Decide whether it browses (pill and bar shown) or owns the bottom (hidden, or the pill without the bar). Add it to its row in `PLAYER_POLICY` or give it a
   row, and add the same line to the table above (the test compares them).
2. If it scrolls, set the content's `paddingBottom` from `useScrollBottomInset()`.
3. A new sheet that is not a route calls `useCoverWhile(open)` (`lib/sheetCover.ts`).

## The profile sheet: the way back

The profile sheet is the hub of every setting. A row of it always PUSHES its page above the sheet (`openFromProfile` in
`lib/profileNav.ts`; Edit profile, Your library, History, Storage, Language, Script and translations, Review style,
Notifications, Sign in, Send feedback, Content rules, About, Admin), so the sheet stays one step down in the stack and
Back (the button, the Done of a sheet, the swipe, the Android back key) lands on it. Before, five rows replaced the
sheet, and Back from them dropped the person on Today or Songs. A page that closes with `router.back()` is right; one
that opens a tab with `replace` or `dismissTo` is not, except the tab bar of the pushed browse pages (`DeepTabBar`),
which is meant to leave. Tested in `__tests__/profileBack.test.ts` (a model of the stack, plus a check of the source of
`ProfileContent` and of the exits of every inner page).

## Scenario board

A picture of eight representative screens with the pill, its bottom air and the hidden cases is in
`Для-Дады/плеер-политика/` (outside the repository, made for Dada).
