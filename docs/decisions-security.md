# Security and safety decisions (9 November 2026)

Dada answered "decide as you see fit" on these questions. This page records each choice, the reason, what is
built, what is not, and how to change it. A choice that needs a lawyer is marked. Today is 9 November 2026.

| # | Question | Decision | Built? |
|---|---|---|---|
| 1 | When does the old shared key stop? | **31 January 2027**, set as a server setting, after a forced update | Setting built; the date is set at deploy |
| 2 | Who works the takedown and fraud queues? | **Dada, or an administrator Dada names, through the API.** No screen, no alert yet | API built; no screen, no alert |
| 3 | A button to undo "confirmed as inflated" | **Yes**, admin only, leaves a trail | Built (`/unconfirm`) |
| 4 | How long are complainants' contacts kept? | **3 years after the last decision**, then erased except name and case | Rule only; erasure is a manual SQL for now |
| 5 | Virus scanning (ClamAV) for uploads | **Not now.** Build it before uploads open to unknown members | Not built |
| 6 | Minimum age | **16**, with stores set to teens and adults | Rule only; sign-up line and Terms page not built |

## 1. Switching off the old shared key

**Context.** Every installed app still carries the shared key (`X-Member-Proxy-Key`). Since QA-001 it works only
as an ordinary member, and signed tokens replace it, but it must end (`docs/security-member-auth.md`, section 2
and 6). Phones in people's hands update slowly, and a build with tokens is not in the stores yet.

**Decision.** The end date is a server setting, `LEGACY_PRINCIPAL_UNTIL` (format `YYYY-MM-DD`). Recommended value:
`2027-01-31`. After that date the server refuses the shared key by itself, with the existing message "This app
version can no longer sign in. Please update.". There is **no default date in the code**: leaving the setting
empty keeps the old behaviour, so a deploy never switches anything off by surprise. `ALLOW_LEGACY_MEMBER_PRINCIPAL=false`
still ends it at once.

**Why 31 January 2027.** About six weeks after a release in late November or early December (store review,
then at least four weeks of people updating). It is a rule, not a number: **the date must be at least six
weeks after the build with tokens is live in BOTH stores.** If the release slips past 15 December 2026, move the date
by the same amount. Never shorten it.

**Order (all of it before the date):**
1. Release the build with tokens; wait until both stores serve it (`docs/forced-update.md`).
2. Set `recommended_version` to it; watch `legacy_hits` in the logs.
3. About two weeks before the date set `minimum_version` to it, so old phones see the update page and not an error.
4. On the date the key stops. Then **rotate** `MEMBER_PROXY_KEY` and `MOBILE_MEMBER_PROXY_KEY`.

**To change it:** edit the setting; no code change. The date is evaluated at each request.

## 2. Who handles takedown and fraud queues

**Plain statement.** Today **nobody is assigned automatically, nobody is told when something arrives, and there is
no screen.** Both queues exist only as API calls that need an administrator sign-in:

- takedown requests: `GET /api/v1/admin/takedowns?status=new` and the actions in `docs/takedown-process.md`;
- suspicious play counts: `GET /api/v1/admin/play-flags` and `clear`, `confirm`, `unconfirm`
  (`docs/play-fraud.md`).

New takedown requests are **not** e-mailed to anyone. A rights holder who writes to `info@anandamarga.org`
is read by whoever reads that inbox, which is a separate path from the form.

**Decision.** The owner (Dada) is responsible, or an administrator he names in writing. Until a screen exists the
rule is:
- look at the takedown queue **at least twice a week** (status `new`), and answer the sender within
  **two working days**; a counter-notice is handled the same day it is seen;
- look at the play flags **once a week**.
These times are the author's choice for a small team, not a legal requirement. A lawyer should confirm the time for
the countries involved (`docs/takedown-process.md`, "Needs the owner's check").

**Not built, and the honest cost.** A queue that nobody opens is a legal risk for takedowns. The smallest
next step is an e-mail or notification to the named person for every new request, then a team screen. Neither is built
because it touches the team's notification and admin code.

## 3. "Unconfirm" for play fraud

**Problem.** "Confirm" moved plays into a permanent `confirmed_held` part, with no way back except editing the
database by hand. A mistake would lower an author's numbers for good.

**Decision.** `POST /api/v1/admin/play-flags/{recording_id}/{day}/unconfirm` (administrator only):
- the confirmed plays count again (`confirmed_held` becomes 0);
- a `confirmed` flag becomes `cleared`; an `open` one (a later surge the same day) stays `open` and keeps holding
  its own suspected part;
- the flag records `last_decision = "unconfirmed"`, who, and when (`reviewed_by`, `reviewed_at`);
- 409 when nothing was confirmed that day (so a second click changes nothing), 404 when there is no flag.
It is the only call that lowers the confirmed part. The author is not told, as with every other flag decision.
Code: `app/services/play_fraud.py` (`unconfirm`), `app/api/v1/play_flags.py`. Tests: `tests/test_play_fraud.py`.
No button in an app or on a web page yet (see 2).

## 4. How long a complainant's contact data is kept

**What is stored** (`takedown_requests`): the sender's name, organisation, e-mail, phone, postal address, the
typed signature, and a hash of the e-mail (`sender_key`, used to slow repeat senders).

**Decision (needs a lawyer's check).**
- While a case is open (`new`, `counter_received`, `forwarded`) all of it is kept.
- After the last decision (`decided_at`, or the date of the request when there was none) **three years** are kept.
  Three years covers the usual time limit for a copyright claim in many countries, and the 14-day counter-notice
  process. It is a safe middle, not a legal fact for every country.
- After that, **erase** e-mail, phone, address, signature and the e-mail hash. **Keep** the reference number, the
  sender's name and organisation, the dates, the decision and the recording link: the team must still be able to say
  who asked for a removal and when. The recording stays removed and its file stays blocked.
- A sender may ask earlier for erasure of contact details when the case is over: this is done by the same erase for
  that one row.

**Not automated.** There is no job that does this. Until there is, the erase is a manual step done by the person
in section 2, **once a year**, after a backup, on the production database:

```sql
UPDATE takedown_requests
   SET sender_email = 'erased', sender_phone = NULL, sender_address = NULL,
       signature = '', sender_key = NULL
 WHERE status IN ('rejected', 'restored', 'closed', 'taken_down')
   AND COALESCE(decided_at, created_at) < now() - interval '3 years';
```

(`sender_email` and `signature` cannot be empty by the table's rules, hence the placeholder and the empty text.)

**To do, in team files, not changed:** the privacy page does not say that complainants' contact data is kept for
this purpose and for how long (`apps/web/app/privacy/page.tsx`). Add it before the first real case.

## 5. ClamAV for uploaded files

**Decision: not now.** Do not run a virus scanner yet.

**Why it can wait.** Today the people who upload are the team and known authors, and recordings are reviewed after
they start to sound. A file is never executed by the server. Every upload must pass type, size, container and
duration checks that accept only real audio (`docs/upload-validation.md`, steps 1 to 6), the stored name is a
random id and a refused file is deleted. A scanner adds a second container and about 1 GB of memory for the
signature database, plus upkeep.

**Build it before ANY of these happens:**
1. uploads open to members who are not known to the team;
2. a button or link is added that hands other people the uploaded file itself (not only plays it);
3. a file type other than audio or an image is accepted.

**When built:** the plan is already written in `docs/upload-validation.md` ("Planned: ClamAV"): a private `clamd`
container, `INSTREAM` with a 30-second limit, a hit is refused and deleted, `clamd` down means a first upload
waits and other uploads are logged and let through, tests with the EICAR string.

## 6. Minimum age

**Decision: 16.** One number for every country: the EU's data-protection age is 16 unless a country lowers it
to 13, 14 or 15, so 16 satisfies all of them. The app is for teenagers from 16 and adults, not for children.

**Store settings** (answer the live forms; they change):
- Apple: do not use the Kids category. Answer the age-rating questionnaire truthfully (user-generated content: yes,
  reporting and blocking: yes). The result will be at least 13+ and probably 16+ with user content. Our own
  minimum of 16 is stricter and is stated in the Terms.
- Google Play: Target audience, choose the age groups **16-17 and 18 and over**. Do not choose any group under 13,
  and answer the Families questions "no" (a child audience would bring the Families policy with its limits).
- Both: no advertising, no ad SDK.

**Not built.** Two things are missing and both are outside this work: a sign-up line "You must be at least 16
years old" with a tick box (it touches the sign-in screen), and a Terms page. The app's link to the Terms
(`apps/mobile/lib/webLinks.ts`) points to `/terms`, which does not exist yet and answers 404, so the age rule
has nowhere to be written. Write the Terms first. Until the age line and the tick box are in, the rule exists
only on paper and in the store forms. `docs/store-compliance.md` ("Kids and COPPA") has the same open point.
No age is collected or stored by the app.

**Update 2026-11-10.** The Terms page (`/terms`), the sign-up tick "I'm 16 or older" (web and app) and the line under the
Apple / Google buttons are built; the server validates `age_confirmed` but does not store it. See `docs/age-confirmation.md`.
