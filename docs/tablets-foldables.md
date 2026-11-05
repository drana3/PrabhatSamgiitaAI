# Tablets, iPad and foldables

The layout is designed for a phone in portrait. Nothing in the app has a wide-screen layout yet
(`lib/theme.ts` has `maxContentWidth: 720`, not used anywhere).

## iOS

`ios.supportsTablet` is `false` in `app.json`. On iPad the app runs in iPhone compatibility mode (a phone-size
window), so App Review does not need 13" iPad screenshots and the phone layout is not stretched.
To ship a real iPad version later: set it to `true`, apply a content max width (720) in the root layout and the
tab bar, and add iPad screenshots in App Store Connect. This is a product decision for Dada.

## Android 16 (targetSdk 36, Expo SDK 54)

On screens 600dp and wider (tablets, unfolded foldables) Android 16 ignores `orientation: portrait` and
resizability restrictions. The app can open landscape and in a resizable window. Phone-width layouts then
stretch. Not changed in code, because a safe global width cap needs a device check: about 19 files read
`useWindowDimensions` or `Dimensions` and would have to follow the capped width.

Test before claiming support: Pixel Tablet and Pixel Fold emulators (Android Studio, API 36), rotate,
split screen, unfold. Check the tab bar, mini player, sheets and the Songs list.

Plan if it looks bad (about 1 day): wrap the root layout in a centered column
(`maxWidth: theme.maxContentWidth`), make every `useWindowDimensions` consumer read the column width from one
context, then re-test. Google Play only labels the app "large screen ready" after this; phones are not affected.
