import TrackPlayer from "react-native-track-player"

TrackPlayer.registerPlaybackService(() => require("./playbackService").playbackService)

import "expo-router/entry"
