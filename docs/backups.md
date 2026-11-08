# Backups: what is kept, for how long, and how to prove it works

Plain words first. Scripts are in `infra/backup/`. **Nothing was run against production** while writing this:
the tools (`pg_dump`, `age`, `rclone`, Docker) are not installed on the machine it was written on, so the scripts
were checked for syntax and dry runs only. The first real run is part of the checklist at the end.

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

* `pg_backup.sh`: dumps (`pg_dump` custom format), writes a small receipt `.json` (size, SHA-256, row counts of
  `songs`, `recordings`, `user_accounts`), encrypts, uploads, deletes dumps older than the retention.
  Use the **direct** Neon connection address, not the pooled one, and a read-only database user.
* `files_backup.sh`: copies the recordings bucket to the backup bucket, add-only.
* `restore_drill.sh`: starts a temporary Postgres in Docker, decrypts and restores the newest dump, compares row
  counts with the receipt, prints the seconds it took. Exit code is non-zero if anything differs, so a monthly
  reminder can trust it.
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
2. Download the newest `.dump.age` and decrypt with the private key.
3. `pg_restore --no-owner --no-privileges --dbname=<new database URL> restore.dump`
4. Check row counts and the `alembic_version` against the receipt.
5. Change the server's `DATABASE_URL` to the new database and restart.
6. Files: copy back from the backup bucket with `rclone copy backup:prabhat-backups/files r2:prabhat-recordings`.

## Open points

* Costs of the backup bucket: see the table in `docs/storage.md`; a second copy doubles the storage line. The
  database dumps are small and sit inside the free 10 GB for a long time.
* If the live database ever outgrows the free Neon plan the 6 hour rewind window grows; the daily dump stays.
