import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { StyleSheet, View } from "react-native"

import type { EmbedHandle, EmbedProps } from "@/components/kirtan/embedTypes"
import { commandMessage, LISTEN_MESSAGE, parseEmbedMessage } from "@/lib/kirtan/iframeApi"
import { youtubeEmbedUrl } from "@/lib/kirtan/youtube"

/**
 * The official YouTube embedded player in an iframe. Control and state go through the IFrame
 * player's postMessage interface (enablejsapi=1). Nothing is downloaded or read from the stream.
 */
export const YouTubeEmbed = forwardRef<EmbedHandle, EmbedProps>(function YouTubeEmbed({ videoId, startSeconds, autoplay, onEvent }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null)
  const handler = useRef(onEvent)
  handler.current = onEvent

  const post = (message: string) => frame.current?.contentWindow?.postMessage(message, "*")

  useImperativeHandle(ref, () => ({
    play: () => post(commandMessage({ func: "playVideo" })),
    pause: () => post(commandMessage({ func: "pauseVideo" })),
    seekTo: (seconds) => post(commandMessage({ func: "seekTo", seconds })),
  }))

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      const parsed = parseEmbedMessage(event.data)
      if (parsed) handler.current?.(parsed)
    }
    window.addEventListener("message", listen)
    return () => window.removeEventListener("message", listen)
  }, [])

  const origin = typeof window !== "undefined" ? window.location.origin : undefined
  const src = youtubeEmbedUrl(videoId, { origin, startSeconds, autoplay })

  return (
    <View style={styles.fill}>
      {createElement("iframe", {
        key: videoId,
        ref: frame,
        src,
        title: "YouTube video player",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        allowFullScreen: true,
        referrerPolicy: "strict-origin-when-cross-origin",
        onLoad: () => post(LISTEN_MESSAGE),
        style: { border: 0, width: "100%", height: "100%", display: "block" },
      })}
    </View>
  )
})

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: "#000000" } })
