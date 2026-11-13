# Release checks that need a phone or a console

Things the repository cannot prove. Each item says what to do and what "good" looks like. Code-side parts
of the same audit items are already in the repository.

## Before the next build

1. **EAS build numbers** (`eas.json` now uses `appVersionSource: remote` and `autoIncrement` for production).
   Once, from `apps/mobile`: `eas build:version:set -p ios` and enter the current iOS build number (140 or
   higher, whatever App Store Connect has), then the same for `-p android` (versionCode 110 or higher,
   whatever Play has). After that every production build increments by itself. Without this step the first
   build may reuse an old number.
2. **Sign in with Apple**: the entitlement is back (`usesAppleSignIn`). The App ID `net.prabhatasamgiita.ai` in
   the Apple Developer account must have "Sign in with Apple" enabled, otherwise the profile will not match
   the build. EAS regenerates the profile on the next iOS build (answer yes when asked).
3. **Android Google sign-in**: `docs/android-google-signin.md`.
4. **App Links**: `docs/app-links.md` (Play App Signing SHA-256 into `assetlinks.json`).
5. **Store forms**: `docs/play-data-safety.md` (AI processing by Azure OpenAI, consent, account deletion URL).

## On a real phone (smoke test, about 20 minutes)

| Check | Good looks like |
| --- | --- |
| Sign in with Apple on iPhone | sheet opens, the member is signed in; the button is absent on Android and web |
| Account deletion with the server key present and with it missing | success says deleted only after the server confirmed; failure shows an error and keeps the account |
| AI chat first question | consent sheet first; "Not now" sends nothing; revoke in Profile, settings |
| Android Back with any sheet open | the sheet closes, the screen does not |
| Android keyboard in sign-in, profile edit, feedback, assistant | field stays visible above the keyboard |
| Theme Auto on iOS | follows the system dark/light switch |
| Downloaded songs after an app update (iOS) | still play offline |
| Queue drag (`react-native-draggable-flatlist` 4.0.3 with Reanimated 4) | rows follow the finger, drop where released; if it jitters or crashes, replace with a Pan gesture |
| Lock screen controls, headset buttons, a call interrupting playback | play/pause/next work, playback resumes (RNTP is an alpha, see `docs/audio-migration.md`) |
| Live broadcast in Kiirtan | the YouTube player loads (no "Error 153") |
| Android 16 tablet / foldable emulator | see `docs/tablets-foldables.md` |
| Large font (iOS Larger Text max, Android font size 200 percent) | catalog rows, tab bar, chips do not clip |
| Android notifications | white notification icon, channel "Reminders" in the phone's language |
| Voice search on a phone without Google services | clear message, typing still works |

## Console checks

- **16 KB page size (Google Play)**: after uploading the AAB, Play Console, App bundle explorer, 16 KB
  support; or for an APK `zipalign -c -P 16 -v 4 app.apk`. Expo SDK 54 and React Native 0.81 are ready; the
  risk is a third-party native library (RNTP, google-signin, speech-recognition, webview).
- **iOS privacy report**: Xcode, Product, Archive, Generate Privacy Report; compare with
  `docs/ios-privacy-manifest.md`. Watch for ITMS-91053 emails after the upload.
- **Info.plist in the built .ipa**: `NSPhotoLibraryUsageDescription` should say "choose a profile picture",
  `NSMicrophoneUsageDescription` should say "voice search".

## Decided not to change in code (needs Dada)

- **Fonts through the expo-font plugin** (audit 31): the fonts are `@expo-google-fonts` packages loaded with
  `useFonts` and a short timeout. Embedding them at build time changes how the family names resolve on iOS
  (PostScript names) and cannot be checked without a native build, so it is left as is. If the first screen
  flashes a system font on slow phones, do it together with a device check of every `fontFamily`.
- **OTA updates with `expo-updates`** (audit 34): a product and process decision (adds a native module, a
  runtime version policy and an EAS Update channel). Without it every JavaScript fix goes through store review.
  Say if you want it and it becomes a separate task.
- **Reminders window** (audit 27): reminders are planned for 7 days ahead because their text depends on the
  song and the learner state. If the app is not opened for a week they stop. Android delivers them with
  inexact alarms, so a delay of a few minutes in Doze mode is normal. Daily or weekly repeating triggers would
  remove the 7-day window but cannot carry changing text. The channel name is now translated.
- **Dark splash screen**: needs light-on-dark artwork of the emblem (design).
