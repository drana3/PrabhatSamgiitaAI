import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { usePageT } from "@/lib/songPage/pageCopy"

import { QuietNote } from "./ui"
import type { SongPageModel } from "./useSongPageModel"
import { VideoSection } from "./Watch"

/**
 * Tab 4, Video: the real videos of the song (each with Open in YouTube and Report), then the links members added. A song
 * with neither says so in one line; the tab never disappears.
 */
export function VideoTab({ t, model, memberVideos }: { t: SpTheme; model: SongPageModel; memberVideos: ReactNode }) {
  const tr = usePageT()
  const empty = !model.videos.length && !memberVideos
  return (
    <View style={styles.tab}>
      <VideoSection t={t} model={model} />
      {memberVideos ? <View>{memberVideos}</View> : null}
      {empty ? <QuietNote t={t}>{tr("songVideo.empty")}</QuietNote> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: 32, paddingTop: 16, paddingBottom: 24 },
})
