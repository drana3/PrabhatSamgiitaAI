# Backend user acceptance questions

This checklist maps realistic listener questions to public API behavior. It is executed by
`scripts/validate_backend_acceptance.py`; deployment also performs live Azure checks against the
same core contracts.

| User question | Endpoint | Expected answer |
| --- | --- | --- |
| Is the service alive? | `GET /api/v1/health/live` | A database-independent `ok` liveness response. |
| Is the complete catalog available? | `GET /api/v1/health/readiness` | Exactly 5,018 packaged songs; database, song-vector, and canonical RAG-chunk-vector progress reported separately. |
| Show the page containing songs 111 and 112. | `GET /api/v1/songs?limit=2&offset=110` | Bounded pagination returns exactly songs 111 and 112. |
| Show Prabhat Samgiita 111. | `GET /api/v1/songs/111` | Verified lyrics, meaning, canonical source, and available audio. |
| What is song 1 and what does it mean? | `GET /api/v1/songs/1` | Canonical text with English and available Hindi meaning. |
| Which songs are related to song 1? | `GET /api/v1/songs/1/related` | Related songs without repeating song 1. |
| Find song number 111. | `POST /api/v1/search` | Song 111 is the first exact-number result. |
| Find Prabhat Samgiita 111 using the full name. | `POST /api/v1/search` | Full-name number parsing returns verified song 111 first. |
| Explain Prabhat Samgiita 223. | `POST /api/v1/search` | Natural-language number intent returns only song 223 before fuzzy or vector retrieval. |
| I remember “Bandhu He Niye Calo.” | `POST /api/v1/search` | Song 1 appears near the top. |
| Find a song about the fountain of effulgence. | `POST /api/v1/search` | Meaning search finds song 1 near the top. |
| Find Bandhu He with a verified video. | `GET /api/v1/search?q=Bandhu%20He&has_video=true` | Rich search returns song 1 and non-zero video availability. |
| Recommend songs for peaceful morning meditation. | `POST /api/v1/recommendations` | Distinct verified songs, ranked using available canonical metadata. |
| Recommend songs for Shravanii Purnima. | `POST /api/v1/recommendations` | Canonical Shravanii Purnima song 4954 ranks first. |
| What should I listen to on Bábá's birthday? | `GET /api/v1/recommendations/today?timezone=Asia%2FKolkata&date=2026-05-21` | Reviewed fixed observance, local context, three verified recommendations, reasons, and disclaimer. |
| What should I listen to on Shrávanii Purnimá 2026? | `GET /api/v1/recommendations/today?timezone=Asia%2FKolkata&date=2026-08-28` | The reviewed 2026 festival is the primary sourced signal; no lunar date is guessed for another year. |
| Which occasions can I browse? | `GET /api/v1/occasions` | Reviewed choices including Dharma Cakra. |
| Which festivals have canonical mappings? | `GET /api/v1/festivals` | Festival names, song counts, verification status, and source URLs. |
| Is official notation available for song 1? | `GET /api/v1/songs/1/notation/source` | Verified PDF/source link; machine transposition is only marked available when parsed notation exists. |
| Transpose expert-verified song 4961 to D. | `GET /api/v1/songs/4961/notation?scale=D&system=sargam` | Expert-curated sheet is transposed and labelled `expert_verified`. |
| Play the verified YouTube performance for song 1. | `GET /api/v1/songs/1/media?media_type=video&platform=youtube` | Privacy-enhanced embed from the allow-listed AMPS channel, with community-source status. |
| Play song 1112, which is absent from the official audio archive. | `GET /api/v1/songs/1112/media?media_type=audio` | Number-matched community audio link with `community`, `link_only`, and `unverified` labels. |
| Are there multiple video renditions of song 2635? | `GET /api/v1/songs/2635/media?media_type=video` | Both distinct videos remain associated with canonical song number 2635. |
| Explain song 1 in Hindi. | `GET /api/v1/songs/1/localized?language=Hindi` | Grounded localization, with canonical fallback if the LLM is unavailable. |
| BOT, what is the central message of song 1? | `POST /api/v1/ai/explain` | Streamed answer with retrieved source labels. |
| Show song 6000. | `GET /api/v1/songs/6000` | `404 Song not found`; no invented song. |
| Show verified source resources. | `GET /api/v1/inventory?limit=25` | A bounded page of HTTPS source records. |
| Report a broken media link. | `POST /api/v1/reports` | A bounded anonymous report is queued for human review. |

Live acceptance additionally checks Azure OpenAI output, PostgreSQL row counts, pgvector indexing
progress, external audio reachability, latency, and CORS behavior.
