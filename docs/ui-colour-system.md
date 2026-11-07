# UI colour system (mobile app)

Source of truth in code: `apps/mobile/constants/tokens/amColors.ts` (palette and `AmTheme` roles),
`amColorPairs.ts` (every allowed text/background pair with its minimum contrast, and the forbidden pairs),
`__tests__/colorPairs.test.ts` (computes WCAG contrast for each pair in Light and Dark; a token change that
breaks a pair fails the build). `node apps/mobile/scripts/colorAudit.mjs [out.md]` lists hardcoded colours and
risky pairs in the source.

## Proportions

- Neutrals (sand in Light, near-black in Dark) are about 80% of any screen.
- Forest green (sage800/900) only as deep tiles and panels, up to 10%.
- Orange is the ONE primary action fill, the selected chip/tab pill, and small accents, up to 10%.
  At most one orange-filled button per view.
- Orange is for interaction and now-playing, not decoration. Where a neutral works, use the neutral.

## Roles

| Role | Light | Dark |
| --- | --- | --- |
| Heading | ink800 #333333 | #F4F1EC |
| Body | ink600 #525252 | #A8A29A |
| Muted | ink500 #68635F | #948E86 (not on the `tile` fill #2E2A27: use body there) |
| Two-tone heading, second line (large text only) | headingSecond #77716B (4:1) | #948E86 |
| Action fill (`brand`) | orange700 #B94D0C | orange700 #B94D0C |
| Label on action fill (`onBrand`) | white (5.1:1) | white (5.1:1) |
| Pressed action fill (`brandPress`) | orange800 #8F3B08 | orange800 #8F3B08 |
| Accent / eyebrow text (`accentText`, `eyebrow`) | orange800 (6.2:1 on sand200, 7.5:1 on white) | orange500 #F67931 or gold300 #F5C253 |
| Bright orange (`accentBright`) | orange500 #F67931 | orange500 #F67931 |
| Error text (`dangerText`) | #B3150E (5.7:1 on sand200) | #FF7A74 |

ink400, ink300 and ink200 are never text colours. The themed `ink300` of the proto/song/songs/learn themes
is `headingSecond`; in the proto/song themes `orange700` is the accent TEXT role (orange800 in Light, gold300 in
Dark), the fill is `action`.

## Rules

1. White text only on deep fills (orange700/800, sage700/800/900). Dark text (ink800/ink900) only on light tints
   (peach #FFDCC5, tintGreen, olive100, sage200, gold300, sand). Nothing in between: mid-tone fills
   (orange300/500/600, gold500, olive mid tones) never carry text.
2. Bright orange500 is never a fill behind text and never text on light surfaces. Allowed: icons, progress and
   scrubber fill, equaliser bars, dots, focus rings, glows; and accent text on dark surfaces (5.2 to 6.9:1).
3. Accent text on tinted tiles is orange800 only.
4. Text over a photo always sits on a scrim: bottom gradient to rgba(0,0,0,0.72) behind text
   (`amScrimPhoto`), top scrim 0.45 to 0 for top-left labels (`amScrimPhotoTop`).
5. Chips and labels placed ON photos are neutral only: dark glass rgba(18,17,16,0.72) + white text, or a white
   chip + ink800 text (`amPhotoChip`). No green, orange, gold or other coloured chips over images. Coloured
   category chips are allowed on flat surfaces only.
6. Status: error text uses `dangerText` (4.5:1 or better), never `danger` (#EC221F, graphics and fills only);
   never colour alone for state (add an icon, a label or a weight change).
7. Selected chip or tab pill: orange700 + white. Some neutral chip rows in Light (profile sheets, Songs filter chips) use ink900 + white; both are allowed.

## Key contrast numbers

| Pair | Ratio |
| --- | --- |
| white on orange700 | 5.09 |
| white on orange800 | 7.51 |
| white on orange500 (forbidden) | 2.73 |
| ink900 on orange500 (banned by rule, passes numerically) | 6.1 |
| orange800 text on sand200 / white / peach | 6.23 / 7.51 / 5.83 |
| orange700 text on sand200 (forbidden) | 4.22 |
| ink500 on sand200 | 4.92 |
| ink400 on sand200 (was textMuted, forbidden) | 2.36 |
| dark muted #948E86 on inner / tile | 4.82 / 4.38 (tile forbidden) |
| orange500 on dark page | 6.91 |
| white on dark-glass chip over a white photo | 7+ |
