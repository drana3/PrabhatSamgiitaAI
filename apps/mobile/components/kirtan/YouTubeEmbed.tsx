import { forwardRef, useImperativeHandle, useMemo, useRef, type ComponentType } from "react"
import { Linking, StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import type { EmbedHandle, EmbedProps } from "@/components/kirtan/embedTypes"
import { amFonts } from "@/constants/tokens/amTypography"
import { YOUTUBE_EMBED_REFERER } from "@/lib/mediaEmbed"
import { commandMessage, LISTEN_MESSAGE, parseEmbedMessage, type EmbedCommand } from "@/lib/kirtan/iframeApi"
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/kirtan/youtube"

type WebViewLike = ComponentType<Record<string, unknown>> & { prototype: { injectJavaScript?: (code: string) => void } }

/** react-native-webview is already a dependency; if the native module is missing the screen offers YouTube instead. */
function loadWebView(): WebViewLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("react-native-webview") as { WebView: WebViewLike }).WebView
  } catch {
    return null
  }
}

const ORIGIN = YOUTUBE_EMBED_REFERER.replace(/\/$/, "")

/** A small page that holds YouTube's own iframe and forwards its messages to the app. */
function pageHtml(embedSrc: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe id="p" src="${embedSrc.replace(/"/g, "&quot;")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe><script>
var f=document.getElementById('p');
f.addEventListener('load',function(){f.contentWindow.postMessage(${JSON.stringify(LISTEN_MESSAGE)},'*')});
window.addEventListener('message',function(e){if(e.source===f.contentWindow){window.ReactNativeWebView.postMessage(typeof e.data==='string'?e.data:JSON.stringify(e.data))}});
window.__cmd=function(m){f.contentWindow.postMessage(m,'*')};
</script></body></html>`
}

/**
 * Native: YouTube's official embedded player inside a WebView (react-native-webview). Control and
 * state go through the IFrame player's postMessage interface. If the WebView cannot load, a
 * "Watch on YouTube" button opens the video in YouTube.
 */
export const YouTubeEmbed = forwardRef<EmbedHandle, EmbedProps>(function YouTubeEmbed({ videoId, startSeconds, autoplay, onEvent }, ref) {
  const WebView = useMemo(loadWebView, [])
  const view = useRef<{ injectJavaScript: (code: string) => void } | null>(null)
  const handler = useRef(onEvent)
  handler.current = onEvent

  const send = (command: EmbedCommand) => view.current?.injectJavaScript(`window.__cmd(${JSON.stringify(commandMessage(command))});true;`)
  useImperativeHandle(ref, () => ({
    play: () => send({ func: "playVideo" }),
    pause: () => send({ func: "pauseVideo" }),
    seekTo: (seconds) => send({ func: "seekTo", seconds }),
  }))

  const html = useMemo(() => pageHtml(youtubeEmbedUrl(videoId, { origin: ORIGIN, startSeconds, autoplay })), [videoId, startSeconds, autoplay])

  if (!WebView) {
    return (
      <View style={styles.fallback}>
        <KPress accessibilityRole="button" accessibilityLabel="Watch on YouTube" onPress={() => void Linking.openURL(youtubeWatchUrl(videoId))} pressedScale={0.97} style={styles.watch}>
          <Text style={styles.watchText}>Watch on YouTube</Text>
        </KPress>
      </View>
    )
  }

  return (
    <View style={styles.fill}>
      <WebView
        ref={view as never}
        key={videoId}
        source={{ html, baseUrl: YOUTUBE_EMBED_REFERER }}
        originWhitelist={["*"]}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        scrollEnabled={false}
        style={styles.fill}
        onMessage={(event: { nativeEvent: { data: string } }) => {
          const parsed = parseEmbedMessage(event.nativeEvent.data)
          if (parsed) handler.current?.(parsed)
        }}
        // Stay inside YouTube's player: a link out opens in the browser or the YouTube app instead.
        onShouldStartLoadWithRequest={(request: { url: string }) => {
          const url = request.url
          if (url === "about:blank" || url.startsWith(ORIGIN) || /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//.test(url)) return true
          if (/^https?:\/\//.test(url)) void Linking.openURL(url)
          return false
        }}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000000" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000000" },
  watch: { height: 48, paddingHorizontal: 24, borderRadius: 70, backgroundColor: "#F67931", alignItems: "center", justifyContent: "center" },
  watchText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20, color: "#FFFFFF" },
})
