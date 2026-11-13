# iOS privacy manifest (required-reason APIs)

Apple rejects uploads whose code (including libraries) calls "required reason" APIs without a declared reason
(email ITMS-91053). The reasons are declared in `apps/mobile/app.json` under `expo.ios.privacyManifests`; Expo
writes them into the app's `PrivacyInfo.xcprivacy` at prebuild. They are the aggregate for the app and for
dependencies that ship no manifest of their own.

| Category | Reason | Why it applies |
| --- | --- | --- |
| FileTimestamp | C617.1 | file metadata inside the app container (offline audio, caches, AsyncStorage) |
| UserDefaults | CA92.1 | app-only preferences (React Native, Expo, AsyncStorage) |
| SystemBootTime | 35F9.1 | elapsed-time measurement (React Native, animation and audio timing) |
| DiskSpace | E174.1 | disk size and free-space calls inside expo-file-system (app code does not call them directly; declared for the dependency) |

No data is collected for tracking; `NSPrivacyTracking` stays false (Expo default). Data the app collects is
listed in `docs/play-data-safety.md` (also used for the App Privacy answers).

Check after a build: unzip the `.ipa`, open `Payload/*.app/PrivacyInfo.xcprivacy`, confirm the four categories.
If App Store Connect still reports a missing reason, add the category named in the email to `app.json`.
