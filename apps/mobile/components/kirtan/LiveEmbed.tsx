import { StyleSheet, View } from "react-native"
import { WebView } from "react-native-webview"

import { youtubeEmbedUrl } from "@/lib/kirtan/live"

/**
 * The official YouTube embed of a live broadcast, and nothing else of YouTube: no downloading and no
 * extraction of the stream. Native: the embed page inside react-native-webview (already a dependency).
 * The web version is LiveEmbed.web.tsx (an iframe).
 */
export function LiveEmbed({ youtubeId, title, width, height, radius }: { youtubeId: string; title: string; width: number; height: number; radius: number }) {
  return (
    <View style={[styles.box, { width, height, borderRadius: radius }]} accessible accessibilityLabel={`${title}, live video`}>
      <WebView
        source={{ uri: youtubeEmbedUrl(youtubeId) }}
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
