# First-run onboarding (mobile app)

What a new person sees on the first launch, how it is stored, and how to change it. Approved design:
the board `Для-Дады/онбординг-v2` (Carousel folder) and the decisions of 9 and 10 November 2026
(`Для-Дады/решения-2026-11-09.md`, sections "Онбординг" and "10 ноября: упрощение онбординга").

## The path

```
Welcome ──Get started──> 1 Language ──> 2 Sign in ──> 3 What is inside ──> Kiirtan tab (+ one-time hint)
   │                                        │ guest / Apple / Google / email
   └──I have an account──> Sign in ──> "Your songs are back" ──> Kiirtan tab (+ one-time hint)
```

- **Welcome** (`app/welcome.tsx`): the dawn photo under a scrim, "Music for the inner dawn", one sentence with the
  song count (`PS_SONG_COUNT`, from the data), "Get started", "I have an account", "No account is needed to listen."
  No logo, no app-name line, no web address. The language label on the top right opens the Language sheet at once
  (so a person who does not read English is never stuck).
- **Step 1 Language** (`app/onboarding/language.tsx`): English, Русский, Español, a tap applies at once. English is
  chosen at first. No Skip.
- **Step 2 Sign in** (`app/onboarding/signin.tsx`): Apple, Google, "Continue with email" (`email.tsx`: address,
  then password, or "Create an account" with name, email, password), "Continue as guest". The link "What happens
  when I sign in" opens a short sheet (`what.tsx`). A person who closes the Apple or Google window gets no error.
  No Facebook, no Microsoft, no phone number anywhere.
- **Step 3 What is inside** (`inside.tsx`): six rows, "Step 3 of 3", no Skip. Continue ends the onboarding.
- **Your songs are back** (`back.tsx`): after "I have an account" and a sign-in. Counts saved songs and Kiirtans,
  playlists and words to review; with nothing yet it says so in one sentence.
- **The Kiirtan hint** (`components/onboarding/KiirtanHintHost.tsx`, mounted once in `app/_layout.tsx`): the page dims
  and a card says "Every Kiirtan has its own page". Shown once, on the Kiirtan tab only; "Got it" or a tap on the dim
  closes it for good.

There is no notifications step, no "Help us improve" (usage data) step, no theme step and no "Start with one" step.
Reminders are set in the notification settings in Profile, usage data in Profile > Usage data, the theme in Profile > Appearance.

## Who sees it

`authStore.hasCompletedWelcome` stays the one "welcome is finished" flag. A person with it set (everyone who
installed before this onboarding existed, and everyone who finished it) never sees the onboarding: `app/index.tsx`
asks `entryRoute()` (`lib/onboarding/flow.ts`) and goes straight to the app. After a sign-out the flag is cleared,
so the welcome screen shows again (the stored step is `done`, which starts at the welcome screen).

## State keys

| Key (AsyncStorage / localStorage) | Holds | Written by |
| --- | --- | --- |
| `prabhat-auth` → `hasCompletedWelcome` | the welcome is finished | `useFinishOnboarding` (end of the path), the sign-in page |
| `prabhat-onboarding` → `step` | `welcome`, `language`, `signin`, `inside` or `done`: where the person is, so a mid-flow close reopens on the step | each screen |
| `prabhat-onboarding` → `returning` | the person came in through "I have an account" | Welcome, "I am new here" |
| `prabhat-onboarding` → `kiirtanHintPending` / `kiirtanHintSeen` | the hint is waiting / it was shown and closed (never returns) | end of the path / "Got it" |
| `prabhat-appearance` → `appearance`, `appearanceSettled` | the theme choice; `appearanceSettled` marks that the default was decided once | `lib/appearance.ts` |
| `prabhat-language` | the interface language | `stores/languageStore.ts` |

## Theme default

New installs follow the device (Auto). An install that already finished the old welcome keeps what it had
(Light unless it chose otherwise): `settleAppearance()` pins it once at the first launch of this version, using
`hasCompletedWelcome`. The shell waits for that before the first frame, so nothing flashes. Profile >
Appearance still offers Light, Dark and Automatic.

## Languages

The lists of the Language sheet (Profile) and of step 1 both come from `offeredLanguages()` in `lib/i18n/registry.ts`.
Hindi, Traditional Chinese, Brazilian Portuguese and Korean are hidden because they are not translated yet.

To turn a language on: set `complete: true` on its entry in `LANGUAGE_REGISTRY` (`lib/i18n/registry.ts`) once its
words are translated and checked (`locales/review.json` has no `false` left for it). Both lists show it at once.
For a developer build, `EXPO_PUBLIC_SHOW_ALL_LANGUAGES=1` shows all of them. A person whose stored language is
hidden keeps that choice; the app shows English until the language is finished again.

## Words

`locales/onboarding.ts` (keys `onb.*`), English first, Russian and Spanish mirror it. Russian and Spanish are
flagged `false` in `locales/review.json` until a person has read them. In English text it is always "Kiirtan"
with two i's.

## Colours and contrast

The dark-theme corrections accepted on the board are in `constants/tokens/amColors.ts` (muted `#9B958D`,
`trackOff`, `lineStrong`, `controlOn`, `controlOnDot`). `__tests__/onboardingContrast.test.ts` computes every
text/background and control/background pair of the board in both themes from the real tokens (4.5:1 for text,
3:1 for control parts).

## Preview in the browser

With `EXPO_PUBLIC_MOCKUP_DATA=1` the sign-in buttons show but never call Apple or Google; they end in a quiet
error. Handy addresses: `/welcome`, `/onboarding/language`, `/onboarding/signin` (`?returning=1`, `?state=error`),
`/onboarding/email` (`?stage=password`, `?stage=signup`), `/onboarding/inside`, `/onboarding/back`.

## Not done on purpose

- A person who signs in with Apple without sharing a name is not sent to the "name" page from the onboarding;
  the name can be set later in Profile > Edit profile.
- The server may report that a phone number is missing; the onboarding never asks for one.
- Microsoft sign-in is not offered in the onboarding (it stays on the Sign in page of the app).

## Tests

`__tests__/onboardingFlow.test.ts` (steps, routes, who sees it, returning path, hint rules, no phone or removed
steps), `__tests__/hiddenLanguages.test.ts`, `__tests__/appearance.test.ts`, `__tests__/onboardingContrast.test.ts`.
