# Age confirmation at sign-up (minimum age 16)

Store requirement. The minimum age is **16** (`docs/decisions-security.md`, part 6). Written 2026-11-10.

## What a person sees

| Where | What |
|---|---|
| Website, "Create account" tab (`apps/web/components/email-auth-panel.tsx`) | A checkbox "I'm 16 or older, and I agree to the Terms and Privacy policy". Not pre-ticked. Without it the form does not send and says so. |
| App, create account with e-mail (`app/onboarding/email.tsx`, `app/signin/index.tsx`) | The checkbox "I'm 16 or older" (`components/auth/AgeConfirm.tsx`). Not pre-ticked. Create account without it shows the box in red and the sentence "Tick the box to confirm you are 16 or older." |
| App, Apple / Google buttons (`app/onboarding/signin.tsx`, `app/signin/index.tsx`, `components/guest/GuestSignInSheet.tsx`) | A line under the buttons: "By continuing you confirm you are 16 or older." No checkbox: pressing the button is the confirmation. |
| Signing in to an existing account | Nothing. |
| Terms page (`/terms`) | States the minimum age. The About screen links to Terms and Privacy. |

Web Google / Microsoft buttons have no line (not asked for). Add one in `apps/web/app/signin/page.tsx` if wanted.

## What the server does

`POST /api/v1/auth/register` accepts `age_confirmed` (boolean, optional).

| Request | Answer |
|---|---|
| `age_confirmed: true` | account is created |
| `age_confirmed: false` | **422** "You must be 16 or older to create an account." Nothing is created. |
| field missing or `null` | accepted (an old app build has no tick) **unless** `REQUIRE_AGE_CONFIRMATION=true`, then 422 |

**Backwards compatibility (the choice).** The store requirement is that a new account confirms the age. Builds already
on phones cannot send the field, and refusing them would stop all e-mail sign-ups until people update. So a missing field is
accepted by default, and the new app and website builds always send `true`. When the old builds are gone (after the forced
update, `docs/forced-update.md`), set `REQUIRE_AGE_CONFIRMATION=true` and a missing field is refused too. An explicit
`false` is refused in both modes.

**Not stored.** `user_accounts` has no age or "age confirmed at" column, and this work adds no migration, so the answer is
only checked, not kept. If a record is wanted later (the time of the tick), add a nullable `age_confirmed_at` column to
`user_accounts` in a migration and set it in `register_local_user` (`app/services/local_auth.py`).

Apple and Google sign-in (`/members/session/exchange`) are not checked on the server: the notice under the buttons is the
confirmation.

## Tests

API `tests/test_age_confirmation.py`; web `tests/email-auth-panel.test.tsx`; app `__tests__/ageConfirm.test.ts`,
`__tests__/authLifecycle.test.ts`. ru / es words (`locales/legal.ts`) are marked unreviewed in `locales/review.json`.
