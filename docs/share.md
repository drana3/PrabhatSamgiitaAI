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

## 5. Author page preview

Built (2026-11-09, branch `redesign/v2`). Variant 1 of the board «автор-превью-шеринга», "like the song". Dada's decisions: no site name (`prabhatasamgiita.org`) at the top or the bottom, the author's photo when there is one, no number of listeners, nothing at the bottom, English captions, a 9:16 shape for stories.

What the picture is

- A warm stock photo with nobody in it behind everything, a black scrim under the text (0.6 where the text starts, 0.88 at the bottom edge, so ivory text keeps 4.5:1 on any photo), the author's round photo or, without one, a round placeholder with initials, a gold hairline, a small line `Singer · Warsaw, Poland` (or `Group · Spain`), the name in capitals, the kinds of recordings (`Kiirtan · Bhajan`).
- The photo is one of eight (`AUTHOR_CARD_PHOTOS`, the app's photo numbers 10, 12, 14, 15, 16, 24, 25, 35), picked by the FNV-1a hash of the page id. The website (`apps/web/lib/author-card.ts`) and the app (`apps/mobile/lib/share/card.ts`) hold the same list and the same hash, so a page's card in the app and its link preview show one photo. A test in the app (`__tests__/authorShareCard.test.ts`) reads the web file and fails if the list, the placeholders or the picked photo drift apart.
- Nothing about statistics is read. The card takes the name, type, city, country, kinds and photo only, so a page that hides its numbers cannot leak them through its picture.
- Shapes: link preview 1200 × 630 (1.91:1), story 1080 × 1920 (9:16; text kept inside the middle 1250 px, 335 px free above and below because Instagram draws over them), square 1080 × 1080. The app also has portrait 1080 × 1350 beside the song card's two shapes.

The website

- `GET /share/author/<page id or address>` (`apps/web/app/share/author/[id]/route.tsx`, `next/og`) answers the link preview; `?format=story` and `?format=square` the other two. 404 for a page that is not published (the page then falls back to the site's own image). Cache `public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400`; the address of the picture carries `v=<updated_at>` so a changed page shows a new picture in chats.
- `generateMetadata` of `/author/[slug]` always points `openGraph.images` (1200 × 630, alt = the display name) and `twitter` (`summary_large_image`) at this picture, with or without a photo. Before, only a page with a photo had an image.
- Fonts: Gloock (name) and DM Mono (small lines), both OFL, files in `apps/web/public/fonts` (TTF: the renderer reads no woff2). Stock photos in `apps/web/public/share/bg/<n>.jpg`.
- Limits of the renderer: only JPEG and PNG author photos can be drawn (a webp photo falls back to the initials), and a name in a script the two fonts do not cover (Devanagari, Cyrillic, ...) is drawn as `Author page` with an empty round placeholder. The pictures weigh 0.5–1.7 MB as PNG; if WhatsApp refuses one, downscale the background (`public/share/bg`) or the shape.

Sharing without the page link

- While `SHOW_PAGE_LINK` is `false` the shared link is `https://<site>/author/<page id>`; once the page link is offered again it is `/author/<slug>` (`authorShareKey` in `apps/mobile/lib/authors/constants.ts`). A server too old to send the id leaves the address.
- API: the public `GET /authors/{slug_or_id}` family accepts the page id (36 characters; a slug is at most 30, so the two never collide) and answers the same page; `AuthorProfilePublic` carries `id`. Only a published page answers by id, a draft or an unknown id is 404. The page `/author/<id>` renders and names the slug as its canonical address, and the app opens it as the page, not as a "moved" address.
- A link by id survives a change of address, which a link by address does not after the hold period.

The app

- The Share button of an author page (and of the author's own page, `my-author`) opens a sheet with three rows: `Image card`, `Share link`, `Copy link` (`components/authors/AuthorShareSheet.tsx`). `Share link` hands the system share sheet "Listen to {name} on Prabhat Samgiita:" and the link; on the web preview it copies.
- `Image card` opens the same full-screen card step as a song (`ShareCardSheet`), with `AuthorPosterCard` instead of the song's poster and a third shape, `Story`. Native shares the PNG through the system sheet (Save Image and Instagram are in it); the web saves a download. Pure rules (texts, photo, layout, scrim, file name) are in `lib/share/card.ts`, the subject builder in `lib/authors/shareCard.ts`.
- Strings: `locales/shareCard.ts` (`shareCard.story`, `authorShare.link`, `authorShare.note`), read through `useShareCardT`, as the song card's.

Not checked

- Messengers (WhatsApp, Telegram, Facebook Sharing Debugger, Instagram): the preview needs a public address. Acceptance: paste `https://<site>/author/<page id>` into each; the card shows, with no site name, no numbers.
- A phone: view-shot capture of an author's remote photo, the system share sheet and Save Image.
