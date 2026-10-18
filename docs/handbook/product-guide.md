# Prabhat Samgiita AI — Product Guide

A guide to what Prabhat Samgiita AI is, why it matters, and how to use the website and mobile app.

---

## What is Prabhat Samgiita?

**Prabhat Samgiita** (“Songs of the New Dawn”) is a collection of **5,018 songs** composed by **Shrii Shrii Anandamurti ji** between 14 September 1982 and 20 October 1990. The songs span devotion, mysticism, humanism, nature, collective welfare, and spiritual practice.

**Prabhat Samgiita AI** is a digital companion that helps devotees and learners:

- **Find** songs by number, opening line, theme, mood, or natural language
- **Listen** to verified recordings where available
- **Understand** meaning and context grounded in canonical sources
- **Practise** melody on harmonium with notation and a private practice coach
- **Explore** stories, daily recommendations, quizzes, and member features

The platform never invents lyrics, meanings, or notation. Missing source material is shown honestly rather than filled in with guesses.

---

## Why this platform matters

| Need | How the platform helps |
|------|-------------------------|
| **Discovery** | Search 5,018 songs by feeling, festival, language, or spoken query — not only by number |
| **Trust** | Content is tied to official and verified sources; AI answers cite retrieved passages |
| **Learning** | Per-line sargam, harmonium keys, warm-up guides, and on-device practice feedback |
| **Daily sadhana** | Today’s recommendations, reflections, and observance-aware song picks |
| **Accessibility** | Web, installable PWA, and native mobile app (Android sideload / iOS simulator) |
| **Multilingual use** | AI-assisted translations and explanations in many languages when configured |

---

## Platform overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Prabhat Samgiita AI                       │
├──────────────┬──────────────────────┬───────────────────────┤
│   Website    │   Mobile app         │   Progressive Web App │
│   (Next.js)  │   (Expo / Android)   │   (Add to Home Screen)│
└──────┬───────┴──────────┬───────────┴───────────┬───────────┘
       │                  │                       │
       └──────────────────┼───────────────────────┘
                          ▼
              ┌───────────────────────┐
              │   API (FastAPI)       │
              │   Search · RAG · AI   │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │ PostgreSQL + pgvector │
              │ 5,018 songs · media   │
              └───────────────────────┘
```

**Live production URLs**

- Website: `https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io`
- API: `https://prabhatai-api.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io`

---

## Main features

### Home

- Hero search — ask by song number, feeling, or theme
- **Music for this moment** — today’s recommendations (festivals, observances, context)
- **Daily reflection** — verified quote from Ánanda Sútram and related sources
- **About** — introduction to Prabhat Samgiita and ways to explore (Listen, Understand, Practise)

### Explore

- Search by song number, opening words, or natural language
- **70 special collections** — languages, themes, festivals, PROUT, AMURT, and more
- Voice search (browser speech recognition) on supported devices
- Verified result counts and a clear “no match” state when nothing fits

### Song page

Each song page is a complete learning journey:

| Section | What you get |
|---------|----------------|
| **Lyrics** | Original / transliteration text; multiple recordings when available |
| **Meaning** | English meaning; optional AI translation into 30+ languages |
| **Harmonium** | Per-line sargam, harmonium keys, warm-up guide, slow preview |
| **Practice coach** | Record your singing; melody + lyrics alignment feedback (on-device) |
| **AI Companion** | Grounded Q&A about meaning, imagery, context, pronunciation |
| **Listen / Watch** | Verified audio and YouTube embeds |
| **Related songs** | Thematically linked catalog entries |

### AI Companion

- Ask in **English, Hindi (Roman or Devanagari), or other languages**
- Answers are **grounded in the song’s canonical text**, not invented
- Remembers recent conversation within a session
- Guest: 15 deeper AI questions per day; signed-in members: 50 per day
- Blocks nonsense, spam, and off-topic prompts before they reach the AI

### Stories

- Inspirational stories connected to Prabhat Samgiita themes
- Links back to related songs

### Quiz

- Sign-in required
- Tests knowledge of Prabhat Samgiita and the app

### Member account (optional)

When Microsoft sign-in is enabled:

- Save favourite songs
- Practice history and personalised AI context
- Quiz certificates
- Audio download where rights allow

### Mobile app

- **Android:** Install APK shared from GitHub Actions or Expo (no Play Store fee required for sideload)
- **iPhone/iPad (free):** Safari → open website → **Add to Home Screen** (PWA)
- **iPhone native (paid Apple Developer):** TestFlight / internal build via EAS

Screens: Home, Explore, Stories, Account, Song detail, Story reader.

---

## How to use — step by step

### Find a song

1. Open **Home** or **Explore**
2. Type a song number (`1`, `223`, `5018`), opening words (`Tomar Katha`), or a feeling (`morning meditation`)
3. Tap **Search**
4. Open a result to reach the full song page

**Tips**

- Song numbers must be between **1 and 5,018**
- Voice search works on Explore in Chrome, Edge, and Safari
- Collection links (e.g. “Hindi only”, “English 3”) open pre-filtered Explore searches

### Listen and read

1. On a song page, scroll to **Lyrics** or use **Read & Listen**
2. Use the audio player for verified recordings
3. Open **Watch** for YouTube performances when available

### Understand meaning

1. Scroll to **Meaning**
2. Read the English meaning (always shown when available)
3. Use **AI translate** dropdown to request Hindi or another language
4. Or open **AI Companion** and ask: *“Explain the meaning line by line”*

### Practise on harmonium

1. On a song with notation, open **Harmonium** (or go to `#notation`)
2. Expand **Practise on harmonium**
3. Choose a mode:
   - **सारगम + keys** — lyric, sargam, and keys per line
   - **Keys only** — keyboard layout per line
   - **Warm-up guide** — aroha, avaroha, beginner alankar
4. Change **Your Sa** if you need a different tonic
5. Tap **Hear slowly** on any line for a slow preview

### Use the practice coach

1. In the harmonium section, find **Sing, listen, improve**
2. Tap **● Record practice** (or **Choose audio file**)
3. Sing one clear phrase (10–30 seconds)
4. Tap **Stop and analyse**

You receive:

- **Melody alignment %** — compared to song notation (on-device)
- **Lyrics alignment %** — compared to lyric lines (live recording in supported browsers)
- Suggestions for what to improve next

**Privacy:** Analysis runs on your device. Recordings are **not uploaded or stored** on the server.

### Ask the AI Companion

1. On any song page, scroll to **Know more about this song**
2. Type a question or tap a suggested prompt
3. Read the streamed answer with source-grounded citations

**Example questions**

- “What is this song about?”
- “Explain the meaning line by line”
- “is gaane ka arth pyar ke sandarbh mein batao” (Romanized Hindi)

### Install on phone

**Android (APK)**

1. Download the latest APK from GitHub Actions artifact `prabhat-samgiita-ai-android-preview` or Expo builds
2. Enable **Install unknown apps** for your browser or Files app
3. Open the APK and install

**iPhone / iPad (PWA — free)**

1. Open the website in **Safari**
2. Tap **Share** → **Add to Home Screen**
3. Launch from the home screen icon

---

## Who is it for?

| User | Typical journey |
|------|------------------|
| **New learner** | Home → Song 1 → Listen → Meaning → AI “explain line by line” |
| **Daily practitioner** | Home → Today’s recommendations → Favourite songs |
| **Harmonium student** | Song page → Harmonium → Practice coach |
| **Researcher / teacher** | Explore collections → Stories → Verified source links |
| **Multilingual devotee** | Meaning translation or AI Companion in preferred language |

---

## What the platform does not do

- Does **not** replace official Prabhat Samgiita publications or live acarya guidance
- Does **not** download or re-host third-party audio/video (plays/embeds from source URLs)
- Does **not** guarantee perfect speech-to-text for lyrics practice (browser-dependent)
- Does **not** invent missing notation or meanings

---

## Getting help

- **Search returns nothing:** Try a song number, opening words, or a collection from Explore
- **AI unavailable:** Daily quota may be reached; catalog search and meanings still work
- **Microphone blocked:** Allow mic in browser settings, or upload a short audio file instead
- **App cannot reach songs:** Check network; mobile builds need the production API URL (not `localhost`)

For technical setup and deployment, see [Technical Design](./technical-design.md).

For sideload and PWA install details, see [Offline Distribution](../offline-distribution.md).
