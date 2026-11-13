# The colleagues' PS recordings (Gunavati): how they play

Decision of Dada, 13 November 2026: the 69 recordings from the zip of 11 November play in the app. The singer of every
file is **Gunavati**. (The ten files of the Drive folder "Didi Sushraddha" were removed on 11 November, sung incorrectly;
they are not here.)

## The chain

1. **Files.** In the private Cloudflare R2 bucket `am-site-books-private`, key `audio-extractor/ps-audio/<number> <English title>.<ext>`
   (list with sizes and SHA-256: `data/curated/ps_colleagues/audio.json`). The bucket stays private.
2. **Catalogue rows.** One `media` row per file: `kind audio`, `provider ps_colleagues`, `verification_status verified`,
   `title` the song's own title as the catalogue has it (`songs.title`, for example `BANDHU HE NIYE CALO`), `url`
   `<API>/api/v1/ps-audio/<file name>`, and in `metadata_json`: `performer` "Gunavati", `source_status` "verified",
   `is_current` and `is_primary` true, `r2_key`, `r2_bucket`, `bytes`, `sha256`. Written by
   `apps/api/scripts/import_colleague_ps_audio.py` (dry run by default, insert only; the old archive links of the songs stay).
3. **Ranking.** `source_status verified` plus `is_primary` puts the row first among the song's audio (the old links follow), so
   the API marks it `is_latest` and the phone plays it by default. The API passes `performer` in `GET /songs/{n}` and
   `/songs/{n}/media`.
4. **Playing.** `GET /api/v1/ps-audio/{file}` (`apps/api/app/api/v1/ps_audio.py`) answers `302` to a signed R2 link valid for
   `PS_AUDIO_LINK_SECONDS` (3600). It serves only a file that a `media` row names (`metadata_json.r2_key`), so the rest of
   the bucket (books of other projects) cannot be reached through it. HEAD is signed as HEAD. No audio passes through the API.
5. **Phone.** `listPlayableAudio` carries `performer` and lists the API's current recording first, so it is the song's default audio:
   the Play button of the song page and the Player start it. The Player's version line and chip, the song page's version
   picker and the lock screen say `Voice · Gunavati` (the archive's own files keep being named by their title). Downloads for
   offline follow the redirect like any other URL.

## Settings (server, never in the repository)

| name | what |
| --- | --- |
| `PS_AUDIO_S3_BUCKET` | `am-site-books-private` (default) |
| `PS_AUDIO_S3_ENDPOINT`, `PS_AUDIO_S3_ACCESS_KEY_ID`, `PS_AUDIO_S3_SECRET_ACCESS_KEY` | an R2 API token that can **read** this bucket; when empty, the `RECORDING_S3_*` values are used (the same Cloudflare token must then be allowed on this bucket too) |
| `PS_AUDIO_LINK_SECONDS` | link lifetime, 60 to 86400, default 3600 |

Without keys the route answers `503` and the song simply has the recording that does not play; the old archive links
are unaffected.

## What has to be done on the server (by whoever holds the keys), in this order

1. **Deploy the API** from this branch (the route and the `performer` field). Not done by the session that wrote this.
2. **Set the three `PS_AUDIO_S3_*` values** (or confirm that the `RECORDING_S3_*` token can read `am-site-books-private`) on the API
   container app.
3. **Check the bucket (read only):**
   ```bash
   cd apps/api
   DATABASE_URL=... PS_AUDIO_S3_ENDPOINT=... PS_AUDIO_S3_ACCESS_KEY_ID=... PS_AUDIO_S3_SECRET_ACCESS_KEY=... \
     uv run python scripts/import_colleague_ps_audio.py --check-bucket --api-base https://prabhatai-api.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io
   ```
   It prints how many of the 69 files are found with the size `audio.json` says, and how many rows are new.
4. **Insert the rows** (the same command with `--apply`, without `--check-bucket`). It never updates or deletes; run again
   and it skips what is there. The API picks the rows up from the database by itself (catalogue poll), no restart.
5. **Check one song** (`GET /api/v1/songs/1`: the first audio has `performer: "Gunavati"` and `is_latest: true`;
   `GET /api/v1/ps-audio/1%20Bandhu%20He%20Niye%20Calo.m4a` answers 302).

Undo, if it is ever needed: `DELETE FROM media WHERE provider = 'ps_colleagues'` (only these rows; nothing else uses the provider).

## Titles

Every one of the 69 recordings carries the title of its song as the app's own data has it (`data/generated/songs.json`, the
official Roman-script title, Bengali words in Roman letters, as in the PS book). The check is in
`apps/mobile/__tests__/colleagueAudio.test.ts` and `apps/api/tests/test_ps_audio.py`: the title equals the catalogue's, no
Cyrillic. Nothing was invented or changed.
