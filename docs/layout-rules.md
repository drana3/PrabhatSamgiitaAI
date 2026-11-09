# Layout rules: the top of a screen, and the space between blocks

Two rules that were broken by hand more than once, so they are now one piece of code each and a test that fails when a
screen goes around it. The code is in `apps/mobile/lib/screenTop.ts`, `apps/mobile/lib/layout.ts` and the components in
`apps/mobile/components/common/` (`SheetModal.tsx`, `SheetTopBar.tsx`, `Layout.tsx`). The tests are
`apps/mobile/__tests__/layoutRules.test.ts` (guards) and `safeAreaTop.test.ts` (the safe area with an iPhone's numbers).

## Safe area

The status bar, the camera cut-out and the Dynamic Island take the top of the display (59 dp on an iPhone 15 Pro,
47 to 54 on older ones). Nothing the person has to read or press may sit there: not a title, not a close button.

What went wrong. The song chooser ("Which song") and the language list of the upload forms are React Native `<Modal>`
sheets. Their header was written by hand with `paddingTop: 8`, so on an iPhone with a Dynamic Island the title sat under
the island and the close button under the battery. The route sheets (Upload, Add recording) had been fixed one by one
earlier; the pickers were missed because there was no single place to fix.

The rule, by kind of screen:

| Screen | How its top is made |
| --- | --- |
| A page (pushed card, a tab) | `useScreenTop()`: the reported inset, else 54. |
| A sheet that is a route (`presentation: "modal"`, "formSheet", "fullScreenModal": Upload, Add recording, Sign in, Content rules) | `<SheetTopBar>` (grabber and close button in a row of their own, below the island) or `useSheetTop()` for its own header. |
| A sheet drawn with React Native's `<Modal>` that fills the screen (song chooser, language list, year list) | `<SheetModal>` (`components/common/SheetModal.tsx`). It measures the safe area inside the Modal (`ModalSafeArea`) and puts the title row below it (`ModalHeader`). Never `<Modal presentationStyle="pageSheet">` by hand. |
| A bottom sheet or a dialog (`<Modal transparent>`, `transparentModal` routes) | It does not reach the top, so it needs no top padding. It must keep its own height below `windowHeight - top`. |

The numbers come from one function, `sheetTopInset` / `screenTopInset` in `lib/screenTop.ts`: the real inset always wins,
a fixed number is only the fallback where nothing is reported. Writing `Platform.OS === "web" ? 54 : insets.top` in a
screen is wrong: in the browser preview the phone frame supplies 59.

How it is checked. The guard test fails if (1) a non-transparent `<Modal>` appears outside `SheetModal`, (2) a route with
a modal presentation does not use the shared top, (3) a screen hard-codes the browser top. The numbers are tested with
an iPhone's inset (top 59) and a mocked `useSafeAreaInsets`. The web preview cannot show this (its insets are 0 unless
the frame is on), so the check on a real device or the Simulator still has to be done by a person.

Adding a screen: pick its row in the table; if it is a full-screen picker use `SheetModal`; if it is a route sheet put
`<SheetTopBar>` first. Do not write a top padding.

## Space between blocks

What went wrong. Pages carried their own numbers. On the Kiirtan artist page "All recordings" sat close under the last
song (a heading with its own padding), on the author page the Play button ran into the Demo tag when the author had no
bio (the gap belonged to the bio, so no bio, no gap), the Shuffle and Share buttons and the cards below them were 10 to
16 apart while the headings were 30 away.

The rule:

1. Every vertical gap between blocks is on the scale 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 (`amSpace`, the design
   system's 4 px grid). No 10, 14, 18, 20, 30.
2. A heading and its block are one component, `<Section title>`. The air above the heading is always 32
   (`SECTION_TOP`), the air under it 12 (`SECTION_GAP`). A section with no content still leaves the gap under the
   heading, so a list that follows starts the same distance below it. `size="page"` is the 28 dp heading of the Kiirtan
   pages, the default is the 22 dp shelf heading. `bleed` lets a row that scrolls sideways run edge to edge.
3. Blocks that follow each other (buttons, cards, a header's groups) are in a `<BlockStack gap>`: the gap belongs to the
   stack, not to a child, so a child that is missing (no bio, no Demo tag) cannot take its gap with it.
4. Between two blocks the gap is never smaller than 8 (`MIN_BLOCK_GAP`). Lines of one text block may be 4 apart.
5. The side padding of the author and library pages is 20 (`SCREEN_SIDE`).

Screens already on it: the public author page (`AuthorShowcase`, `app/author/[slug].tsx`), "Your author page"
(`my-author.tsx`, `ClaimsCard`), the Kiirtan artist page (`kirtan-artist.tsx`). The guard test lists them
(`SPACING_FILES`); a page joins the list when it is converted.

How it is checked. For the listed files the test fails if a vertical spacing value (`paddingTop`, `marginTop`,
`paddingBottom`, `marginBottom`, `paddingVertical`, `marginVertical`, `gap`, `rowGap`) is not on the scale, if a
`<BlockStack gap>` or `<Section top>` is off the scale or under 8, if the file does not use `Section`, or if it brings
back the old `SectionTitle` heading.

### Forms: the playlist's details step (8 Nov 2026)

What went wrong. On step 2 of the playlist ("Details"; step 1 of the form itself, after the files) the place and the year sat 16
apart from the title and from each other, the same as a label and its field are 8 to 10 apart. Everything on the step looked
like one block, and the year and place seemed glued to the block above them (Dada's words: "2026 and the place are too close to
the block above").

The rule for a form (a long page of fields):

1. A FIELD (label, hint, the choice or the input, the error) is one block: its parts are 8 apart (`gap: 8`, not 10).
2. The fields of a form are 24 apart (`styles.details` of `app/upload-set.tsx`, `styles.group` of the add form). Not 16.
3. A field and the tick that belongs to it ("I am the author of this recording" under the performer) are 16 apart
   (`styles.pair`).
4. Two fields that the person reads as one question may sit in one row (year and month), 12 apart.

How it is checked. `layoutRules.test.ts`, "Space between blocks: the upload forms": the form components are on the scale, the
details step is drawn with a gap of at least 24, and the label-to-field gap is 8. The two big screens (`add-kirtan.tsx`,
`upload-set.tsx`) are not yet converted to `Section` and `BlockStack`, so they are not in `SPACING_FILES`; the guard above covers the
part that broke.

Adding a page: build it from `Section` and `BlockStack`, add the file to `SPACING_FILES`, and look at it at 390 px: no two
blocks may touch.

## An input beside a group of tags (9 Nov 2026)

What went wrong. On the upload form, when the person chose "Other" under the style chips, the box for their own word sat right under
the chip row (the chips had only their own 8 px row gap), and the "Did you mean ..." card stuck to the box. The same shape is used by
the main instrument ("Add your own") and the language sheet ("Add a language").

The rule: an input that sits beside a group of tags (chips) is NOT closer than 16 to the tags above it and NOT closer than 16 to
anything below it (the "Did you mean" card, the next block). Its note about the weekly limit belongs to the input and sits 8 below it.

How it is built. One component, `OwnWord` (`components/kirtan/add/OwnWord.tsx`), draws the box, the note and the suggestion with a
16 gap; the caller puts the chips and `OwnWord` in a stack with `gap: TAG_INPUT_GAP` (16). Style, instrument and language all use it,
so a new "create your own tag" field (dance, mood ...) uses `OwnWord` and does not write its own `TextInput`.

How it is checked. `layoutRules.test.ts`, "Nothing overlaps and nothing sticks": `OwnWord` keeps 16 and 8, the style and
instrument fields use `OwnWord` inside a `TAG_INPUT_GAP` stack and have no bare `TextInput`, the language picker uses it.

## Nothing overlaps and nothing sticks (9 Nov 2026)

The general rule behind the two above: two neighbouring elements (a title and a close button, a close button and a search field,
a field and a note, a field and the button under it) are never closer than 16, and never overlap. A line of one text block and a
label with its own field are the exceptions (4 to 8, see "Space between blocks").

In a picker sheet (`SheetModal`, `ModalHeader`): the title and the close button are 16 apart and the title shrinks (`flex: 1`,
`minWidth: 0`) instead of running under the button; the header leaves 16 (`MODAL_HEADER_GAP_BELOW` in `lib/screenTop.ts`) before
the search field. The language picker, the song picker and every other sheet get it from the shared header, so a sheet does not
need its own number.

Checked at 390 px (a headless browser) on the language sheet, the style, instrument and language "own word" boxes.

### The walk through the upload screens (9 Nov 2026)

Every upload screen was opened at 390 px (a headless browser): the add form for each of the six types (Kiirtan, Bhajan, Prabhat
Samgiita, Spiritual song, Dance music, Baba's Audio Discourses) with a file chosen, the hub, the playlist steps, "My event
playlists", the chord offer. Found and fixed:

* Add form: "My event playlists" stuck to the playlist card above it (8): now 16 (`setStack`). The blocks of the page were 22
  apart (off the scale): 24. The type tiles and the queue cards were 10 apart: 12.
* Language box of a Bhajan, Dance or Baba audio: the text ("No language chosen yet") was squeezed to dots by the button beside
  it. The row now wraps, 12 and 8 apart.
* Label and field of the shared field (`KindFields`): 10 (off the scale), now 8; the file card's inner rows 6, now 8.
* Playlist screen (`upload-set.tsx`): 22, 14 and 10 off the scale, now 24, 16 and 12; "My event playlists" list the same.
* Chord offer: the moderation notice sat 12 above "Send for review" and the ticks 12 above the notice. Now 24 between the
  ticks and the notice, 16 between the notice and the button.
* Nothing was found against the main "Upload" button of the add form: the notice is 24 above it and its note 16 below.

The values are pinned by `layoutRules.test.ts` (the form files are on the scale and the stacks above keep their gaps).
