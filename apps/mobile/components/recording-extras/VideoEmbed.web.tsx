import { createElement } from "react"
import { StyleSheet, View } from "react-native"

import { playerSrc, type VideoEmbed as Embed } from "@/lib/recordingVideos/embed"

/** The site's own embed in an iframe (web). Only the embed address is used: no downloading, no extraction. */
export function VideoEmbed({ embed, title, width, height, radius }: { embed: Embed; title: string; width: number; height: number; radius: number }) {
  return (
    <View style={[styles.box, { width, height, borderRadius: radius }]}>
      {createElement("iframe", {
        src: playerSrc(embed),
        title,
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
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
