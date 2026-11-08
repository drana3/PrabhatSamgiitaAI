import { useMemo } from "react"
import { StyleSheet, View } from "react-native"
import { WebView } from "react-native-webview"

import { YOUTUBE_EMBED_REFERER, youtubeEmbedWebSource } from "@/lib/mediaEmbed"
import { embedMayLoad, playerSrc, type VideoEmbed as Embed } from "@/lib/recordingVideos/embed"

/**
 * A member's video link, played by the site's OWN embed and nothing else (docs/kiirtan-video.md): no downloading, no
 * extraction of the stream, no wandering off to the site's watch page. Native: the embed page in react-native-webview.
 * The web version is VideoEmbed.web.tsx (an iframe). The player is gone when this component is (closing the video, leaving
 * the page, the app going to the background), so nothing plays in the background.
 */
export function VideoEmbed({ embed, title, width, height, radius }: { embed: Embed; title: string; width: number; height: number; radius: number }) {
  // one source per video, so a re-render does not reload the player
  const source = useMemo(() => (embed.provider === "youtube" ? youtubeEmbedWebSource(playerSrc(embed)) : { uri: playerSrc(embed) }), [embed])
  return (
    <View style={[styles.box, { width, height, borderRadius: radius }]} accessible accessibilityLabel={title}>
      <WebView
        source={source}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) => embedMayLoad(embed.provider, request.url || "") || request.url === YOUTUBE_EMBED_REFERER}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        scrollEnabled={false}
        style={styles.fill}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: "#0A0E08" },
  fill: { flex: 1, backgroundColor: "#0A0E08" },
})
