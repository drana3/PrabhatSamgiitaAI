import { createElement } from "react"
import { StyleSheet, View } from "react-native"

import { youtubeEmbedUrl } from "@/lib/kirtan/live"

/**
 * The official YouTube IFrame embed of a live broadcast (web). Only the embed address is used: no
 * downloading, no extraction of the stream.
 */
export function LiveEmbed({ youtubeId, title, width, height, radius }: { youtubeId: string; title: string; width: number; height: number; radius: number }) {
  return (
    <View style={[styles.box, { width, height, borderRadius: radius }]}>
      {createElement("iframe", {
        src: youtubeEmbedUrl(youtubeId),
        title,
        allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
        allowFullScreen: true,
        referrerPolicy: "strict-origin-when-cross-origin",
        style: { width: "100%", height: "100%", border: 0, display: "block" },
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: "#0A0E08" },
})
