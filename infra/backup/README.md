# Backups

Scripts for the database dump, the file copy and the restore drill. Nothing here runs by itself:
every script needs you (or the manual GitHub workflow `backup.yml`) to start it, and every script
has `--dry-run` that prints the plan and touches nothing. Explanation in plain words, costs,
RPO/RTO and the schedule: [docs/backups.md](../../docs/backups.md).

| Script | What it does |
| --- | --- |
| `pg_backup.sh` | `pg_dump` of the database, encrypted with `age`, uploaded to the backup bucket (or a plain folder), old ones removed (keep the newest N, or older than N days), a small `.json` receipt beside each dump |
| `files_backup.sh` | copies the recordings bucket to a second bucket (other account or provider); never deletes in the copy |
| `restore.sh` | the real restore of a dump into a database you name; refuses a non-empty target unless `--replace` |
| `restore_drill.sh` | restores a dump into a throw-away database (Docker, or a scratch server via `DRILL_ADMIN_URL`), checks it against the receipt, prints how long it took (that is the real RTO) |
| `lib.sh` | shared helpers (no secret is ever printed) |

All settings come from the environment (see the top of each script). No key, URL or password is
written in the repository.
