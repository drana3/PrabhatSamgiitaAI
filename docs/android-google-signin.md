# Android: Google sign-in setup (Play App Signing)

Why this exists: on a build installed from Google Play, Google Sign-In fails with `DEVELOPER_ERROR` (code 10)
unless the Android OAuth client in Google Cloud knows the SHA-1 of the key that **Google Play** signs the app with.
That key is not the upload key and not the EAS key. The app no longer tries a browser fallback (Google rejects the
`prabhatai://` redirect for Web clients, so it could never work). On this error the member now sees
"Google sign-in isn't available in this build yet. Use another sign-in method."

Project values:

- Package name: `net.prabhatasamgiita.ai`
- Google Cloud project number: `495992354696`
- Android OAuth client id (in `app.json` `extra.googleAndroidClientId`): `495992354696-bg5emq0rv8hv4bqgk8uanvi2vkj34alv`
- Web client id (used as `webClientId`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`): `495992354696-e0gs1mfnndgh9d38nkmp211f43im1h9q`

## Steps (Dada does these, they need console access)

1. Play Console, open the app, then **Test and release, Setup, App signing**.
   Copy **SHA-1 certificate fingerprint** from the section "App signing key certificate".
   If a second "post-quantum / new signing key" block is shown, copy its SHA-1 too.
2. Also copy the **Upload key certificate** SHA-1 (same page). It is only needed for sideloaded builds made with the upload key.
3. Google Cloud console, project `495992354696`, **APIs and Services, Credentials**.
   For each fingerprint you copied, create one **OAuth client ID** of type **Android**:
   - Package name: `net.prabhatasamgiita.ai`
   - SHA-1: the fingerprint
   (An Android client holds exactly one SHA-1, so you need one client per key.)
   Do not delete the existing client; it covers the EAS/internal-testing key.
4. Check the **Web application** client (`...e0gs1mfn...`) still exists in the same project. The app passes it as `webClientId`.
5. No rebuild is needed after adding clients. Wait a few minutes, then test on a Play internal-testing install.
6. Optional: `scripts/android-google-sha1.sh path/to/app.aab` prints the SHA-1 and SHA-256 of an `.aab`/`.apk`
   you built yourself (that is the upload key or the EAS key, never the Play key).

## What the EAS build key is

`eas credentials` shows the keystore EAS uses for Android builds. Its SHA-1 covers APKs installed directly
(internal distribution). Add it as another Android client if you test EAS APKs.

## `google-services.json`

`@react-native-google-signin/google-signin` does not need `google-services.json` when `webClientId` is passed in
`configure()` (the app does). Add the file only if you later enable Firebase.

## Checks

- Google Play install fails with code 10: a fingerprint is missing (step 1 and 3).
- Works on EAS APK but not on Play: only the EAS fingerprint is registered.
- "Google Play Services is required": the device has no Play Services; use another sign-in method.
