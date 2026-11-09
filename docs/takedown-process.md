# Takedown requests from rights holders

This is how the app answers a person who says "this recording is mine and I did not allow it".
It is a working process, not legal advice. Have a lawyer read the letters and the waiting time
below before the first real case (see "Needs the owner's check").

## The short version

1. A rights holder fills in the public form at `/takedown` on the website. No account needed.
2. The request lands in a queue. **Nothing is hidden by the form itself.** A person decides.
3. A team member reads it in the admin queue and picks one action:
   - **Take down**: the recording is hidden, the same audio file is blocked from being uploaded
     again, and the uploader gets a message with the reason and how to answer.
   - **Reject**: nothing changes, and the sender gets a letter saying why.
4. If the uploader answers with a **counter-notice**, the team forwards it to the sender and a
   waiting time of 14 days starts. After that the recording is put back, unless the sender says
   they started a legal process.

## Where things are

| What | Where |
| --- | --- |
| Public page (English) | `apps/web/app/takedown/page.tsx`, form in `apps/web/components/takedown-form.tsx` |
| Web proxy | `apps/web/app/api/takedown/route.ts` (never copies the visitor's `X-Forwarded-For`; sends the address the platform saw in `X-Web-Client-Ip`, together with the website-only key, so the per-address limit works. See `docs/rate-limits.md`) |
| Public endpoints | `POST /api/v1/takedown`, `POST /api/v1/takedown/{reference}/counter-notice` (signed-in member) |
| Team endpoints | `/api/v1/admin/takedowns` (admin key): list, detail, `link`, `take-down`, `reject`, `forward`, `restore`, `close`, `letters` |
| Logic | `apps/api/app/services/takedowns.py`, `apps/api/app/services/blocked_hashes.py` |
| Tables | `takedown_requests`, `blocked_audio_hashes` (migration `0057_takedown_requests`) |
| Link from the app | About screen, card "Copyright" (opens the website page) |
| Tests | `apps/api/tests/test_takedown.py` |

There is **no admin screen yet**. The team works the queue through the admin API (the same way as
the other admin tools that use the admin key). A screen can be added later without changing the
rules.

## Statuses

```
notice:          new --take down--> taken_down --counter-notice--> counter_received
                 new --reject-----> rejected
counter-notice:  new --forward----> forwarded --restore--> restored
                                              --close----> closed
```

- A request can be decided only once. A second action on it answers 409.
- **Take down** needs the request to be linked to a recording. The form tries to find the
  recording from the address the sender gave. If it cannot, the team links it by hand
  (`/link`) after checking the title and the uploader.
- **Restore** is refused while the waiting time runs, unless the sender withdrew
  (`claimant_withdrew: true`) or the 14 days passed. It also removes the file block, so the file
  can be uploaded again.
- **Close** keeps the recording down and the file blocked. Use it when the sender started a
  legal process.

## What the take-down does, exactly

- The recording status becomes `removed`, with a reason that says a rights holder asked.
  It disappears from lists, search, the player and the radio the same way a recording removed by
  an admin does (the same `remove_recording` code, not a second path).
- The SHA-256 of the audio file goes into `blocked_audio_hashes`, one row per request (two
  requests about the same file hold the file separately; lifting one never lifts the other). An upload of the same bytes
  answers 409 with code `removed_duplicate` and a plain message. Re-encoding the file changes the
  hash, so this stops the simple re-upload only. Near-duplicates are caught by the existing
  duplicate check (`docs/duplicate-check.md`) and by a person.
- The uploader gets a notice in the app (kind `recording_removed`) with the reason, the
  reference number, and the actions `counter_notice` and `contact`. The notice does **not**
  contain the sender's email, phone or address.
- The sender's data is kept in the request row only. It is shown to the team and in the letters,
  and is not given to the uploader.

## Restoring is guarded

Restoring (`restore` on the counter-notice) is refused with 409 unless the notice it answers is
still `counter_received`, and also while any OTHER notice about the same recording or file is
`taken_down`, `counter_received` or `closed` (a legal process). The reply names the other
references. Only the restored request's own block row is removed, so a file with another request
behind it stays blocked. One request cannot undo the action taken on another.

## Anti-spam

- A hidden form field (`website`): a bot that fills it gets a normal-looking answer and nothing is
  stored.
- Both confirmations (good faith, accuracy) and a signature are required.
- The same sender (salted hash of the email) can file 3 requests a day. Sending the same request
  twice returns the first reference instead of making a second row.
- There is deliberately **no cap for the whole service**. Anyone can send a notice without an
  account, so a shared cap would let one stranger shut every real rights holder out (the form would
  answer 503 to everyone). Instead every notice is accepted as `new`, and nothing is acted on until
  the team reads it. Past 200 new notices in a day a warning is logged so someone looks at the
  queue. What limits a flood is the per-sender limit (3 a day) and the per-address limit below.
- A per-address limit in front of the route (5 a day) and 3 counter-notices a day per account.
  See `docs/rate-limits.md`.
- The answer to the sender is the same whether or not the recording exists. The form is not a way
  to find out what is in the library.

## Counter-notice

The uploader (only the uploader of that recording, once) sends: why it was a mistake, the two
confirmations, a signature, and a way to be reached (the account email is used when there is one).
The team then forwards the counter-notice to the sender with the letter below, which starts the
14-day clock (`forwarded_at`).

General DMCA-style steps, for orientation only and **not legal advice**:

1. The rights holder sends a notice with the identifying details and the two statements.
2. The service removes the material quickly and tells the uploader.
3. The uploader may send a counter-notice with a statement under penalty of perjury that the
   removal was a mistake, and consents to the courts of their place.
4. The service passes the counter-notice to the rights holder.
5. If the rights holder does not tell the service within 10 to 14 business days that they have
   started a court action, the service may put the material back.

Our form asks for a good-faith statement and an accuracy statement. Whether the wording must be
"under penalty of perjury", and whether the 10 to 14 business days or the 14 calendar days we use
is right for your country and hosting, is a question for a lawyer.

**App side not built yet.** The endpoint for the counter-notice exists and is tested. The "Send a
counter-notice" button on the uploader's message in the app is not built, because it lives in the
notices and the author screens, which this work did not touch. Until it is built, an uploader who
writes to `info@anandamarga.org` is answered by the team, who file the counter-notice by hand.

## Letter templates

The admin endpoint `GET /api/v1/admin/takedowns/{id}/letters` returns both letters filled in for
a request. The text is in `letter_to_author` and `letter_to_claimant`
(`apps/api/app/services/takedowns.py`). Send the letter to the sender from `info@anandamarga.org`;
the app does not send email by itself. The notice to the uploader is created by the take-down and
appears in the app.

### Letter 1. To the uploader (also the in-app notice)

> Subject: "{recording title}" was taken down after a rights holder's request
>
> We removed "{recording title}" from the library.
>
> A rights holder, {name} ({organization}), told us that this recording infringes their rights in:
> {work}. Reference: {TD-XXXXXX}.
>
> We have not decided who is right. We act on such requests quickly and we hide the recording
> until it is clear. The file can no longer be uploaded while this stands.
>
> If you believe this was a mistake, or you have the right to share it, you can send a
> counter-notice from this message. You will be asked to explain why, to confirm that you believe
> in good faith that it was removed by mistake, and to give your name and an address where you can
> be reached. We pass your answer to the person who asked for the removal. If they do not start a
> legal process within about 14 days, we put the recording back.
>
> If you do not answer, the recording stays removed.
>
> This message is not legal advice. If you are unsure of your rights, ask a lawyer.
>
> Prabhat Samgiita AI team

### Letter 2. To the rights holder

The first line after the greeting depends on the state of the request:

- **Received** ("new"): thanks, a person will read it, quote the reference.
- **Taken down**: the recording was removed and blocked from upload, the uploader was told and can
  answer; if a counter-notice comes it will be passed on, and the sender has about 14 days to say
  that a legal process started, otherwise the recording may be put back.
- **Rejected**: nothing was removed yet, here is why (the team's reason), send the exact address of
  the recording or the missing details and quote the reference.
- **Counter-notice received or forwarded**: the uploader says the removal was a mistake or that they
  have the right to share; here is their answer; if the sender does not say within about 14 days
  that a legal process started, the recording may be put back.
- **Restored**: no legal process was reported, so the recording was put back; tell us if that
  changes.
- **Closed**: the request is closed and the recording stays removed.

Each ends with "With respect, Prabhat Samgiita AI team", the address `info@anandamarga.org` and "This message is not legal advice." The address comes from the server setting `COPYRIGHT_CONTACT_EMAIL` (default `info@anandamarga.org`).

## Needs the owner's check

- A lawyer should read both letters, the two statements on the form, and the 14-day waiting time
  for the country where the service is run and for the countries of the rights holders you expect
  (Kiirtan rights holders are often outside your country).
- **Decided (Dada, 9 Nov 2026): rights holders and takedown questions go to `info@anandamarga.org`.**
  It is in the web page `/takedown` (fallback if the form is down), in the app's About screen
  ("Or write to ..."), in both letter templates and in the setting `COPYRIGHT_CONTACT_EMAIL`. The
  general contact on the privacy and account-deletion pages (privacy questions, account help) is a
  different thing and is a team page that was not changed.
- Who runs the queue. Decided (9 November 2026): the owner or an administrator he names, through the API only,
  at least twice a week; there is no screen and no alert for a new request yet. Details and the limits:
  `docs/decisions-security.md`, part 2.
- How long the sender's contact data is kept. Decided: three years after the last decision, then e-mail, phone,
  address and signature are erased and the name, reference and outcome stay (a manual SQL for now, part 4 of
  `docs/decisions-security.md`). A lawyer should confirm the period.
- Whether a DMCA "designated agent" must be registered. In the United States this is a
  registration with the Copyright Office that gives the service legal protection for user
  uploads. That is a legal decision and is not done by this code.
- The privacy policy does not yet say that the sender's contact data is kept for this purpose.
  See `docs/service-registry.md` for the list of what personal data is stored.
