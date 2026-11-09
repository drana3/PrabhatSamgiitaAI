# Play counts: protection against inflated numbers

Authors see how often their recordings were played. The number must be honest, and it must not
make anyone's listening public. Code: `apps/api/app/services/author_stats.py` (counting) and
`apps/api/app/services/play_fraud.py` (the second line). Tests: `test_author_stats.py`,
`test_play_fraud.py`.

## The first line (already there)

These stop most cheating when a play is counted:

1. **Real listening time.** A play needs 30 seconds, or half of a short track (never under 10).
   The phone checks it and the server checks again against the recording's own length, so a phone
   cannot say "20 seconds long".
2. **One play per listener, per recording, per day.** The database enforces it with a unique key,
   so two requests at the same moment cannot both win.
3. **A daily cap per listener** (300 plays a day, recordings and songs together).
4. **Your own plays of your own recordings do not count.**
5. **A client cap for signed-out phones.** A signed-out listener is only a made-up device id, so
   one client (an address bucket) can add only 10 new listeners per recording per day and 30 per
   day. It can add only 200 plays per recording per day and 1000 per day. Plays above that are
   stored but not counted in any number.
6. **Request limit** in front of everything: 240 play requests per 10 minutes per address
   (`docs/rate-limits.md`).
7. **No raw data about people.** A listener is a 24-bit slice of a keyed hash, shared by about 500
   people in the world, so it cannot point at a person. The address is only a salted hash of its
   bucket (an IPv6 address by its /64).

## The second line (new): find a day that looks wrong, hold the excess back

After a batch of plays is counted, each recording-and-day that got plays is judged by two rules.

**Spike.** The day has at least 50 plays and at least 6 times the recording's ordinary daily level.
The ordinary level is the mean of the last 14 days (never below 10, so a new recording has a
floor), with already-held excess taken out of the history, so a flood cannot raise the bar for the
next one. The author may still be shown 3 times the ordinary level. The rest is held.

**One source.** The day has at least 30 plays and one client bucket produced more than 25 of them.
A household or a school is a few; a script is hundreds. What is above 25 is held.

When a rule shows, a row in `play_flags` records: the recording, the day, the plays, how many are
**held**, the ordinary level it was compared with, the reason (`spike`, `one_source` or both) and a
status. The flag is created at once, not by a nightly job.

**Held plays are not deleted.** They stay in the raw counters, so a person can look. But they are
subtracted from every number an author or the public sees: total plays, plays in 30 days, the daily
graph, the weekly line on the public page, the author's own top recordings and split by kind, and
the Top Played list (including its minimum). Every query that sums `play_daily.plays` subtracts the
held plays of the same period (`play_fraud.held_per_recording`, one shared subquery), so two screens
cannot disagree. A flag a person cleared is not subtracted.

### The team decides

Admin key, `GET /api/v1/admin/play-flags` (default: open flags), then one of:

- `POST /api/v1/admin/play-flags/{recording_id}/{day}/clear`: the plays were real. Nothing is held
  back any more for the plays the day had at that moment.
- `POST /api/v1/admin/play-flags/{recording_id}/{day}/confirm`: they were inflated. The held count
  stays.

A decision covers the plays the day had when it was made (`reviewed_plays`). It is not a licence for
more: if that day later grows by at least 50 plays and by at least half of what it had, it is judged
again and the flag opens again, holding back only the new part (a confirmed day keeps what it held
and adds to it). A small trickle after the decision changes nothing.

There is no admin screen yet; the team works it through the admin API.

### What the author sees

Their numbers are lower than the raw counter on a flagged day, until the team clears it. The app is
**not told** that a flag exists, and the answer to the phone that sends plays is the same as before.
A script must not learn where the line is.

## No deanonymisation

- A flag has only counts and a reason. It has no listener key, no client key, no address.
  `test_a_flag_holds_no_listener_or_address_data` fixes the column list.
- The admin list shows the same fields and nothing else.
- The "one source" rule uses the client bucket inside the database query. The bucket is never
  copied into the flag or sent anywhere.
- Raw play rows are still deleted after 400 days, and a member who deletes their account has their
  rows erased (`erase_listener`).

## Honest limits

- A patient attacker with many real accounts and many addresses, each playing a little, looks like
  a popular recording. No rule can tell, and none tries to. The rules are for floods.
- The "one source" count uses only events that really became plays (`play_events.counted`). Events
  a client sent above its cap are stored but not counted, and they are left out here, so spamming a
  recording with uncounted events cannot get anybody's real plays held back. What is held never
  exceeds the day's plays.
- Signed-in plays are not bucketed by address (a member is one account). A farm of accounts is
  caught by the spike rule, not by the source rule.
- A real surge (a share to a big group, a festival) can be held. That is why a person looks, and why
  clearing is one call. If this happens often, raise `SPIKE_MIN_PLAYS` or `SPIKE_FACTOR` in
  `play_fraud.py`. Every number is in one place at the top of that file.

## Tables

`play_flags` (migration `0058_play_flags`), and one new column on `play_events`, `counted` (same
migration, default true). Both were added before the migration was released, so it was edited in
place; a database that already ran an earlier 0058 needs the column added by hand.
