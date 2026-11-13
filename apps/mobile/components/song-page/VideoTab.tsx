import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { usePageT } from "@/lib/songPage/pageCopy"

import { QuietNote } from "./ui"
import type { SongPageModel } from "./useSongPageModel"
import { VideoSection } from "./Watch"

/**
 * Tab 4, Video (redrawn on 11 November 2026): every video a card with a big picture; the site is a small label, and the
 * buttons beside it are small icons without words (open on the site, the menu). "Add a video" is one plain row. One short
 * line at the end says the videos open on their own sites. A song with no video says so in one line; the tab never disappears.
 */
export function VideoTab({ t, model, memberVideos }: { t: SpTheme; model: SongPageModel; memberVideos: ReactNode }) {
  const tr = usePageT()
  const empty = !model.videos.length && !memberVideos
  return (
    <View style={styles.tab}>
      <VideoSection t={t} model={model} heading={!memberVideos} add={!memberVideos} />
      {memberVideos ? <View>{memberVideos}</View> : null}
      {empty ? <QuietNote t={t}>{tr("songVideo.empty")}</QuietNote> : null}
      {!empty ? <Text style={[styles.note, { color: t.ink500 }]}>{tr("songVideo.note")}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: 24, paddingTop: 16, paddingBottom: 24 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 20 },
})
