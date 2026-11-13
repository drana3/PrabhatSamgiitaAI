# CarPlay, Android Auto, AirPlay, Chromecast: an honest list

Nothing here is built or tested. No code was added for these, because every one needs a native build and a real device or car unit to check, and a half-done native change can break the lock screen and background playback. This page says what each needs and what to check on a device. Statements from the library's documentation are marked "docs" and were not run by us.

Current state: the app plays through `react-native-track-player` `5.0.0-alpha0` on a development or EAS build. Expo Go cannot run it.

## Common first step: the player package

The v5 line moved to the commercial package `@rntp/player` (license: free for personal and educational use only, per its page). CarPlay, Android Auto and Cast APIs described in the v5 docs belong to that line. Decide the license and the package move first; the alpha we use may not have these APIs.

- https://rntp.dev/docs/android-auto
- https://rntp.dev/docs/casting

## AirPlay (iPhone to speakers or Apple TV)

- docs: works out of the box in v5; the package has `AirPlayButton` and `OutputDeviceButton`.
- The iPhone system route picker (Control Center, lock screen) already lists AirPlay devices for any app that plays audio in a normal audio session; the in-app button is a convenience.
- Check on a device: start a song, choose an AirPlay speaker from the lock screen, confirm the sound moves, that pause and next from the speaker work, and that the volume leveling still sounds right (the volume is scaled in the app, not on the speaker).
- Needs: a build with the v5 package for the button. Cost: low.

## Chromecast (Android phone to Cast device)

- docs: Android only in v5. Needs a Cast Options Provider in the native code. A track whose URL is a local `file://` path cannot be cast (the Cast device cannot read the phone's files); remote HTTPS tracks can.
- Our offline downloads are local files, so they would not cast. Streamed songs and recordings would.
- Alternative: `react-native-google-cast` (https://react-native-google-cast.github.io/docs/getting-started/setup). It is a separate sender; it would need the queue, the position and the volume leveling mapped by hand.
- Check on a device: a Cast device on the same Wi-Fi; start a streamed song, cast it, pause and seek from the phone, check what happens to leveling (the Cast device plays the file at its own volume; our gain is applied in the phone and would not carry over), and to the sleep timer.
- Needs: Android build, Google Cast SDK app id (a default receiver is enough for audio), the Options Provider. Cost: medium.

## Android Auto

- docs: `setBrowseTree` gives the car screen a list to browse; needs `automotive_app_desc.xml` and a manifest meta-data entry.
- We would need to decide the browse tree (Radio channels, Saved, Recently played, Kiirtan, Prabhat Samgiita) and make the Radio start from a car tap.
- Check: the Android Auto desktop head unit (DHU) from the SDK, then a real car. Check that the lock-screen controls and the car controls show the same track, that the queue survives a phone call, and that the sleep timer and "end of track" hold still behave.
- Needs: Android build. Google reviews audio apps for Android Auto when you publish to the Play Store; the review criteria were not verified here. Cost: medium.

## CarPlay

- docs: needs the CarPlay Audio capability and an entitlement from Apple (request: https://developer.apple.com/contact/carplay/), a two-scene `Info.plist` and a phone scene delegate. Approval criteria and time are not verified.
- Without the entitlement a build cannot ship, and the Simulator's CarPlay window will not show the app.
- Check: the Xcode CarPlay simulator (after the entitlement is in the provisioning profile), then a real car or head unit. Same list as Android Auto: browse tree, same track as the lock screen, calls, interruptions.
- Needs: EAS build with a custom config plugin that edits `Info.plist` and adds the scene delegate; an Apple account with the entitlement. Cost: high; the entitlement is the long pole.

## What could be done without a phone

Only preparation: decide the browse tree, write the config plugin behind an off-by-default flag, and add tests for the plugin's output files (the plist and the manifest text). It must change nothing in a normal build while the flag is off. We did not do this yet, because without the package decision above the plugin could target the wrong API.

## Order we would suggest

1. Decide the player package and license.
2. AirPlay button (smallest, most value for iPhone users).
3. Android Auto (the DHU is free and checks most of it without a car).
4. Chromecast for streamed tracks.
5. CarPlay (start the entitlement request early; it is waiting time, not work).
