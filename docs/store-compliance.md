# Store forms: Apple App Privacy, Google Data Safety, age rating, user content

**Not legal advice.** This is a working checklist from the code and from the stores' public pages, read on
2026-11-09. The store forms change; when a question on the live form differs from this text, the form wins.
Existing material that this extends: `docs/play-data-safety.md` (deletion URLs, AI questions),
`docs/ios-privacy-manifest.md` (required-reason APIs), the privacy page `apps/web/app/privacy`.

## What the app collects, in one list

Taken from the code, not from memory. Where it changed since `docs/play-data-safety.md` was written, the row is marked new.

| Data | When | Linked to a person | Why | Where it goes |
| --- | --- | --- | --- | --- |
| Name, email, password hash, sign-in provider id | sign-up, sign-in | yes | account | our database (Neon) |
| Profile picture | only if the person chooses one | yes | profile | phone; provider URL for Google sign-in |
| AI questions and the last 12 chat messages | only after the person agrees | yes if signed in | answers | our server, then Azure OpenAI |
| Comments on songs | when written | yes (author shown to the team) | community | our database |
| Recordings (audio file, performer name, notes, terms accepted with time) | when uploaded | yes (uploader id; shown with the performer name the uploader typed) | community library | our server, bucket (`docs/storage.md`) |
| Reports and blocks | when used | yes | safety | our database |
| Usage counts (16 events, no text) (new) | anonymous by default, can be turned off | **anonymous mode: no.** shared mode: a random install id | improve the app | our database (`docs/analytics-flags.md`) |
| Crash and error reports (new) | only if a Sentry key is set and usage data is not off | no personal data (scrubbed) | fix faults | Sentry (`docs/observability.md`) |
| Push token (when the push feature is switched on) | after permission | yes | notifications | our database; Expo/Apple/Google push services |
| Voice search | on demand | no | search | the device's own speech service; nothing recorded is sent to us |

Not collected: location, contacts, advertising id, health data, financial data. No tracking across other
companies' apps or sites.

## Apple: App Privacy ("nutrition label")

Source: Apple, "App privacy details", https://developer.apple.com/app-store/app-privacy-details/ , read 2026-11-09.

Answers, matching the table above:

* **Data used to track you: none.** `NSPrivacyTracking` is false.
* **Data linked to you**: Contact info (name, email address), User content (other user content: AI questions, comments,
  audio recordings, photos if a profile picture is uploaded), Identifiers (user id; device id only if the push token
  counts as one in the form), all for App Functionality.
* **Data not linked to you**: Usage data (product interaction), Diagnostics (crash data). Say "not linked" **only
  because** anonymous mode has no install id. If the build starts in or defaults to Shared mode, move Usage data to
  "linked to you".
* Third-party partners: Azure OpenAI (AI), Sentry (if enabled), Expo push (if enabled). Declare what they receive.

Guideline **5.1.1(ii)**, https://developer.apple.com/app-store/review/guidelines/ (read 2026-11-09): collecting usage data
needs consent, with no stated exception for anonymous data. See `docs/analytics-flags.md`: ship the store build with
`EXPO_PUBLIC_ANALYTICS_DEFAULT=off`, or add a first-launch question. This is the most likely review question on
the whole list.

### Account deletion, Guideline 5.1.1(v) checklist

Apple requires that an app that lets you create an account lets you delete it **inside the app** and not only by
email.

- [x] In-app path: Profile, Delete account data; the app says "deleted" only after the server confirmed (`docs/play-data-safety.md`).
- [x] Server deletes the member row and the author page (`DELETE /api/v1/members/me`).
- [x] A public page explains it: `/delete-account`.
- [ ] **Say plainly what stays.** By the code, deleting the account sets the uploader link on recordings to NULL: the
  **recordings stay**, with the performer name the uploader typed. What happens to the person's comments was not checked here. The delete page and the
  privacy page must say this before the person confirms; Apple allows keeping data that the law or the service
  requires if it is disclosed, and a community library is arguably that. This is a product and legal decision for
  Dada, see `docs/recording-licence.md` (option "stay under the author's name").
- [ ] Offer a way to remove a recording on request (the team's takedown route exists; link it from the delete page).
- [ ] Sign in with Apple is required only if the app offers other third-party sign-in (Google). Check the sign-in
  screens: if Google sign-in is offered, another sign-in option that meets Apple's privacy conditions (Guideline 4.8) must be offered,
  usually Sign in with Apple. Whether the app's own email sign-in satisfies those conditions is for Apple to
  judge at review; read 4.8 on the guidelines page and decide before submitting.

### Guideline 1.2, user-generated content, checklist

Source: same guidelines page, section 1.2. An app with user content needs:

- [x] A filter or review before content shows. Recordings and comments are published first and reviewed after
  (decision recorded in `apps/mobile/docs/song-comments.md`); Apple accepts this when the other four are in place,
  but a reviewer can still object to "publish first". The fallback is review-before-publish for new members.
- [x] A way to report offensive content: `POST /song-comments/{id}/report`; reporting on recordings.
- [x] A way to block abusive users: author blocks for recordings (`/recordings/blocks`).
  Comments do not have a block yet; reports and team removal cover them. Add if a reviewer asks.
- [x] The developer acts on reports in a stated time: the team's review queues exist. **Write the promised time into
  the support page** (Apple's guideline asks for timely responses; a stated figure such as 24 hours is common). Do not promise what the team cannot keep.
- [x] Published contact information: add a support email to the privacy page and the store listing.
- [ ] Terms that say objectionable content is not tolerated, shown at the point of upload (the upload form already
  shows terms with a version; the wording is in `docs/recording-licence.md`).

## Google Play: Data safety

Source: Play Console Help, "Provide information for Google Play's Data safety section",
https://support.google.com/googleplay/android-developer/answer/10787469 , read 2026-11-09.

Add to the table in `docs/play-data-safety.md`:

| Data type | Collected | Shared | Purpose | Optional |
| --- | --- | --- | --- | --- |
| Audio files (uploaded recordings) | Yes | No (served publicly in the app) | App functionality | Yes, only if the person uploads |
| Photos: profile picture | Yes, if chosen | No | App functionality | Yes |
| App interactions (usage counts) | Yes | No | Analytics | Yes (Off switch) |
| Crash logs, diagnostics | Yes if Sentry is on | With a service provider (Sentry) | Analytics, app functionality | Follows the same Off switch |
| User IDs | Yes (account id; install id in Shared mode) | No | App functionality, analytics | Install id: optional |

Data **encrypted in transit**: yes. **Deletion request available**: yes, in-app and by URL
(`https://www.prabhatasamgiita.org/delete-account`). Say in the form that recordings may be kept after deletion
if that is the final decision.

User-generated content (Play policy, "User Generated Content"): needs in-app reporting, moderation and removal of
violating content; the same list as Apple 1.2 above satisfies it.

## Age rating

* **Apple**: the age-rating questionnaire was reworked in 2025 (new ratings 4+, 9+, 13+, 16+, 18+, and new questions
  about user-generated content, chat, and in-app controls). Answer the live form; do not copy answers from here.
  Expected answers: no violence, no gambling, no mature themes; user-generated content: **yes** (recordings and
  comments), with reporting and blocking; unrestricted web access: no; AI assistant: yes (see `docs/play-data-safety.md`).
  Source: https://developer.apple.com/help/app-store-connect/reference/age-ratings/ (read 2026-11-09).
* **Google**: IARC questionnaire in Play Console; same answers, user interaction yes, content shared by users yes.
* The brief for this work says both stores ask more questions about social and user-content features from
  September 2026. I could not retrieve a precise list on 2026-11-09; **open the forms in App Store Connect and
  Play Console and answer them with the checklists above**.

## Kids and COPPA

The app is **not for children**. Make that explicit so nobody has to guess:

* Apple: do not put the app in the Kids category. Age rating will come out as at least 13+ or 16+ because of user content.
* Google: in the Target audience section choose adults and teenagers, **not** "children under 13", and answer
  the families questions "no". Choosing a child audience would impose the Families policy and ad and SDK limits.
* The sign-up has no age gate today. The simplest honest step: add a line in the Terms ("you must be at least
  16 / 13 years old", pick the age that fits your country's rule; in the EU it is 13 to 16 depending on the
  country) and a checkbox at sign-up. Not added here, because it touches the auth layer.
* No advertising, no ad SDK, no tracking: this makes COPPA's strictest rules (about data collected for ads)
  moot, but they still apply if a child's data is knowingly collected; the age line above is the protection.

## Before submitting, in this order

1. Decide the analytics default for the iOS build (Dada).
2. Decide what happens to recordings on account deletion (Dada) and put it on the delete page and the privacy page.
3. Add the support email and the moderation response time to the privacy page and listing.
4. Fill App Privacy and Data Safety from the tables above.
5. Answer the age rating forms; set the target audience to adults and teens.
6. Make a screenshot of the in-app report and delete-account paths for the reviewer notes.
7. In the reviewer notes list a demo login if sign-in is required to reach the user-content features.
