# Backups: what is kept, for how long, and how to prove it works

Plain words first. Scripts are in `infra/backup/`. **Nothing was run against production** while writing this.
The database part was rehearsed for real on a throw-away PostgreSQL 16 on a laptop (see "What was rehearsed
and what was not" below). `age` and `rclone` and Docker are not installed on that laptop, so those three
parts were only checked with stand-ins and dry runs. The first real run is part of the checklist at the end.

## Two things need a backup

1. **The database** (songs, accounts, comments, recording records, flags). Lives at Neon.
2. **The audio files people upload.** Live in the recordings bucket (Cloudflare R2, see `docs/storage.md`).

The Prabhat Samgiita archive audio is on third-party hosts and is not ours to back up.

## What Neon already gives, and why it is not enough

Neon's free plan keeps a short history that lets you rewind the database: **6 hours** (Neon pricing page, read
2026-11-09, https://neon.com/pricing; a paid plan lengthens it). That covers "someone ran a bad command ten
minutes ago". It does not cover "we noticed a week later", "the Neon project was deleted", or "the account was
locked". So we also keep **our own dump, in a different company's storage**.

## The plan in plain words

| Thing | How often | Kept for | Where |
| --- | --- | --- | --- |
| Database dump, encrypted | every day (once switched on) | 35 days (setting `BACKUP_RETENTION_DAYS`) | a backup bucket in a different account than the live one |
| Copy of the recordings bucket | every day (once switched on) | forever; the copy is never deleted from by the script | a second bucket, other account or provider |
| Restore drill | once a month, by hand | not kept | your laptop, throw-away Docker database |

Why encrypted: the dump holds email addresses and password hashes. It is encrypted with `age` before it leaves the
machine. The **public** key is in the settings; the **private** key stays offline with Dada (a password manager
plus a printed or USB copy). Without the private key the backups cannot be read, so losing the key equals having
no backups. Keep two copies of it in two places.

## RPO and RTO without the jargon

* **RPO, "how much recent work can we lose".** With a daily dump: **up to 24 hours** of new accounts, comments
  and uploads. For the last 6 hours Neon's own rewind can usually do better. If 24 hours feels too long, run the
  dump twice a day; the cost is only a little storage.
* **RTO, "how long are we down while we restore".** Unknown until the drill has been run once on the real
  database, which is exactly what the drill measures and prints. Honest guess for a database of a few hundred
  megabytes: **one to two hours**, most of it finding the key, creating a new database and changing the address
  in the server settings, not the restore itself. Replace this guess with the drill's number.
* **Files.** An uploaded file is lost only if it is deleted or overwritten in the live bucket **and** in the copy.
  The copy script uses add-only mode (`rclone copy --immutable`): it never deletes in the copy and never replaces
  a file that already exists there. A bad day in the live bucket therefore does not travel into the copy.

## Cloudflare R2: no "old versions" to lean on

When this was written R2 had no S3-style object versioning (check Cloudflare's current R2 documentation; it is
the kind of feature that appears later). That is why the second, add-only bucket matters: it is the only place an
overwritten or deleted file can come back from. Cloudflare also has rules that stop deletes for a set time on a
bucket ("bucket lock"); worth switching on for the backup bucket if your plan offers it.

## The scripts

* `pg_backup.sh`: dumps (`pg_dump` custom format, compressed), writes a small receipt `.json` (size, SHA-256,
  schema version, row counts of `songs`, `recordings`, `user_accounts`), encrypts, uploads, then tidies old
  dumps. Tidying is either "keep the newest N" (`BACKUP_KEEP_COPIES=14`) or, when that is not set, "delete
  older than `BACKUP_RETENTION_DAYS`" (default 35). It only deletes after the new dump is stored.
  Use the **direct** Neon connection address, not the pooled one, and a read-only database user.
  The destination `BACKUP_REMOTE` is either an rclone path (`backup:prabhat-backups/db`: R2, S3, B2) or a
  plain folder (`/Volumes/USB/backups`). The cloud route is the real one; the folder route exists for
  rehearsals and for a copy on a USB disk.
* `files_backup.sh`: copies the recordings bucket to the backup bucket, add-only.
* `restore.sh`: the real restore. `restore.sh --latest --identity KEY --target-url URL` (or `--file`). It
  stops if the target database already has tables, unless you add `--replace`. It never prints the password.
* `restore_drill.sh`: restores the newest dump into a temporary database, compares row counts with the
  receipt, prints the seconds it took, removes the temporary database. By default the temporary database is a
  Docker container. If Docker is not installed set `DRILL_ADMIN_URL` to a scratch Postgres server (the drill
  creates and drops a database called `drill_<number>` on it). Exit code is non-zero if anything differs, so a
  monthly reminder can trust it.
* `.github/workflows/backup.yml`: a **manual** button (Actions, Backup, Run workflow), dry run ticked by default.
  The daily `schedule` lines are commented out on purpose. Remove the comment marks only after one real run
  worked.

All settings are environment variables (the top of each script lists them); no key is stored in the repository.

## What Dada does once

1. Make a **second Cloudflare account or another provider** (Backblaze B2 works the same way) and in it a bucket,
   for example `prabhat-backups`. A different account is the point: one compromised login must not reach both
   the live files and the backups.
2. Create a token for that bucket (read and write) and store the keys in the GitHub repository secrets
   `BACKUP_S3_ENDPOINT`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, plus `BACKUP_REMOTE`
   (for example `backup:prabhat-backups/db`), `FILES_BACKUP` (for example `backup:prabhat-backups/files`),
   `FILES_SOURCE` (for example `r2:prabhat-recordings`) and the live bucket's `RECORDING_S3_*` three values.
3. Create the age key pair on your laptop: `age-keygen -o backup.agekey`. It prints the public key
   (`age1...`): put that in the secret `BACKUP_AGE_RECIPIENT`. Keep `backup.agekey` offline, two copies. Never
   paste it into chat or the repository.
4. Put `BACKUP_DATABASE_URL` (the direct Neon address of a read-only user) in the secrets.
5. Run the workflow once with **dry run** ticked, then once without. Look at the bucket: a `.dump.age` and a
   `.json` should be there.
6. Run the drill on your laptop (install Docker, `age`, `rclone` first):
   `infra/backup/restore_drill.sh --latest --identity ~/keys/backup.agekey` with `BACKUP_REMOTE` set.
   It must end with `OK: the backup restores and matches its receipt`. Write the seconds it printed into the
   RTO line above.
7. Only now un-comment the `schedule` in `backup.yml`.
8. Put a monthly reminder in your calendar: run the drill. A backup that was never restored is a hope, not a
   backup.

## Restoring for real (short form)

1. Create a new empty Neon database (or branch). Do not overwrite the old one until you know the new one is good.
2. `BACKUP_REMOTE=backup:prabhat-backups/db infra/backup/restore.sh --latest --identity ~/keys/backup.agekey
   --target-url <direct address of the new database>`. It downloads, decrypts and restores in one go.
3. Check the row counts and `alembic_version` against the `.json` receipt that sits next to the dump. Then run
   `alembic upgrade head` once (it does nothing when the dump is already current).
4. Change the server's `DATABASE_URL` to the new database and restart.
5. Files: copy back from the backup bucket with `rclone copy backup:prabhat-backups/files r2:prabhat-recordings`.

## What was rehearsed and what was not

Rehearsed on a throw-away PostgreSQL 16.2 (the `pgserver` Python package, no system changes), with a database
built by `alembic upgrade head` (99 tables, schema version `0068_video_thumbnail`) and a little data
(3 songs, 25 recordings, 1 account, 2 scan channels):

* `pg_backup.sh` three times in a row with `BACKUP_KEEP_COPIES=2`: the third run removed the oldest dump and
  its receipt, two stayed. The receipt listed `songs 3, recordings 25, user_accounts 1`.
* `restore_drill.sh --latest`: restored in under one second, counts matched the receipt, the temporary
  database was dropped afterwards.
* `restore.sh --latest` into a new empty database: 99 tables, and the row count of **every** table was identical
  to the source (5 tables had data, the other 94 were empty in both). A second run without `--replace` was
  refused ("already has 99 tables"); with `--replace` it worked.
* Moving the database down and up again over the last migrations is described in `docs/launch-readiness.md`.

Not rehearsed (needs tools or accounts this laptop does not have): real `age` encryption (the flow was checked
with a stand-in that only prefixes the file, the tests are in `apps/api/tests/test_backup_scripts.py`), real
`rclone` upload to a bucket, Neon itself (its direct address, its Postgres version; `pg_dump` must be the same
major version or newer), and the time a real-size database takes (the drill prints it).

## Open points

* Costs of the backup bucket: see the table in `docs/storage.md`; a second copy doubles the storage line. The
  database dumps are small and sit inside the free 10 GB for a long time.
* If the live database ever outgrows the free Neon plan the 6 hour rewind window grows; the daily dump stays.
