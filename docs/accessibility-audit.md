# Accessibility and dark theme audit

Written 2026-11-09 on branch `redesign/v2`. This is an audit from code and from a browser preview at 390 px, not a
test with a screen reader on a phone. Where a result needs a real device it says so. Items marked **main** are in
files that exist on the team's main branch; they are listed here and **not changed**.

## How it was checked

1. **Static scan of `apps/mobile/app` and `components`** (422 screen and component files) with a small script
   (`/private/tmp/.../scratchpad/a11y_scan.py`, not kept in the repository): every pressable with a handler, its role and label;
   text inputs without a label; images without a label; fixed text sizes; hard-coded colours.
2. **Browser preview at 390 x 844**, light and dark (dark by writing the app's own `prabhat-appearance` setting), on
   Today, Songs, Kiirtan, Learn, Search, the profile sheet, a song page and my two new sheets: roles present, size of
   every button, link, radio and checkbox, text contrast against its background where the background is a flat colour.
   The probe is crude: text on photos and on translucent glass is not measured correctly (see the notes).
3. **Token contrast**: the colour system is already tested in `__tests__/colorPairs.test.ts`
   (4.5 for text, 3 for large text and graphics, both themes). I did not repeat that; I looked for code that
   **bypasses** the tokens.

## What was fixed (non-main files only)

| Where | Problem | Fix |
| --- | --- | --- |
| `components/profile-v2/SheetBlocks.tsx` `SetRow` | the red "Delete account" row used the graphics red `danger`: 4.36:1 on a light card, 3.98:1 in dark; text needs 4.5 | uses `dangerText`, the token made for text |
| same file, `LangRow` | an option name could be cut to one line at the largest system text size, so a native language name was truncated | no line limit on the name |
| same file, `DoneButton` | fixed height 48: at large text the label would clip | `minHeight` 48 with padding |
| same file, `LanguageSearch` | accessibility label was a hard-coded English phrase | label follows the placeholder text, which is translated |
| `lib/playerPolicy.ts`, `docs/player-visibility.md` | the Usage data sheet was missing from the player visibility table, so the mini player covered its Done button (found in the preview) | added `/usage-data` to the sheets row |

Checked and fine: the Language and Usage data sheets expose one `heading`, radios with a selected state and a
combined label ("name, description"), and a `button` for Done. No target is smaller than 44 px, there is no horizontal
scroll, and the dark theme renders correctly (read from screenshots).

## Findings, by area

### Labels, roles and states

* 599 pressables with a handler. About 68 have no explicit `accessibilityLabel`; most of those contain visible text, which
  is read aloud as their name, so they are acceptable. What is missing is mostly the **role** (the screen reader says
  "button" or "link", or "tab"). In the redesign code the role is set, or comes from the shared press wrappers
  (`TodayPress`, `Press`, `KPress`, `TouchButton`).
* The real gaps are in **older screens (main)**:
  * `app/admin/index.tsx` (11 pressables without a role), `components/admin/AdminDevanagariPanel.tsx` (6): team tools.
  * `app/(tabs)/ai.tsx`: the history sheet backdrop and rows, "Start new chat" (no role).
  * `app/search/index.tsx`: the recent-search chips, "Browse all collections" link.
  * `app/(tabs)/profile.tsx`: name editing modal (backdrop pressables have no role; the English text in it is also not translated).
  * `app/quiz/index.tsx`, `app/quiz/event/[slug].tsx`, `app/collections/index.tsx`, `app/song/[songId].tsx` (1),
    `components/common/PhoneInput.tsx`, `components/common/LanguagePickerModal.tsx`, `components/songs/VirtualHarmonium.tsx`.
  * Text inputs without an accessibility label: 28 across the code; most carry a `placeholder`, which screen readers
    use as a fallback, but a visible label or an explicit one is better. Largest groups: admin tools, sign-in and
    phone fields (auth area: not touched), search.
* Modal backdrops that close a sheet when tapped should be hidden from screen readers (or labelled "Close") so the
  reader does not stop on an unnamed element. This pattern is repeated in the **main** screens above.
* Images: decorative images are not focusable by default in React Native, so unlabelled pictures are acceptable.
  Informative ones (album covers with the title next to them) are read via the text beside them.

### Touch targets

Apple asks for 44 pt, Google for 48 dp. WCAG 2.2 level AA asks for 24 px (everything passes that).
Visible size below 44 in the preview (the real area can be larger where `hitSlop` is set; **verify on a device**):

* Songs: "All collections" 30 x 30, "Sort songs" 106 x 40, "Open filters" 118 x 40, "Play all" 103 x 40.
* Kiirtan: round "More actions" buttons 40 x 40, duration chips 40 high, "See all" 36, "Shuffle everything" 36.
* Search: every "See all: ..." link 36 high, "My listening history" 36.
* Profile sheet: the Light and Dark appearance pills 36 high.
* Song page: "Reply" 32 high, "1 reply" 32, the "Share anonymously" checkbox row 24 high, "Post" 40.

Recommended fix, which changes no visible design: add `hitSlop` of 4 to 6 on those controls so the touch area reaches 44.
Not applied: these belong to screens other people are editing (songs, Kiirtan, search, song page).

### Text size (up to 200 %)

* No `allowFontScaling={false}` anywhere: text follows the system size.
* `constants/fontScale.ts` caps the scale at **1.3** for rows with a fixed height (catalogue rows, the tab bar, the mini player).
  WCAG 1.4.4 asks for text to reach 200 % without losing content. At 130 % to 200 % those rows stop growing, which is
  a deliberate trade against clipped layouts. It is a partial pass. To fully pass, convert the fixed-height rows to
  `minHeight` and raise the cap to 2.0 one component at a time. The shared sheet blocks were done above.
* Not tested at 200 % on a device or simulator.

### Colour and contrast

* The tokens pass (tested). Text colours in the redesign use the tokens.
* **Old colour file, main:** `constants/colors.ts` is still imported by **77** files, and `colors.textMuted` is used about
  **103** times. Measured on its backgrounds (`#FAF7F2`, `#FFFFFF`, `#FFF8F0`):

  | Colour | Contrast | Verdict |
  | --- | --- | --- |
  | `textMuted` `#9B908A` | 2.9 to 3.1 | **fails** body text (needs 4.5) |
  | `textSecondary` `#6E625C` | 5.5 to 5.9 | passes |
  | `primary` `#F58220` with white text | 2.6 | **fails** (white on this orange) |
  | `primaryDark` `#D96709` with white text | 3.6 | passes only for large text |
  | `warning`, `success` as text | 2.3 to 4.1 | fail as text |
  | `error` `#C84C4C` | 4.3 to 4.6 | borderline |

  A one-line change in `constants/colors.ts`: `textMuted` to `#74685F` (5.05 to 5.4:1 on those backgrounds) repairs most of the
  list at no visible cost. Buttons that use `colors.primary` behind white text should use the design system's action
  fill (`orange700`, 5.1:1 with white) as the redesign does. Not changed because the file is shared by main screens.
* In the preview, text over photos and glass cannot be measured by the probe. The tab bar labels in dark mode read as
  failing in the probe (2.5), but measured on the screenshot they are about 6.5:1 (grey `#A8A29A` on a dark glass), so they pass.
  Text on photo tiles (collection cards, hashtags) sits on a scrim by design; a few cards should be measured on the real photos.

### Dark theme

* **The default is Light, not Auto** (`lib/appearance.ts`, `DEFAULT_APPEARANCE`): existing and new installs see light until the
  person chooses Dark or Auto. The picker is in the profile sheet. If Dark is expected to follow the phone, switch the default to Auto. That
  is a product decision, not made here.
* The redesign screens use the theme (45 files read `useAmTheme`). **77 files still use the fixed light `colors`**:
  on a phone set to Dark, those screens show light pages. Screens most worth converting first (all main):
  the AI assistant tab, saved and playlists, the search results page, quiz, collections, admin tools and the phone field.
* The new sheets (Language, Usage data), Today, Songs, Kiirtan, Learn, Search and the song page rendered correctly in dark
  in the preview (screenshots in the scratchpad), with no unreadable text found.

### Motion

* 71 files animate; 52 of them check the system "reduce motion" setting. The files without the check are mostly small
  press feedback springs (a 0.86 scale on a button), which are not the kind of motion the setting is about. Worth a look:
  the page reveal on `components/home/HomeScreen.tsx`, `components/nav-v2/StickyChips.tsx`, the song page
  (`components/song-page/Shell.tsx`, `SongPage.tsx`, `TextBlock.tsx`), `components/songs-v2/Toast.tsx` (fade, harmless),
  `app/kiirtan.tsx`, and main files `app/song/[songId].tsx`, `app/stories/[slug].tsx`, `components/home/CommunityVoicesTicker.tsx`
  (a ticker that moves by itself: this one should stop when reduce motion is on).

### Screen reader reading order

Not tested with VoiceOver or TalkBack. Static reading: sheets open with the heading first, then the intro and the options,
the Done button last, which is the right order. The mini player and the tab bar sit over content in the tree; **check on a device** that they do not
interrupt the reading of a sheet (the Usage data fix above removes one such overlap).

## To check on a device

1. VoiceOver (iPhone) and TalkBack (Android): open Today, Songs, a song, the player, the profile sheet; swipe through; every
   control must have a name and a role, and sheets must read heading first.
2. Largest text size in system settings: open the catalogue, a song page, sheets; nothing clipped or overlapping.
3. Dark: a phone set to dark with Appearance on Auto, walk the main screens.
4. Reduce Motion on: the ticker and page reveals should stop or become a plain fade.
5. The touch areas listed above.

## Main files list (not changed)

`constants/colors.ts`, `constants/fontScale.ts`, `app/admin/index.tsx`, `components/admin/AdminDevanagariPanel.tsx`,
`app/(tabs)/ai.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/saved.tsx`, `app/search/index.tsx`, `app/quiz/index.tsx`,
`app/quiz/event/[slug].tsx`, `app/collections/index.tsx`, `app/song/[songId].tsx`, `app/stories/[slug].tsx`,
`components/common/PhoneInput.tsx`, `components/common/LanguagePickerModal.tsx`, `components/songs/VirtualHarmonium.tsx`,
`components/home/CommunityVoicesTicker.tsx`.
