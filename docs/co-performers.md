# Several performers on one recording (co-credits)

Status: DESIGN, written 17 Nov 2026, waiting for Dada's approval. Nothing here is built yet.
Related: `docs/author-profiles.md` (pages, claims), `docs/kiirtan-publishing.md` (upload), `docs/notifications.md`.

## Intent and why

A Kiirtan, Bhajan or Prabhat Samgiita is often sung by a group: two singers, a singer and a harmonium player, a
whole sangha. Today the recording belongs to one account (the uploader) and the others are only words in the
`author` text. Dada's wish: every person who took part can have the recording on their own author page, nobody
"takes" it away from the others, and nobody is put on a page against their will.

## What the code does today (found 17 Nov 2026)

- `recordings.author` is free text ("Priya Devi & Arun Deva"); `recordings.author_id` is the uploader's account.
  Only the uploader's page shows the recording by itself (`author_profiles.attribution`, rule 1).
- A second performer can only go through "claims" (`author_claims`, approved claim puts the recording on the page).
  The ladder sends every credit with more than one name to the team (`group_credit`), and a recording credited to
  "A & B" that A already claimed sends B's claim to the team too (`taken_by_other`, the check is on the whole credit
  text, not on the person). So the second performer always waits for the team, and the first one "wins" on speed.
- The upload form has "Who are you for this recording?" (wrote / performs / both / only sharing) but nowhere to say
  who else is on it. The roles answer is not a server field (`by_author` + the comment).
- The uploader is not asked about claims (Dada, 8 Nov). That rule stays for claims. It does NOT fit here: this feature
  is the uploader choosing other people, and the other people must agree.

## Goals

1. At upload, the uploader can name the other performers (members of the app or plain names).
2. A named member sees a message and with one tap says "Yes, it's me" or "Not me". Yes puts the recording on their
   page, with the same weight as the uploader's.
3. A person who finds their name on a recording that nobody tagged them on can still add themselves (claims), and
   several people on one credit never block each other.
4. Every state and every way out is written down below and tested.

## Non-goals and anti-goals

- No shares, money or "main artist" ranking. All credited pages are equal; order is only the order of the names.
- The uploader is never able to put a recording on someone's page without that person saying yes (anti-goal:
  a famous name's page filling with strangers' recordings).
- A "no" never punishes the uploader and is never shown to others. A "no" is private.
- Not in this change: changing who owns the file (the uploader stays the owner: delete, edit, takedown), splitting
  plays between pages (every page counts all plays of the recording, as claims already do), and the age/gender
  statistics (not collected).

## Approaches considered

| | How | Trade-off |
|---|---|---|
| A (recommended) | Uploader names people at upload (and later). A named member confirms with one tap. Confirmed = on their page. Names without an account stay text until they join. Claims stay for people nobody named, with the two blocking rules fixed. | Needs one new table and a message type. Nobody is ever on a page unasked. Fast: no team involved. |
| B | Uploader names people, the recording appears on their pages at once, they can remove it. | Fastest, but a stranger can put a recording on a famous page until the person notices. Breaks the "nobody against their will" goal. |
| C | Keep only claims, just let each person claim without the team. | Nothing tells the other performer the recording exists, and anybody can claim any name that matches. Does not fix "I was there too" without a search. |

Chosen: A (my pick; Dada confirms).

## Design

### Data (migration `0071_recording_credits`, after `0070_claim_proofs`)

`recording_credits`: one row per person on a recording.

| column | meaning |
|---|---|
| id, recording_id (cascade), position | order of the names |
| name | the name as written (120) |
| profile_id (null, SET NULL) | the author page it points to; null = plain text name |
| role | `performer` or `author` (words/music). Decides the tab on the page (Wrote / Performs) |
| status | `text` (no page), `invited`, `accepted`, `declined`, `removed`, `expired` |
| source | `uploader`, `self` (the person added themselves), `team` |
| invited_by (member, SET NULL), invite_token_hash (null) | token only for a person with no account yet |
| decided_at, expires_at | an invitation expires after 60 days: the name stays as text |

Unique (recording_id, profile_id) when profile_id is not null. At most 10 credits per recording.
`recording_credit_events` is the log, like `author_claim_events` (added, invited, accepted, declined, removed,
expired, token_used, team_added). Nothing is erased.

On `author_profiles`: `credit_invites` = `everyone` (default) | `nobody`. Table `author_credit_blocks (profile_id,
blocked_member_id)` for "Not me, and don't let this person add me again".

`recordings.author` stays the display credit. At upload the app composes it as before. Later the server only keeps
it in step with the credits: adding a person appends their name with " & " (no duplicate by same name, 200
characters at most), removing a person takes their name out. So old clients and search keep working.

### Page attribution

`attribution()` gets a fourth option: recordings with an `accepted` credit for this page, minus the page's own
"switched off" exceptions (an `author_recording_links` exclude row now also hides a credited recording, so a person
can hide it from their page without leaving the credit; claims are not hidden this way). Visible statuses only.

### Who can be named, and the checks

- The page must exist (draft is allowed, it shows once published). A suspended page cannot be named.
- `credit_invites = nobody`, or the uploader is on the page's block list: the app says "This person does not take
  invitations. You can write the name as plain text."
- A person cannot be named twice on one recording. Naming yourself is automatic (role performs or both) and needs no
  invitation.
- Limits (stop scripts, not people): 10 credits per recording, 30 invitations per hour per member.
- A named page that already has an approved claim on this recording becomes `accepted` at once, no message. A named
  page with a pending claim: the claim is approved and the credit is `accepted` (two people agree, the team is not
  needed).

### The invitation life cycle

```
text ──(uploader picks a page)──▶ invited ──accept──▶ accepted ◀── (self add by token / claim)
                                     │ decline            │ person leaves ("Take me off") / uploader removes / team removes
                                     ▼                    ▼
                                  declined             removed        expired (60 days, back to plain text)
```

Messages (notification kinds; quiet, account-bound, kept 90 days):

- `credit_invite` to the person: "Priya added you as a singer on «Title»." Buttons: **Yes, it's me**, **Not me**,
  and a line link "Don't let this person add me" (a block). Opens the recording.
- `credit_accepted` / `credit_declined` to the uploader: one line, no names of reasons. A decline is shown to the
  uploader only as "{name} did not confirm", never as a block.
- `credit_removed` to the person who was taken off by the uploader or the team.

### The upload form

Under "Who are you for this recording?" a block "Who else is on it?":

- row "You" when the answer is performs or both.
- "Add a person": opens a search over author pages (name, spelling-tolerant, same matching as claims) with the
  option "Write a name" (plain text). Each chosen person is a chip with a state dot: "Will be asked", "Name only".
- role per chip (Sings / Plays / Wrote it), default Sings. Remove with the chip's cross.
- Baba's Audio has no performers (unchanged). The block is hidden there.

### After upload

A recording's page (the recording screen) shows a credit line: confirmed people are links to their pages, others are
plain text. "My uploads" shows next to each recording the state of its credits ("2 confirmed, 1 waiting"). The
uploader can add or remove people later, and can remove a person who has not answered at any time. A person who has
confirmed can only be taken off by themselves or by the team (so a mistaken uploader cannot silently drop someone;
the uploader may ask through "Report" if the confirmation was a mistake).

### Claims, fixed (the second door)

For people nobody tagged. The existing flow stays, with two changes:

1. `taken_by_other` is decided **per person in the credit**: A's live claim on "A & B" no longer blocks B. It still
   blocks a second page for the same name (two different pages claiming "Priya Devi").
2. `group_credit` no longer sends a claim to the team when the credit has several names but the matched part is the
   page's own name at level `same` on a verified solo page. Everything else in the ladder is unchanged (famous,
   protected, unverified, draft, review flag).

When the person is a member and an `invited` credit exists for them, a claim only accepts it.

### People with no account yet

The uploader writes the name (`text`) and can tap "Invite" to get a link (`…/credit/<token>`). The link opens the app,
asks to sign in or make a page, and then shows the same Yes / Not me screen. The token is long, random, kept only as
a hash, valid 60 days, one use, and works only for the credit it was made for. A token never gives access to anything
but the confirmation.

### Settings of the person

"Who can add me to recordings" in "Your author page" settings: Everyone (default) / Nobody. "Blocked people" list with
Unblock. A person can see every credit on their page and take themselves off any of them, one by one.

### The team

- Team can add a credit to any page run by the team (deceased or unreachable performers), role `source=team`,
  confirmed without a message to the page owner (there is none).
- Team can remove any credit (reports: "This is not me", "Wrong person"): the credit goes to `removed` and the
  person is told.
- Reports: a person can report a credit on their page ("I am not on this recording") from the recording; that is a
  "Take me off" plus, if it was untrue and repeated, a flag for the team on the uploader (existing review flags).
- Takedown / removed / flagged recordings leave every page at once (status filter), credits stay in the log.

## Scenarios, A to Z

Upload
1. Solo upload, nobody else: unchanged.
2. Uploader performs and adds one member: invitation sent, recording on the uploader's page at once.
3. Uploader only shares someone else's recording and names the two real performers: invitations sent, the
   recording is the uploader's file but his page is not changed (his page rules stay as today, see "Left to the
   builder").
4. Uploader adds a person with no account: plain text, optional invite link.
5. Uploader tries an 11th person: "10 is the limit on one recording".
6. Uploader names the same person twice: "Already added".
7. Named person has `nobody` or blocked the uploader: the chip shows the message, name stays text.
8. Named page is suspended or deleted: cannot be chosen; deleted address answers "no such page".
9. Offline upload: the credits go with the upload and the invitations are sent when the server accepts it.
10. Same exact file already uploaded: the duplicate message gets a button "I am on this recording" (opens claim).

The person who was named
11. Opens the message, taps Yes: on their page, uploader told.
12. Taps Not me: nothing on their page, uploader told "did not confirm", name stays text.
13. Taps Not me, and don't let this person add me: block added.
14. Does not answer for 60 days: `expired`, name stays text, uploader told quietly.
15. Answers after it expired or after the uploader removed it: "This invitation is no longer open", with a button to
    claim it normally if it still matches them.
16. Wants to leave later: "Take me off this recording" (their page loses it, the credit goes to `removed`).
17. Wants to keep the credit but not show it on the page: hide (exclude link).
18. Was named as the wrong role: can change the role (Sings / Plays / Wrote it) before or after accepting.

The uploader afterwards
19. Adds a person later (same checks, same invitation).
20. Removes someone who has not answered: invitation cancelled, no message.
21. Removes someone who confirmed: not allowed from the app; the message says why and offers Report.
22. Edits the credit text by hand: names that are linked stay linked (the credit rows are the truth, the text is
    rebuilt); a typed name that matches no row becomes a text credit.
23. Deletes the recording: it leaves every page; credits are kept in the log.
24. Deletes the account: the recording stays in the library (author_id becomes null, today's rule); confirmed credits
    stay on the other pages; pending invitations expire.

Not a member yet
25. Opens the invite link: sign in or "Make my page", then Yes / Not me.
26. Link used twice / expired / for another account: clear message, no data shown about the recording beyond its title.
27. Joins later with no link and finds their name in the library: claims (the second door).

Claims
28. A and B on one credit, both claim: neither waits for the other (per person rule).
29. Two different pages claim the same single name: both go to the team (`taken_by_other`).
30. A claims, B was tagged by the uploader: B's page shows it after B confirms; A's claim is judged as today.

Team and safety
31. Team adds a credit to a page run by the team: confirmed at once.
32. Someone names a famous artist as a joke: the artist gets a message, says Not me, nothing appears. (This is why
    confirmation is required.)
33. A person is flooded with invitations: 30 per hour per member; blocks; `nobody` setting; team can suspend.
34. Takedown or flagged recording: gone from all pages; restored returns everywhere.

Display
35. Recording screen: credit line with links; page: tabs Wrote / Performs follow the role of the credit.
36. Plays and monthly listeners: every page counts all plays of the recording (as claims already do).
37. Page owner sees the state of every credit on their page; the owner of an uploaded recording sees credits and
    states in "My uploads".
38. Search by performer finds the recording under every confirmed person.
39. Web: the same recording is listed on each confirmed person's page; credit chips link to pages; pending/plain
    names are not links. Page title/JSON-LD list confirmed people only.
40. Languages: all strings in `apps/mobile/lib/i18n`, English first (as the rest).

## API

Upload `POST /recordings` accepts `performers: [{name, profile_id?, role}]`. New:
`GET /recordings/{id}/credits`, `POST /recordings/{id}/credits`, `DELETE /recordings/{id}/credits/{credit_id}`,
`GET /authors/me/credit-invites`, `POST /authors/me/credit-invites/{id}/accept|decline` (decline: `block: bool`),
`POST /authors/me/credits/{id}/leave`, `PUT /authors/me/credit-settings`, `GET|DELETE /authors/me/credit-blocks`,
`POST /credit-links/accept` (token in the body), `GET /authors/me/credits`, `PUT /authors/me/credits/{id}/role`,
`PUT /recordings/{id}/credits/{credit_id}/role`, `POST /recordings/{id}/credits/{credit_id}/link`,
admin: `POST /admin/recordings/{id}/credits`. The team removes with the same `DELETE /recordings/{id}/credits/{credit_id}`.
A credit added by the team (or on the uploader's own page) is confirmed at once: the team vouches for a page it runs.

## Tests

API: per scenario above (states, limits, checks, ladder per person, auto-approve of a pending claim, expiry job,
token one use, deletion of an account on both sides, takedown). Mobile: pure helpers (`lib/kirtan/credits.ts`),
the form block, the invitation notice, the recording credit line. Web mockup: screens drawn in dark and light.

## Left to the builder (my calls, marked)

- Job that expires invitations: reuse the existing housekeeping job (`docs/housekeeping.md`).
- 60 days, 10 credits, 30 invitations an hour are my numbers; each is one constant.
- A recording shared by a person who is not on it ("sharing"): today it lands on the sharer's page like any upload.
  I leave that as it is and do not change it here; it is a separate question for Dada (it affects "taking" too).
