const { withAndroidManifest } = require("@expo/config-plugins")

const MUSIC_SERVICE = "com.doublesymmetry.trackplayer.service.MusicService"

/** Ensure RNTP MusicService is declared for Android 14+ media foreground playback. */
function withTrackPlayerAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults
    const application = manifest.manifest.application?.[0]
    if (!application) return mod

    application.service = application.service ?? []
    const services = application.service
    const existing = services.find((entry) => entry.$?.["android:name"] === MUSIC_SERVICE)
    if (existing) {
      existing.$ = {
        ...existing.$,
        "android:exported": "false",
        "android:foregroundServiceType": "mediaPlayback",
      }
    } else {
      services.push({
        $: {
          "android:name": MUSIC_SERVICE,
          "android:exported": "false",
          "android:foregroundServiceType": "mediaPlayback",
        },
      })
    }
    return mod
  })
}

module.exports = withTrackPlayerAndroid
