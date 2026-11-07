// The playback service must be registered before the app starts: on Android, after the app is
// swiped away, the notification buttons start this headless task without any screen mounted.
try {
  // The web preview has no native player; loading its module there throws and shows the red error screen.
  if (require("react-native").Platform.OS === "web") throw new Error("no native player on web")
  const TrackPlayer = require("react-native-track-player").default
  TrackPlayer.registerPlaybackService(() => require("./playbackService").playbackService)
  globalThis.__psPlaybackServiceRegistered = true
} catch {
  // Web preview and tests have no native player.
}

// require, not import: imports are hoisted above the registration.
require("expo-router/entry")
