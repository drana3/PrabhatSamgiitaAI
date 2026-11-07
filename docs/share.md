# Sharing a song or a Kiirtan

Two things leave the app when someone shares: a link, and (since the share card) a picture. This page says what each one is today, how the picture is made, and what the server has to build so that the link itself shows a picture when it is pasted into a chat. The server part is not built; section 4 is the brief for it.

## 1. What was shared before the card

Investigated in `apps/mobile` (`lib/shareSong.ts`, `lib/webLinks.ts`, `lib/kirtan/share.ts`, `lib/playerV2/playerShare.ts`, `lib/playerV2/playerActionsIO.ts`, `components/player-v2/ShareSheet.tsx`, `components/kirtan/KirtanMenus.tsx`).

- A song: text and a link. The link is `https://www.prabhatasamgiita.org/songs/{n}?open=app`, the message is "PS n, title, performer" plus the link. It goes out through `Share.share` (the system sheet), through the https share links of WhatsApp, Telegram and Facebook, or "Copy link".
- A Kiirtan or Bhajan: title, artist and the website root. The website has no page per Kiirtan, so there is nothing more specific to link to.
- The share sheet draws a 9:16 poster carousel (colour, forest, night, photo) but only as a preview. It was never turned into a picture: `react-native-view-shot` was not a dependency, so the posters did not leave the phone. Instagram Stories, which needs a picture, received the link text.
- The link, when pasted, shows the website's generic preview (`/brand/share-icon.png`, `/brand/og-share.png` from `apps/web/app/layout.tsx`). `apps/web/app/songs/[number]/page.tsx` has no `generateMetadata`, so every song previews as the same picture with the same title.

## 2. What the app builds now: the share card

A picture of the song or Kiirtan, in two shapes, both 1080 px wide: portrait 1080 x 1350 (feed, WhatsApp status, Stories with a margin) and square 1080 x 1080.

Content, top to bottom:

- The ground. A song uses its stock photo, picked with the seed `ps-{n}` (the same call as the hero of the song page: `photoForSeed("ps-{n}", undefined, { size: "large" })`), so the card and the page show one photo. A Kiirtan uses `KiirtanCover`: the author's cover if there is one, otherwise its stock photo (seed = the Kiirtan id), otherwise the type gradient.
- Top left, in dark glass: the app mark (the app icon) and "Prabhat Samgiita".
- Bottom, on a scrim: the eyebrow (`PS 123`, or `Kiirtan · Artist` / `Bhajan · Artist`), the title in the display face, the performer (songs only) and, under a hairline, the short link line (`www.prabhatasamgiita.org/songs/123`; a Kiirtan prints only the website, because it has no page).
- The scrim is clear above about a third of the card, reaches 0.6 black where the text starts and 0.86 at the bottom edge. White on a white pixel under 0.6 black is 5.7:1, so the text passes 4.5:1 on any photo (`lib/share/card.ts`, tested).

Photo rules (`docs/photo-system.md`, section 2.4): the default picker is used, so a `close` or `children` photo is never chosen (`allowPeople` stays off) and a `lowRes` photo is never chosen. A test runs 600 seeds through the picker with the card's options and checks this. No face is the focus of a card by default. The photo credit stays in About and Credits (`STOCK_PHOTO_CREDITS`); the card carries no credit line. Note that `lib/photos/credits.ts` says a credit line is required for Ananda Marga photos and `docs/photo-system.md` lists "credit line in small type" for the share image; if the owner of the photos wants it on the picture, it is one more line in `components/share/SharePosterCard.tsx`.

How it is made and sent:

- `lib/share/card.ts` holds everything that can be computed (sizes, texts, seeds, scrim, file names, which buttons). `components/share/SharePosterCard.tsx` draws the card at its real 1080 px size.
- `components/share/ShareCardSheet.tsx` is a full-screen step. It draws the card at full size under the sheet (covered, but on screen so the capture is not blank), takes the picture as soon as the photo has loaded and again when the shape changes, and shows a smaller preview.
- `lib/share/cardCapture.ts` (native) uses `react-native-view-shot` and writes a PNG file; `lib/share/cardCapture.web.ts` uses the same library's html2canvas capture and returns a PNG data URI (the library's own `captureRef` calls `findNodeHandle`, which react-native-web does not have).
- `lib/share/cardIO.ts` sends it. Native: `expo-sharing` hands the file to the system sheet (Instagram, Messages, WhatsApp, Save Image are in it). Web: "Save image" downloads the PNG, "Copy link" copies the song link, and "Share image" appears where the browser can share a file (`navigator.canShare` with files).
- Entry points: the "Image card" tile in the player and song-page share sheet (`components/player-v2/ShareSheet.tsx`), Instagram Stories in the same sheet, and the "Image card" tile in the Kiirtan share sheet (`components/kirtan/KirtanMenus.tsx`).

Dependency added: `react-native-view-shot` 4.0.3 (the version Expo SDK 54 bundles; it brings `html2canvas` for the web). It has a native module, so a development build or EAS build is needed; Expo Go (SDK 54) includes it.

Not done, on purpose:

- A direct hand-off to Instagram Stories (`instagram-stories://share`) needs the Facebook App ID and the picture on the pasteboard, which takes a pasteboard module. Until then the system sheet of the card lists Instagram.
- Saving to the Photos app without the system sheet needs `expo-media-library`; the share sheet's own "Save Image" does it.
- Only the Roman title is drawn (the display face has no Devanagari). A song's title in the catalogue is Roman, so this holds today.
- A Kiirtan cover that lives on another origin can taint the browser canvas, so on the web the capture of such a cover fails and the sheet says so. Native has no such limit. The stock photos are local files and are not affected.

## 3. What needs a real device

The web preview shows the card, the PNG download and the copy; it cannot show the native capture or the system sheet. Check on a phone: the PNG is 1080 px wide whatever the screen density, the photo is not blank (the card is captured while it sits under the sheet), fonts are the display face and not a fallback, the system sheet lists Instagram and Save Image, and "Share image" works on iOS and Android. If a device captures a blank picture, the first thing to try is `renderInContext` in `captureRef` (iOS) or moving the capture view out from under the sheet into a full-size modal.

## 4. The server side: a picture for the link (not built)

Goal: when `https://www.prabhatasamgiita.org/songs/123` is pasted into WhatsApp, Telegram, Facebook, iMessage or Slack, the preview shows the song's card and its title, instead of the generic site picture. The in-app card is a 1080 px picture for people to post; the link preview is a 1200 x 630 picture that a chat app fetches by itself. They share the look and the rules, not the size.

URL and tags

- Image: `GET /share/song/{n}.png` returns a PNG of 1200 x 630 (optionally `?format=portrait|square` for 1080 x 1350 or 1080 x 1080, so the same route can serve the in-app card to a person who has no app). Unknown or unpublished `n`: 404, and the page falls back to the generic image.
- Page: add `generateMetadata` to `apps/web/app/songs/[number]/page.tsx` that sets `openGraph.title` = `PS {n} · {title}`, `openGraph.description` = the performer and "on Prabhat Samgiita", `openGraph.images` = `[{ url: "/share/song/{n}.png", width: 1200, height: 630, alt }]`, `twitter.card` = `summary_large_image`, `twitter.images` the same. `metadataBase` is already set in `app/layout.tsx`, so relative urls resolve. The `?open=app` query does not change the tags.
- A Kiirtan has no public page yet. Needed first: a public, read-only `GET /kiirtan/{id}` page (approved recordings only; no uploader name, no email) and `GET /share/kiirtan/{id}.png`, plus a record lookup in the API. Then `kirtanSharePayload` (`lib/kirtan/share.ts`) and `cardUrlLine` (`lib/share/card.ts`) switch from the website root to `/kiirtan/{id}`; both have a TODO.

What the image is

- The same card: the song's stock photo, the dark-glass mark, `PS {n}`, the title, the performer, the link line, on the same scrim. Layout numbers come from `lib/share/card.ts` (`cardLayout`, `cardTitleSize`, `cardScrimStops`), which is pure TypeScript with one type import; move it to `packages/core` so the app and the server read one copy instead of two.
- The photo is picked by the same function and seed as the app (`ps-{n}`, default rules: no children, no close faces, no low-resolution photo), so the preview, the in-app card and the song page's hero agree. The server therefore needs the photo catalogue: `apps/mobile/lib/photos/photoData.ts` (metadata and the picker in `pick.ts`, both pure) plus the image files. `docs/photo-system.md` names `lib/photos/photos.json` as the source of truth; whichever is used, it should be one file read by both. The FNV-1a hash in `hashSeed` must be reused as is, or two places will choose two photos.
- Text sits on the scrim only; no credit line unless the photo owner asks for one (see section 2).

Who builds it

- Web: a Next route handler `apps/web/app/share/song/[number]/route.tsx` with `ImageResponse` (`next/og`), the display and semibold faces loaded from `apps/web/public/fonts`, and the `generateMetadata` above.
- Cache: the picture only changes when the title, the performer or the photo catalogue changes, so `Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400`, and a `v` query (the catalogue version) in the og:image url when the catalogue changes. Chat apps cache previews for days on their own side, so a changed card shows only for links shared after that.
- API: for songs, nothing new (title and performer come from `fetchSong` / the local catalogue already used by the page). For Kiirtans, a public lookup by id.
- Mobile: nothing more, except to point `cardUrlLine` and `kirtanSharePayload` at the Kiirtan page when it exists.

Acceptance: pasting a song link into WhatsApp, Telegram and the Facebook Sharing Debugger shows that song's title and card; a Kiirtan link does the same only after the Kiirtan page exists; the image answers in under a second warm; no photo with `people` of `close` or `children` is ever served.
