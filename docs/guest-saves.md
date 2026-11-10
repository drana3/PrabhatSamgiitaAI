# Guest saves and the sign-in prompts

Decision (Dada, 10 November 2026, board `онбординг-v2/index.html`, question G): a guest can save songs. They stay on
the device. The app offers sign-in at three moments, at most once a week for each kind. Signing in carries the guest's
saves into the account. Uploading and commenting still need an account; the prompt only offers one.

## What a guest can do

| Action | Guest | Where it is kept |
|---|---|---|
| Save a song ("Mine") | yes | `preferencesStore.savedSongIds`, mirrored in `favoritesByScope.guest`; never sent to the server |
| Save a Kiirtan | yes (was already so) | `kirtanStore.savedIds`, device only |
| Playlists | no, needs sign-in (unchanged) | |
| Upload, comment | no, needs sign-in (unchanged) | |

`save.alert.body` now speaks only about playlists, because saving songs no longer asks for sign-in.

## The three prompts

All three open the same sheet, `components/guest/GuestSignInSheet.tsx` (a `SpringSheet`; copy in
`locales/guestPrompt.ts`, keys `guest.saves.*`, `guest.upload.*`, `guest.comment.*`, `guest.signedIn.saved`).

| Kind | When | Entry point |
|---|---|---|
| `saves` | the guest now holds 3 or more saved songs and Kiirtans together, counted on a new save | `lib/save/saveActions.ts` calls `noteGuestSaved()` (`lib/guest/afterSave.ts`) |
| `upload` | the guest taps Upload in the floating tab bar | `components/nav-v2/FloatingTabBar.tsx` through `askGuestToSignIn("upload", ...)` |
| `comment` | the guest taps the sign-in button where the comment box would be | `components/comments/CommentsView.tsx` through `askGuestToSignIn("comment", ...)` |

Rules (`lib/guest/signInPrompt.ts`, `stores/guestPromptStore.ts`):

- Once a week per kind: `GUEST_PROMPT_WEEK_MS` (7 days). The time of the last showing of each kind is kept on the
  device (AsyncStorage key `prabhat-guest-prompts`, `{ log: { saves?, upload?, comment? } }`). The time is written when
  the sheet is actually shown, not when it was asked for.
- The kinds are independent: a `saves` prompt does not use up the `upload` week.
- If the device clock was set back, a stored time in the future counts as "shown", so the prompt waits instead of
  appearing every time.
- A signed-in person is never asked.
- Upload and comment: when the sheet is not allowed (shown less than a week ago) the action runs as before
  (Upload opens the Upload page, whose own gate still asks for an account; comment goes to the sign-in page).
  After the sheet is closed, `after` runs (the Upload page opens), so the prompt never blocks the person.
- `saves`: not shown while a song is playing; it waits up to 90 seconds (`SAVES_PROMPT_WAIT_MS`) for the music to stop
  and is then dropped without counting as shown. It also waits until the Save sheet is closed.
- A second tap while a sheet is on its way does not queue another one.

The sheet offers Apple, Google, e-mail (closes the sheet and opens the sign-in page) and "Not now". Apple and Google run
the same code as the Account screen (`signInWithAppleAccount`, `signInWithGoogleAccount`).

## What happens at sign-in (the merge)

The old behaviour lost the guest list: on sign-in the guest scope was set aside and never uploaded.

1. Songs. `lib/session.ts` `finishSignIn` binds the account; the guest list stays in `favoritesByScope.guest`.
   `preferencesStore.hydrateFavoritesFromServer` then reads the account's favourites, works out what the account lacks
   (`lib/guest/guestSaves.ts`: `unionIds`, `songNumbersOf`, `missingNumbers`) and sends it in one request,
   `POST /api/v1/members/favorites/merge`. If the server has no such route or the request fails it falls back to one
   `POST /favorites` per song. The guest list is cleared only when every song reached the account. If the account
   could not be read, nothing is cleared and the next sync sends it.
   The result is the union of the account's saves and the guest's: no duplicates, nothing lost, nothing removed.
2. Kiirtans. `lib/guest/mergeKiirtanSaves.ts` `mergeGuestKiirtanSaves()` runs right after the account is applied
   (`finishSignIn`): the Kiirtans saved as a guest are unioned into the account's list. A brand new account simply
   receives the guest's list through the ordinary owner switch.
3. A short message ("Saved songs are now on your account") follows a sign-in that came from the `saves` prompt.

### API

`POST /api/v1/members/favorites/merge`, body `{ "song_numbers": [int, ...] }` (each 1..5018, at most 5018 of them),
needs a member session. It adds the numbers the account lacks, never removes, ignores repeats, is idempotent, retries
once if two merges race on the unique `(user_id, song_number)` key, and returns the whole list of the account's song
numbers. No migration: it uses the existing `user_favorites` table (alembic head stays 0068).
Tests: `apps/api/tests/test_favorites_merge.py`. Client: `mergeMemberFavorites` in `packages/core/src/api.ts`.

## Tests (apps/mobile/__tests__)

- `guestSignInPrompt.test.ts`: the weekly rule, clock set back, damaged log, the 3rd-save rule, sheet texts in en, ru, es.
- `guestSaves.test.ts`: merge helpers; guest saves stay local; merge on sign-in (empty account, union, nothing to send,
  second sync does nothing, old server without the merge route, account unreachable, upload failure keeps the guest list);
  Kiirtan merge; the 3rd save asks (Kiirtans count, un-saving and signed-in people do not); the prompt store and its
  weekly limit.
- `authLifecycle.test.ts` and `guestFavoritesSignOut.test.ts` were updated: a guest save is now kept on the device.

## Not verified

- On a real iPhone or Android phone. Screenshots were taken in the web preview at 390 px, light and dark.
- Real Apple and Google sign-in with the sheet. The preview uses mock data, where the two buttons end in the preview's
  error message.
- On iOS the sheet opens in its own native layer (`Modal`) right after the Save sheet closes; the 380 ms delay was
  chosen by reasoning, not tried on a device.
- The merge against a live server with real accounts (only the test database was used).

## Doubts and choices to know about

- Saved songs and saved Kiirtans together make the count "3". Dada said "the 3rd saved song"; Kiirtans were included
  because the Save sheet treats both as "Mine". Easy to change in `guestSavedCount`.
- In the dark theme the quiet "Not now" button uses the app's gold accent text token, the board draws it orange.
- A guest who saves songs on two phones keeps two separate lists until each phone signs in; both are then merged.
