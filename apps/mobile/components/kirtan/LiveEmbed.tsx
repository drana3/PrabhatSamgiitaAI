import { useMemo } from "react"
import { StyleSheet, View } from "react-native"
import { WebView } from "react-native-webview"

import { youtubeEmbedUrl } from "@/lib/kirtan/live"
import { YOUTUBE_EMBED_REFERER, youtubeEmbedWebSource } from "@/lib/mediaEmbed"

/**
 * The official YouTube embed of a live broadcast, and nothing else of YouTube: no downloading and no
 * extraction of the stream. Native: the embed page inside react-native-webview (already a dependency).
 * The web version is LiveEmbed.web.tsx (an iframe).
 */
export function LiveEmbed({ youtubeId, title, width, height, radius }: { youtubeId: string; title: string; width: number; height: number; radius: number }) {
  // one source object per broadcast, so a re-render does not reload the player
  const source = useMemo(() => youtubeEmbedWebSource(youtubeEmbedUrl(youtubeId)), [youtubeId])
  return (
    <View style={[styles.box, { width, height, borderRadius: radius }]} accessible accessibilityLabel={`${title}, live video`}>
      <WebView
        source={source}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url || ""
          // stay on the embed page; never wander off to YouTube watch pages or other sites
          return url.startsWith("about:") || url.startsWith("data:") || /youtube(-nocookie)?\.com\/embed|googlevideo\.com|ytimg\.com|google\.com\/recaptcha/i.test(url) || url === YOUTUBE_EMBED_REFERER
        }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
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
