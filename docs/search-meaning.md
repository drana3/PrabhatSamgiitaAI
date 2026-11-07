# Search by meaning: what exists, what is missing

Status of the investigation on 2026-11-05. Read from the code in this repo and from real requests to the
production API through the local CORS proxy (`http://localhost:8100/api/v1`). No backend code was changed.

## What exists

Backend (`apps/api`)

- Song and chunk embeddings exist in production. `GET /api/v1/health/ready` reports
  `embedded_songs: 5018`, `embedded_chunks: 15292`, `vector_index_ready: true`, `embedding_provider_configured: true`.
- The vectors live in an in-memory FAISS index (`app/services/faiss_store.py`, built by
  `app/services/embedding_index.py`, loaded at start-up from `FAISS_INDEX_DIR` or downloaded from
  `FAISS_INDEX_URL`). Migration `0017_drop_pgvector_embeddings` dropped the pgvector columns. ADR 002
  ("PostgreSQL + pgvector") is out of date.
- The semantic path is `POST /api/v1/search` with `{"query": "...", "mode": "semantic"}`
  (`HybridSearchService.search`, `app/services/search.py`). It expands the query (local synonym table,
  plus an LLM rewrite for long or "feeling" phrasing), embeds it with the configured provider, ranks songs
  and RAG chunks in FAISS, and fuses the lists with reciprocal rank fusion. Items then carry
  `matched_by: ["vector", "rag_chunk", ...]`.
- That path is behind `require_member_identity`: it needs the `x-member-proxy-key` header (a server secret)
  and an `x-ms-client-principal` header, i.e. a signed-in member. The website adds both in
  `apps/web/app/api/search/route.ts`.

Everything else is lexical. `GET /api/v1/search?q=` (the "rich" endpoint) and `POST ... "mode": "catalog"`
never embed the query. They run opening-line, full-text and trigram matching only.

Mobile (`apps/mobile`)

- `app/search-v2.tsx` asks for meaning results when `UnifiedResult.wantsMeaning` is true (a feeling word, a
  question, or no local lyric hit): `api.searchSongs(q, { mode: "semantic" })`, debounced 450 ms,
  aborted when typing continues. The rows are merged into the "Matches by meaning" group by
  `mergeMeaningRows` (`lib/unifiedSearch.ts`). A failed request keeps the local results silently.
- Locally, feeling words and the lyric index already give instant "Matches by meaning" rows
  (`lib/unifiedSearch.ts`, `lib/lyricSearch.ts`), so the group is not empty while the server answers.

## What I measured

| Query | Endpoint | Result |
| --- | --- | --- |
| "longing for the beloved in the night" | GET rich | `detected_intent: semantic_search`, `matched_by` only `full_text`, `trigram`, `verified`; top scores 0.28, 0.27, then 0.03 and below |
| "peace of mind" | GET rich | same labels; top three are 1.52 (a title boost), then 0.28 |
| "тоска по Возлюбленному" | GET rich | all scores about 0.026, labels `full_text`/`trigram`; the Cyrillic query shares no tokens with the song text, so these are noise |
| "longing for the beloved in the night" | POST `mode: semantic` | HTTP 401 `Member proxy authentication failed` (no member key) |
| same | POST `mode: catalog` | the same lexical list as GET |

Reading of this:

1. The `detected_intent: "semantic_search"` label is only the default intent name from `detect_intent`. It
   does not mean vectors were used. The rich endpoint cannot use them.
2. The tiny scores are reciprocal-rank-fusion values (about 1/(60+rank)), not similarities. They say nothing
   about relevance. The Russian results are lexical coincidences and are not meaningful.
3. So the single test showing only `full_text/trigram/verified` is expected: it hit the lexical endpoint.
   It does not show that embeddings are missing.

## What I could not verify

- Whether semantic results are good. I have no member key, so I could not get a single `matched_by: ["vector"]`
  response, and I did not try to obtain one. The quality of the FAISS ranking, of the Russian queries, and of
  the LLM query rewrite is untested.
- How many of the 5,018 songs have `english_meaning`. The two songs I read (3 and 869) have it. Songs without
  a translation are embedded from romanised Bengali only and will match meaning queries poorly.
- Whether a shipped iOS/Android build carries `EXPO_PUBLIC_MEMBER_PROXY_KEY`. Without it the app sends no
  member headers and every semantic call is a 401.
- The web preview (`npm run web`) sets `EXPO_PUBLIC_MEMBER_PROXY_KEY` nowhere and `MOCKUP_DATA=1`, which also
  skips the server call. In the preview the "Matches by meaning" rows are the local sample only.

## Mobile behaviour after this change

- A guest, or a build without the member key, no longer sends a request that is certain to fail. The group
  keeps its local rows and a quiet line says "Sign in to also search songs by meaning."
- While the server works, the line reads "Searching by meaning…". Offline or a failed call keeps the local
  results with no message.
- Signed-in members get server rows merged into "Matches by meaning" as before.

## What would be needed (backend, not done)

1. Let guests use it, within a quota. The member proxy key is a server secret and must not ship in the app
   bundle (`EXPO_PUBLIC_*` values are readable). Options: a separate `GET /search/meaning?q=` with its own
   per-IP / per-device quota (`require_public_quota`), or a signed short-lived device token.
2. A query-embedding cache and a cheap path. Today one request does an LLM rewrite (hint words or more than
   8 words) plus an embedding call. Cache embeddings by normalised query; skip the rewrite for short queries.
3. Return similarity, not only a fused score. `_vector_rank` discards the FAISS score. Expose
   `similarity` per item so the client can cut weak matches and show "close" vs "possible".
4. Hybrid ranking that keeps lexical evidence. When vectors answer, semantic mode drops full-text and trigram
   lists and keeps only the opening-line list. Use weighted RRF (vector and chunk lists weight 1, lexical 0.5,
   exact opening line first), plus a minimum similarity threshold.
5. Multilingual queries. A Russian or Hindi query needs the embedding model, not the lexical lists, to carry
   the match. Embed the original query and its English translation (one LLM call, cached), and fuse both.
6. Embedding coverage and freshness. Add `english_meaning` coverage to `/health/ready`, embed
   `central_idea` and `english_meaning` as their own chunk type, and re-embed a song when its text changes.
   The job today runs inside the API process at start-up (64 songs per batch, 7 s throttle); move it to a
   separate worker and publish the FAISS snapshot to `FAISS_INDEX_URL` so containers do not rebuild.
7. An evaluation set before tuning anything: about 40 queries (English, Russian, Hindi) with the songs a
   reviewer expects, run against `catalog` and `semantic`, reporting recall at 5 and 10.
8. Update ADR 002 to say FAISS, not pgvector.
