# Prabhat Samgiita AI — Mobile App Plan (iOS + Android)

## Vision

A calm, devotional companion app that feels like the web experience but is **built for thumbs, ears, and daily practice** — not a shrunken website. Hindi-first learners should feel at home: Devanagari sargam, bilingual labels, and large readable lyric blocks.

## Recommended architecture

| Phase | Approach | Outcome |
|-------|----------|---------|
| **Now** | Expo app (`apps/mobile`) + shared `@prabhat/core` | Native shell, store-ready scaffold |
| **Next** | MSAL mobile auth + FastAPI Bearer tokens | Quiz, favorites, chat memory on native |
| **Later** | Offline song/story cache, native harmonium audio | Full parity without network |

The FastAPI backend is already mobile-ready for public content. Member features currently depend on Azure Easy Auth (web-only) — mobile auth is the main Phase 2 blocker.

## Information architecture

Bottom tabs (always visible):

```
Home · Explore · Stories · Account
```

Stack screens (push navigation):

```
Song/{number}     — Lyrics · Meaning · Ask AI · Harmonium
Story/{slug}      — Reader
Quiz              — Member certification (Phase 2)
Sign in           — Microsoft Entra (Phase 2)
```

## UX principles

1. **One primary action per screen** — search on Explore, listen on Song, read on Stories.
2. **Lyric-first song view** — large serif text, audio sticky at bottom (mini player pattern from web).
3. **Line-mapped harmonium** — each lyric line shows Devanagari sargam + keys (reuse `sargam-display` logic).
4. **AI as companion tab** — not a chatbot wall; grounded prompts, Hindi/Roman input, streaming answers.
5. **Trust labels** — verified source badges, practice-draft notation warnings (same as web).
6. **Safe areas & thumb zone** — tab bar, FAB/search, primary CTAs in lower half on large phones.

## Screen designs

### Home

- Dawn hero gradient (navy → gold), emblem lockup
- Prominent search bar → Explore with query
- “Today’s reflection” card
- 3 song recommendations (horizontal scroll)
- Featured inspiration story teaser
- Quick link: Song 1, Harmonium warm-up

### Explore

- Sticky search (number, line, meaning, natural language)
- Filter chips: verified, has video, has audio
- Song cards: number badge, title, first line, theme pill
- Empty/error states with guidance (reuse query-guard copy)

### Song detail

Segmented control:

| Tab | Content |
|-----|---------|
| **Lyrics** | Original + transliteration toggle, listen button |
| **Meaning** | English / Hindi segmented |
| **Ask AI** | Streaming companion, suggested prompts |
| **Harmonium** | Per-line sargam strips, Sa picker, hear slowly |

Sticky bottom bar: ♪ Listen · ♬ Notation · ✦ Ask

### Stories

- Card list: title, author, teaser, linked song numbers
- Reader: comfortable line length, source attribution, related songs

### Account

- Sign-in status (Phase 2)
- Saved songs playlist
- Quiz certifications
- App settings: language preference, Sa default for harmonium

## Visual design system (native)

Mapped from web Tailwind tokens (`apps/web/tailwind.config.ts`):

| Token | Value | Usage |
|-------|-------|-------|
| navy.950 | `#092d56` | Headers, tab bar |
| gold.500 | `#ca8a27` | Accents, active tab |
| ivory.50 | `#fffdf8` | Screen background |
| Serif | Cormorant Garamond | Song titles, hero |
| Sans | Manrope | Body, UI chrome |

Components to build natively (Phase 1 scaffold included):

- `SongCard`, `SearchField`, `SectionHeader`, `PrimaryButton`, `Badge`
- `SargamLineCard` (port from harmonium practice UX)
- `ChatBubble` + streaming text (Phase 1 basic)

## Technical layout

```
packages/core/          Shared API client, Zod schemas, query guard
apps/mobile/            Expo + Expo Router (iOS + Android)
apps/web/               Existing Next.js (unchanged)
apps/api/               FastAPI (add Bearer auth in Phase 2)
```

Environment:

```
EXPO_PUBLIC_API_BASE_URL=https://<api-host>
EXPO_PUBLIC_WEB_BASE_URL=https://<web-host>   # optional deep links
```

## Store checklist

- [ ] App icons from `apps/web/public/brand/prabhat-samgiita-emblem.png`
- [ ] Splash: navy background + gold emblem
- [ ] Privacy policy URL (web)
- [ ] Microphone usage string (harmonium practice coach)
- [ ] EAS Build profiles (`eas.json`) for TestFlight + Play Internal

## What ships in this repo today

- `docs/mobile-app-plan.md` (this file)
- `packages/core` — portable API layer
- `apps/mobile` — Expo Router app with Home, Explore, Stories, Account, Song, Story screens
- `apps/web/public/manifest.webmanifest` — installable web baseline

Run the mobile app:

```bash
npm install
npm run mobile
```

Then press `i` (iOS simulator) or `a` (Android emulator) in the Expo CLI.
