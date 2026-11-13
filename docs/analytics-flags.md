# Usage counts, feature flags and A/B tests

Plain words first. Everything lives in our own database, with no third-party analytics service and no
advertising identifier. Written 2026-11-09.

## What it is for

* **Usage counts**: which screens people use, how many start a recording upload and how many finish, where they give
  up in a wizard. Without this every product decision is a guess.
* **Feature flags**: a switch on the server that turns a feature on or off without a new app release, for some
  percentage of people, or only for test phones. Also the emergency "off" button for a feature that misbehaves.
* **A/B tests**: a flag with two or more variants, so half of the people see version A and half version B, and the
  counts say which works better.

## The privacy choice, in one paragraph

Three modes, chosen in the app under Profile, Usage data (`app/usage-data.tsx`):

| Mode | What is sent | Can events be linked to a phone |
| --- | --- | --- |
| **Anonymous** (default) | the events listed below, with app version, platform, interface language, and a random session id that lives until the app closes | **No.** There is no install id. The IP address is used only to limit abuse and is never stored with an event. |
| **Shared** | the same, plus a random install id (generated on the phone, not derived from hardware or account), kept on the server only as a short keyed hash | Yes, as "the same installation", never as a person. Needed to compare A and B fairly and to see repeat use. |
| **Off** | nothing; crash reports stop too | n/a |

Rules that hold in every mode, and that tests enforce:

* No account id, no email, no name, **no search words, no song or recording titles**, no free text. A string
  property must be a short lowercase token; anything else is dropped on the phone and again on the server.
* The list of allowed events and their properties is the same on both sides, and a test fails if the two lists
  drift apart (`apps/mobile/__tests__/analytics.test.ts`, `apps/api/tests/test_telemetry_flags.py`).
* Events older than **180 days** are to be deleted (`POST /admin/events/purge`; nothing calls it by itself yet, so run it monthly or ask me to add a schedule).
* Choosing "Off" is honoured at once: events waiting in the phone's short in-memory queue are dropped, not sent.

## Events (16)

`app_open`, `screen_view`, `search` (mode, has results, count: **not the words**), `song_open`, `play_start`,
`radio_start`, `radio_stop`, `upload_start`, `upload_step`, `upload_done`, `upload_fail`, `wizard_step`, `share`,
`error` (a short code, not a message), `consent_change`, `flag_exposure`.

Adding one: add it to `EVENT_SPEC` in `apps/mobile/lib/analytics/events.ts` **and** to `EVENTS` in
`apps/api/app/services/telemetry.py`, then run both test suites.

## Flags

A flag has: a key, a kill switch (`enabled`), a rollout percent, an optional app-version window, optional platforms,
optional variants with weights, and lists of install ids that always or never get it (your own phones).

How the server decides, per installation, with no randomness that changes between calls:

1. Kill switch off, or the platform or app version is outside the window: **off**.
2. The install is in the "never" list: off. In the "always" list: on.
3. Otherwise a stable bucket from 0 to 99 is computed from the flag key and the install id (SHA-256), and the flag is on
   when the bucket is below the rollout percent. **Raising the percent only adds people; nobody who had the feature
   loses it.** Anonymous mode has no install id, so a flag with a percent between 1 and 99 is off there; 100 means everyone. For the same reason an A/B test only splits people who chose **Shared** mode: every anonymous phone gets the same variant.
4. With variants, a second stable bucket picks the variant by weight.

The app asks `GET /flags`, keeps the answer for 10 minutes and across launches, and works from the stored answer
when offline. If the server never answered, the feature takes its built-in default. **An exposure event is logged once
per flag, only when the server really answered**, so A/B counts are not polluted by phones that never saw the flag.

Use in app code: see `apps/mobile/lib/flags/`.

## Reading an experiment

`GET /admin/experiments/{key}` returns, per variant, how many installations were exposed and how many then did the
goal event, with the plain counts and rates. It does **not** claim significance. Rule of thumb for Dada: do not
decide below a few hundred exposed installations per variant, and do not stop the test the first day the numbers
look good. A real statistical test can be added when there is traffic to need it.

## Admin interface

All under the admin key (`require_admin`): `GET /admin/flags`, `PUT /admin/flags/{key}`, `DELETE /admin/flags/{key}`,
`GET /admin/events/summary` (counts per event per day), `GET /admin/experiments/{key}`,
`POST /admin/events/purge`. There is no screen for this yet; I can add one under the Admin menu, or Dada can work
through the API docs page.

## Where Apple may disagree

Apple's App Review Guideline 5.1.1(ii) says an app that collects **usage data** needs the person's consent, and it
does not make an exception for "anonymous" (https://developer.apple.com/app-store/review/guidelines/ , read
2026-11-09). We chose "anonymous by default" because the data cannot be linked to a person and Dada preferred
enough data to run the app. A reviewer may still ask. Two ways out, both ready:

* Build the store version with `EXPO_PUBLIC_ANALYTICS_DEFAULT=off` (a line in `apps/mobile/.env.example`). New
  installs then start with counts off until the person turns them on in Usage data.
* Add a first-launch question. This touches the first screen, which is not in my scope; it is a decision for Dada.

Also answer the App Privacy questionnaire consistently with this (`docs/store-compliance.md`).

## Where the code is

| What | File |
| --- | --- |
| Tables `app_events`, `feature_flags` | `apps/api/app/models/app_telemetry.py`, migration `0053_app_events_and_flags` |
| Rules for events | `apps/api/app/services/telemetry.py` |
| Flag evaluation | `apps/api/app/services/feature_flags.py` |
| Endpoints | `apps/api/app/api/v1/telemetry.py` |
| App client | `apps/mobile/lib/analytics/`, `apps/mobile/lib/flags/`, `apps/mobile/stores/analyticsConsentStore.ts` |
| Screen | `apps/mobile/app/usage-data.tsx` |
