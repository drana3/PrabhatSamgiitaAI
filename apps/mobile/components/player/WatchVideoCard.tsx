import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Clapperboard, X } from "lucide-react-native"
import { WebView } from "react-native-webview"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { SongVideo } from "@/data/mock"
import { toInAppVideoEmbedUrl, YOUTUBE_EMBED_REFERER } from "@/lib/mediaEmbed"
import { usePlayerStore } from "@/stores/playerStore"

type Props = {
  video: SongVideo
  songNumber: number
  compact?: boolean
}

export function WatchVideoCard({ video, songNumber, compact = false }: Props) {
  const pauseAudio = usePlayerStore((s) => s.pause)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)

  const embedUrl = useMemo(
    () => video.embedUrl || toInAppVideoEmbedUrl(video.url),
    [video.embedUrl, video.url],
  )

  const webSource = useMemo(() => {
    if (!embedUrl) return null
    const isYoutube = /youtube\.com\/embed|youtube-nocookie\.com\/embed/i.test(embedUrl)
    if (!isYoutube) {
      return { uri: embedUrl, headers: { Referer: YOUTUBE_EMBED_REFERER } }
    }
    // HTML + baseUrl gives WKWebView a trusted HTTPS origin (fixes Error 153).
    const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<meta name="referrer" content="strict-origin-when-cross-origin"/>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%}</style>
</head><body>
<iframe
  src="${embedUrl}"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
  allowfullscreen
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
</body></html>`
    return { html, baseUrl: YOUTUBE_EMBED_REFERER }
  }, [embedUrl])

  const startInApp = useCallback(() => {
    if (!embedUrl) return
    pauseAudio()
    setLoading(true)
    setPlaying(true)
  }, [embedUrl, pauseAudio])

  const stop = useCallback(() => {
    setPlaying(false)
    setLoading(false)
  }, [])

  if (playing && embedUrl && webSource) {
    return (
      <View style={[styles.card, compact && styles.compact, styles.playerCard]}>
        <View style={styles.playerTop}>
          <Text style={styles.playingLabel} numberOfLines={1}>
            Watching in app · PS {songNumber}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close video" onPress={stop} hitSlop={8}>
            <X size={18} color={colors.white} />
          </Pressable>
        </View>
        <WebView
          source={webSource}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          onLoadEnd={() => setLoading(false)}
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url || ""
            // Stay on embed / about:blank — block watch pages and external navigations.
            if (url.startsWith("about:")) return true
            if (url.startsWith("data:")) return true
            if (/youtube-nocookie\.com\/embed|youtube\.com\/embed|\.mp4(\?|$)/i.test(url)) return true
            if (/googlevideo\.com|ytimg\.com|google\.com\/recaptcha|prabhatasamgiita\.net/i.test(url)) {
              return true
            }
            return false
          }}
        />
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={video.title}
      accessibilityHint={embedUrl ? "Plays this video inside the app" : "Video embed is unavailable"}
      disabled={!embedUrl}
      onPress={startInApp}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compact,
        !embedUrl && styles.disabled,
        pressed && embedUrl && { opacity: 0.94, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(20,14,10,0.1)", "rgba(20,14,10,0.72)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.badge}>
        <Clapperboard size={12} color={colors.white} />
        <Text style={styles.badgeText}>{embedUrl ? "Watch video" : "Unavailable"}</Text>
      </View>
      <View style={styles.playCenter}>
        <View style={styles.watchDisc}>
          <Clapperboard size={compact ? 18 : 24} color={colors.white} />
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.sub}>
          PS {songNumber} · {embedUrl ? "In-app video" : "No in-app embed yet"}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    height: 168,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm,
    marginBottom: spacing.md,
    ...softShadow(1),
  },
  compact: {
    height: 120,
    borderRadius: radius.lg,
  },
  playerCard: {
    height: 220,
    backgroundColor: "#111",
  },
  disabled: { opacity: 0.7 },
  badge: {
    alignSelf: "flex-start",
    margin: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(20,14,10,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  badgeText: {
    ...typography.caption,
    color: colors.white,
  },
  playCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing.xl,
  },
  watchDisc: {
    width: 56,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: "rgba(20,14,10,0.72)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  title: {
    ...typography.label,
    color: colors.white,
  },
  sub: {
    ...typography.caption,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  playerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  playingLabel: {
    ...typography.caption,
    color: colors.white,
    flex: 1,
    marginRight: spacing.sm,
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
})
