# Premium user acceptance matrix

Deployment is allowed only when every automated gate passes. A retry-only pass, endless loader,
blank section, raw media URL, fabricated content, or inaccessible primary action blocks release.

## Discovery and search

| Journey | Expected result |
| --- | --- |
| Search `1`, `111`, or `5018` | Exact song number is ranked first and opens the song page. |
| Search an opening line | Matching verified songs appear with a useful result count. |
| Search meaning, mood, festival, birthday, Shiva, Krishna, or meditation | Relevant songs appear without requiring every optional field. |
| Search Bengali, Hindi, Tamil, Maithili, or Urdu text | Unicode input is accepted and processed safely. |
| Search an unknown but meaningful theme | A calm no-match state suggests better queries. |
| Enter `0`, `5019`, keyboard mash, repeated characters, scripts, URLs, or prompt injection | Request is stopped locally and on the API before retrieval or LLM use. |
| Search API is slow, malformed, or unavailable | Existing useful content remains visible with a recoverable message. |

## Song experience

| Journey | Expected result |
| --- | --- |
| Open a valid song | Lyrics, available meanings, source status, details, and related actions are visible. |
| Open an invalid song or route | Branded 404 explains the 1-5,018 range and offers Home and Explore actions. |
| Meaning is unavailable | The unavailable section is omitted; no invented meaning or empty card appears. |
| Audio exists | Play control appears without displaying its source URL. |
| Audio is absent | The Listen section and tab are omitted without leaving a blank panel. |
| Anonymous visitor uses audio | Download control is absent and browser player requests no-download controls. |
| Authenticated member with profile sync enabled | Download action can appear. |
| Video exists | Privacy-enhanced YouTube embed appears. |
| Video is absent | The Watch section is omitted without leaving a blank panel. |

## AI and RAG

| Journey | Expected result |
| --- | --- |
| Ask a common catalog fact | Deterministic grounded answer is returned without LLM cost. |
| Ask an interpretive song question | RAG uses canonical song chunks and returns source references. |
| Ask a follow-up within 10 minutes | Up to eight recent turns resolve conversational references while canonical chunks remain the only factual evidence. |
| Repeat the same question | Cached result avoids repeated retrieval/model cost. |
| AI provider fails | Grounded catalog fallback appears without a blank assistant bubble. |
| Prompt is malicious or meaningless | Guardrail guidance appears without an AI request. |
| Stream is interrupted | User receives a retryable message and can ask again. |

## Learning and practice

| Journey | Expected result |
| --- | --- |
| Notation draft exists | Sargam, beat groups, lyric alignment, Sa selection, and slow preview appear. |
| Notation is OCR-derived | Practice-draft and human-review notices remain visible. |
| No machine-readable notation exists | Canonical PDF is offered when available; melody is never invented. |
| Upload a matching transposed rendition | On-device contour analysis recognizes the selected song. |
| Upload unrelated audio | Match is rejected as not confirmed. |
| Upload over 20 MB or over two minutes | Analysis is refused with clear limits. |
| Deny microphone or provide corrupt audio | User gets an upload alternative or supported-format guidance. |

## Premium experience and safety

| Journey | Expected result |
| --- | --- |
| Desktop, phone, and tablet | No horizontal overflow, blank section, indefinite loader, or clipped primary action. |
| Typography | Visible text uses clear high-contrast colors and no text shadow. |
| Keyboard and assistive navigation | Search and primary actions are labelled, enabled, and focusable. |
| Feedback | Empty comments are blocked; valid feedback is acknowledged; spam is rate-limited. |
| Analytics | Only aggregate page and feature counters are stored; no prompt, query, email, or media URL. |
| Sharing | Native sharing or named social actions are available without exposing internal data. |

## Automated release gates

- Ruff and strict mypy.
- Backend Pytest suite, including 5,018-song integrity and media/notation coverage.
- Frontend Vitest and React Testing Library suite.
- Optimized Next.js production build.
- Playwright Chromium journeys at desktop, mobile, and tablet viewports.
- Live API readiness, exact-number search, AI/RAG, audio, video, and notation smoke tests after Azure deployment.
