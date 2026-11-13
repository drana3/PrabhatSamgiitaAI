# Where the uploaded recordings live, and where they should live

Plain words first, details after. Checked against the code on 2026-11-09.

## In plain words

A person uploads a Kiirtan or a Bhajan. The audio file has to be kept somewhere. The app's server can keep it in
two kinds of place:

1. **On the server's own disk** ("local"). Simple, and fine on a laptop.
2. **In a storage bucket** (an online shelf for files, "S3-compatible"). Cloudflare R2 is one such shelf.

The code already knows both. Which one is used is decided by one setting, `RECORDING_STORAGE_BACKEND`.
If the setting is missing, the code uses **local**.

**The worry:** the production server runs as an Azure Container App. The deploy scripts in this repository
(`infra/azure/deploy-app.sh`, `.github/workflows/deploy.yml`) do not set `RECORDING_STORAGE_BACKEND` and mount no
disk. By the code that means recordings go to the container's own temporary disk, and **that disk is wiped when the
container restarts or is replaced** (a new deploy does this). This is the reading of the code and the deploy
files. It was **not checked on the live server** (no access); the only way to be sure is to look at the
environment of the running container, or to upload a test file, redeploy, and see if it is still there.

**The fix:** use the bucket (Cloudflare R2), move the files that exist now, and never depend on the server disk.
The code for this is ready and tested; it needs a bucket and its keys, which only Dada can create.

## Why R2

* The server code speaks the S3 language. R2 speaks it too, and so do many others (Backblaze B2, Wasabi,
  Hetzner, Amazon S3). Moving later from R2 to another shelf is a copy and a changed address, not a rewrite.
  That is what "portable" means here.
* R2 charges **nothing for traffic out** (every listener downloading a file). With a music app, traffic is the
  usual big bill elsewhere. Source: Cloudflare R2 pricing, https://developers.cloudflare.com/r2/pricing/ ,
  read 2026-11-09.

## What it costs, against the budget of 2000 INR a month

R2 Standard (2026-11-09, same source): **10 GB free each month**, then **0.015 USD per GB-month**; 1 million
writes and 10 million reads free each month, then 4.50 USD per million writes and 0.36 USD per million reads;
egress free. Assumptions, so you can change them: 1 USD = 88 INR (check today's rate); an average recording
6 MB (the upload limit is 60 MB, a typical 6 minute Kiirtan is 4 to 8 MB).

| Recordings | Files, GB | R2 per month, USD | R2 per month, INR | With a second copy (backup), INR |
| --- | --- | --- | --- | --- |
| 1 000 | 6 | 0 (inside the free 10 GB) | 0 | 0 |
| 5 000 | 30 | 0.30 | about 26 | about 70 |
| 20 000 | 120 | 1.65 | about 145 | about 290 |
| 100 000 | 600 | 8.85 | about 780 | about 1 560 |

So the budget of 2000 INR holds storage plus a full backup copy up to about 700 GB, roughly 115 000 recordings.
Writes and reads stay far inside the free amounts at this size (a recording is one write; each listen is one read).
**Where it breaks first** is not R2 but the rest: the database (Neon, see `docs/backups.md`) and error reports
(`docs/observability.md`), which have their own limits.

## Where the code is

| What | File |
| --- | --- |
| The two places and the signing of upload links | `apps/api/app/services/recording_storage.py` (`LocalDiskStorage`, `S3Storage`, hand-written AWS SigV4, path style for R2) |
| Settings | `apps/api/app/config.py`: `RECORDING_STORAGE_BACKEND`, `RECORDING_S3_ENDPOINT`, `RECORDING_S3_BUCKET`, `RECORDING_S3_REGION`, `RECORDING_S3_ACCESS_KEY_ID`, `RECORDING_S3_SECRET_ACCESS_KEY`, `RECORDING_PUBLIC_BASE_URL`, `RECORDING_LOCAL_DIR` |
| What the database remembers per recording | `recordings.audio_key`, `audio_url`, `audio_bytes`, `audio_sha256` (a unique index on the hash stops the same file twice) |
| Key shape | `recordings/<member id>/<file id>.<ext>`, so the key says whose file it is |
| The move | `apps/api/scripts/migrate_recording_files.py` and `apps/api/app/services/storage_migration.py` |
| Tests | `apps/api/tests/test_storage_migration.py` |

## What Dada does once (about 20 minutes)

I may not create accounts or handle keys, so these steps are yours:

1. Create a Cloudflare account and, in R2, a bucket, for example `prabhat-recordings`. Leave it private.
2. Make an **R2 API token** limited to that one bucket, with read and write. Cloudflare shows the access key id
   and the secret **once**; store them in a password manager.
3. Do not count on "old versions" of files being kept by the bucket itself. R2 did not offer S3-style object
   versioning when this was written (check the current Cloudflare docs before relying on it either way). The
   protection against deleted or overwritten files is a second, add-only copy; see `docs/backups.md`.
4. Put the values in the API's environment (Azure Container App secrets): `RECORDING_STORAGE_BACKEND=s3`,
   `RECORDING_S3_ENDPOINT` (the `https://<account id>.r2.cloudflarestorage.com` address Cloudflare shows),
   `RECORDING_S3_BUCKET`, `RECORDING_S3_REGION=auto`, the two keys. Never in the repository, never in chat.
5. Give the bucket a **public address** and set `RECORDING_PUBLIC_BASE_URL` to it. This one is required: the
   address of every published recording is stored in the database as `<RECORDING_PUBLIC_BASE_URL>/<key>`,
   and the API refuses to start the S3 backend without it (the error names the missing setting). Two ways:
   connect a custom domain to the bucket, for example `audio.prabhatasamgiita.org` (fast: Cloudflare serves
   files from its edge servers near the listener, free of egress charge), or switch on the bucket's
   `r2.dev` public address in the Cloudflare dashboard (works at once, slower, rate-limited by Cloudflare; fine
   for a first test). Uploads and server-side reads still use signed, short-lived links; only listening uses
   the public address, so every file in this bucket is readable by anyone who knows its address.

## Environment variable names (all of them)

| Name | Meaning | Secret? |
| --- | --- | --- |
| `RECORDING_STORAGE_BACKEND` | `local` (default, a folder on the server) or `s3` | no |
| `RECORDING_S3_ENDPOINT` | `https://<account id>.r2.cloudflarestorage.com` | no |
| `RECORDING_S3_BUCKET` | bucket name | no |
| `RECORDING_S3_REGION` | `auto` for R2 (default) | no |
| `RECORDING_S3_ACCESS_KEY_ID` | R2 token, access key id | yes |
| `RECORDING_S3_SECRET_ACCESS_KEY` | R2 token, secret | yes |
| `RECORDING_PUBLIC_BASE_URL` | public address of the bucket, no trailing slash needed | no |
| `RECORDING_LOCAL_DIR` | folder for the `local` backend | no |
| `RECORDING_SIGNING_SECRET` | signs upload links for the `local` backend (not used with `s3`) | yes |

Tests with a stand-in bucket that checks signatures like the real one (wrong key, expired link, changed
address, wrong content type are all refused): `apps/api/tests/test_s3_fake_server.py`.

## How the existing files move (the migration)

Nothing is deleted at any step; the old copy stays until you decide to remove it.

1. **Dry run** (the default; changes nothing): lists what would be copied and what is already there.
   `python scripts/migrate_recording_files.py`
2. **Pilot**: `--apply --limit 20` copies twenty files.
3. **Everything**: `--apply --rewrite-urls --report moved.csv`.
4. **Check any time**: `--verify-existing` re-reads every file from the bucket and compares its SHA-256.

How it stays safe:

* **Idempotent.** A file already in the bucket with the right size is skipped. Run it again after a crash and it
  finishes the rest.
* **SHA-256 check.** The database already holds a fingerprint (SHA-256) of every upload. The script reads the file
  back from the bucket and counts the copy only if the fingerprint matches. A damaged original (its fingerprint
  differs from the database) is **not copied** and is reported.
* **Never overwrites** a different file that already sits at the target address (reports `target_mismatch`).
* **Rewrites the address** (`audio_url`) in the database only for files proven to be in the bucket, and only
  with `--rewrite-urls`.
* The default source is each recording's current `audio_url` over HTTPS, so it works from a laptop without
  access to the server's disk. If the files are already lost (see the worry above), they cannot be copied: the
  report shows them as `missing_in_source`, and the only remedy is to ask the uploaders to send them again.
  Doing the move **soon** limits that loss.

## Order of work

1. Check if the live server really uses local disk (look at the container's environment).
2. Create the bucket and keys, set the environment, redeploy. New uploads now go to the bucket.
3. Run the migration for the old files, pilot first.
4. Turn on the backup of the bucket (`docs/backups.md`).
5. Only then, and only if you want, delete the old disk files by hand.

## Not covered

The Prabhat Samgiita archive (about 3 700 songs on third-party hosts) is not stored by us: the app links to
those files. Nothing here changes it.
