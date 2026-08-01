# Backend user acceptance questions

This checklist maps realistic listener questions to public API behavior. It is executed by
`scripts/validate_backend_acceptance.py`; deployment also performs live Azure checks against the
same core contracts.

| User question | Endpoint | Expected answer |
| --- | --- | --- |
| Is the complete catalog available? | `GET /api/v1/health/readiness` | Exactly 5,018 packaged songs; database, song-vector, and canonical RAG-chunk-vector progress reported separately. |
| Show Prabhat Samgiita 111. | `GET /api/v1/songs/111` | Verified lyrics, meaning, canonical source, and available audio. |
| What is song 1 and what does it mean? | `GET /api/v1/songs/1` | Canonical text with English and available Hindi meaning. |
| Find song number 111. | `POST /api/v1/search` | Song 111 is the first exact-number result. |
| I remember “Bandhu He Niye Calo.” | `POST /api/v1/search` | Song 1 appears near the top. |
| Find a song about the fountain of effulgence. | `POST /api/v1/search` | Meaning search finds song 1 near the top. |
| Recommend songs for peaceful morning meditation. | `POST /api/v1/recommendations` | Distinct verified songs, ranked using available canonical metadata. |
| Recommend songs for Shravanii Purnima. | `POST /api/v1/recommendations` | Canonical Shravanii Purnima song 4954 ranks first. |
| Is official notation available for song 1? | `GET /api/v1/songs/1/notation/source` | Verified PDF/source link; machine transposition is only marked available when parsed notation exists. |
| Explain song 1 in Hindi. | `GET /api/v1/songs/1/localized?language=Hindi` | Grounded localization, with canonical fallback if the LLM is unavailable. |
| BOT, what is the central message of song 1? | `POST /api/v1/ai/explain` | Streamed answer with retrieved source labels. |
| Show song 6000. | `GET /api/v1/songs/6000` | `404 Song not found`; no invented song. |
| Show verified source resources. | `GET /api/v1/inventory?limit=25` | A bounded page of HTTPS source records. |

Live acceptance additionally checks Azure OpenAI output, PostgreSQL row counts, pgvector indexing
progress, external audio reachability, latency, and CORS behavior.
