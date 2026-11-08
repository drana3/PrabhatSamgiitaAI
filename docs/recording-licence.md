# Licence for uploaded recordings: options and draft text

**This is a document and draft wording only. Nothing in the app or the upload form was changed.** The text is not
legal advice; a lawyer who knows the owner's country should read the chosen option before it goes live.
Written 2026-11-09.

## Where things stand

* The upload form has one checkbox, "I agree to the content rules" (`apps/mobile/locales/ugc.ts`, `ugc.add.terms`).
  The server stores that the person accepted, when, and which **terms version** (`recordings.terms_accepted_at`,
  `recordings.terms_version`; the server refuses an upload whose version differs from `RECORDING_TERMS_VERSION`,
  today `2026-11`).
* So the app records *that* someone agreed to rules, but there is **no written permission** to store, play,
  convert, cache offline and show a recording to other people. Without it, the app is relying on an implied
  permission, which is weak if an uploader later says "I never allowed that".
* On account deletion the recordings stay (the uploader link is set to NULL, the performer name the uploader typed
  stays). That is only defensible if people were told and agreed to it. The licence is where that is said.

## Two questions the text depends on

1. **Whose performance is it?** The uploader, a group, or someone else (a concert, a teacher). The uploader must
   confirm they have the right to share it.
2. **Whose composition is it?** Prabhat Samgiita and many Kiirtans are compositions with their own rights holders
   (for PS, Ananda Marga Publications and the PS authors' side). The licence from the uploader covers the
   **recording only**. Whether the app may show PS lyrics and play a performance of them is a separate permission
   that the owner of the app must have from the rights holder. This document does not settle it. Ask the owner.

## Three options

### Option 1: Minimal listening licence

The uploader keeps all rights and gives the app a non-exclusive, free licence to **store, stream and show the
recording inside the app and its website, and to keep an offline copy on a listener's phone**. Nothing else.

* Plus: simplest, easiest to explain, least to give away.
* Minus: does not cover technical work the app already does: converting the file, measuring loudness, making a
  short clip for a share card, keeping a backup copy. Strictly those need their own words.

### Option 2: Listening licence plus technical copies (recommended)

Option 1, plus: the app may make **technical copies** (converted format, loudness data, backup copies, a preview
clip of up to 30 seconds for sharing a link), may show the recording **after the account is deleted, under the
performer name the uploader entered**, until the person asks for removal. The uploader can ask for removal
at any time: the recording stops being shown and streamed within a stated time (for example 14 days); copies
already cached on listeners' phones, and backups, are removed at the next sync or by the end of the backup
retention (35 days, `docs/backups.md`).

* Plus: covers what the app really does; honest about backups and phones; supports the decision that
  recordings stay after the account is gone; the author keeps control through removal.
* Minus: a little longer; promises a removal time the team must keep.

### Option 3: Open licence chosen per recording (Creative Commons)

The uploader picks a Creative Commons licence (for example CC BY-NC-SA 4.0) and the recording may be reused by
anyone under it.

* Plus: fits a community, non-commercial library; lets others reuse and remix.
* Minus: **cannot be taken back** once others have copied the file; lets third parties do things the app cannot
  control; needs a licence picker, more screens, more explaining. Many Kiirtan singers would not want this. Not
  recommended as the default; could be an optional extra later.

## Recommendation

**Option 2.** It is close to what the app already does, it is honest about backups, offline copies and what stays
after deletion, and it keeps the author in control with a removal right. Add the open-licence picker later only if
authors ask for it.

## Checkbox wording

Keep the existing "content rules" checkbox and add a second one directly under it, **not pre-ticked**:

> I recorded or have the right to share this recording, and I allow Prabhat Samgiita AI to play it in the app and
> website as described in the Recording Terms. I can ask for it to be removed at any time.

"Recording Terms" is a link to the English text below (translations to follow; the English text is the one that
counts). The two boxes stay separate so the rules (behaviour) and the licence (rights) are not mixed.

Russian and Spanish wording for the checkbox, for review: 
* ru: "Я записал(а) это сам(а) или имею право им делиться, и разрешаю Prabhat Samgiita AI воспроизводить запись в приложении и на сайте на условиях Условий для записей. Я могу в любой момент попросить убрать её."
* es: "La grabé yo o tengo derecho a compartirla, y permito que Prabhat Samgiita AI la reproduzca en la app y en el sitio como se describe en las Condiciones de grabaciones. Puedo pedir que se retire en cualquier momento."

## Draft text: Recording Terms (English), version 2026-12

> **Recording Terms**
>
> **1. Your recording stays yours.** You keep all rights in the recording you upload. These terms do not transfer
> ownership.
>
> **2. What you tell us.** You confirm that you made the recording or have the right to share it, that anyone who
> performs in it agrees to it being shared, and that nothing in it breaks someone else's rights or the content
> rules.
>
> **3. What you allow.** You give Prabhat Samgiita AI a worldwide, free, non-exclusive licence to store, play and
> stream the recording in the app and on its website, to let listeners keep an offline copy on their device, to make
> technical copies (for example a different audio format, loudness data, and backups), and to make a short preview
> clip of up to 30 seconds to show when a link to the recording is shared. We do not sell the recording and we do
> not use it for advertising.
>
> **4. Credit.** The recording is shown with the performer name you entered.
>
> **5. Removing it.** You can ask us to remove the recording at any time from the recording page or by writing to
> the support address. We stop showing and streaming it within 14 days. Copies on listeners' devices and in backups
> are removed when the device next syncs and, for backups, within 35 days.
>
> **6. If you delete your account.** Your account and personal details are deleted. Your recordings are **not**
> deleted automatically: they stay in the library under the performer name you entered, until you ask for removal
> as in section 5. Your account is no longer linked to them.
>
> **7. Our right to remove.** We may remove a recording that breaks the content rules or someone else's rights.
>
> **8. Changes.** If we change these terms we will ask you to accept the new version for new uploads. Recordings
> already uploaded stay under the version you accepted.
>
> **9. Questions.** support address to be inserted by the owner. Governing law and courts: to be set by the owner
> with a lawyer.

## Technical note when it is adopted

* Set `RECORDING_TERMS_VERSION` to the new label (for example `2026-12`) **and** ship the app version that sends it
  in the same release. The server rejects an upload whose `terms_version` differs, so an old app would get an
  error on upload until it updates. A short overlap (accept both) can be added if needed.
* The app should read the version from the server (`GET` terms endpoint, `TermsOut`) and not hard-code it.
* The account-deletion page and the privacy page must repeat section 6 in plain words
  (`docs/store-compliance.md`, deletion checklist).
* Old recordings carry version `2026-11` (the rules only). Decide whether to ask existing authors to accept the new
  terms; without it, the removal-on-request promise should still be honoured for them.
* Needs a "remove my recording" path that is easy to find. The team's takedown route exists; a self-service
  button for authors is the best form of section 5.

## Questions for the owner

1. Does the app have permission from the rights holder to show Prabhat Samgiita lyrics and to host performances
   of them?
2. Option 2 as recommended, or a different one?
3. Which support address and which country's law?
4. Minimum age for uploaders (see `docs/store-compliance.md`)?
