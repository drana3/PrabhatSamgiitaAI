import { useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"

import { Button } from "@/components/comments/CommentsView"
import type { SpTheme } from "@/constants/tokens/amSong"
import { useT } from "@/lib/i18n"
import type { VideoEmbed as Embed } from "@/lib/recordingVideos/embed"

import { Note, R_FIELD } from "./ui"
import { VideoEmbed } from "./VideoEmbed"

/** The open video: a 16:9 player the width of its place, what is happening to the audio said in one line, and Close. */
export function WatchPlayer({ t, embed, title, onClose }: { t: SpTheme; embed: Embed; title: string; onClose: () => void }) {
  const tr = useT()
  const [width, setWidth] = useState(0)
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))
  return (
    <View style={styles.root} onLayout={onLayout} testID="video-player">
      {width > 0 ? <VideoEmbed embed={embed} title={title} width={width} height={Math.round((width * 9) / 16)} radius={R_FIELD} /> : null}
      <Note t={t}>{tr("recVideos.playing")}</Note>
      <View style={styles.row}>
        <Button t={t} variant="quiet" label={tr("recVideos.close")} onPress={onClose} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { flexDirection: "row" },
})
