import { StyleSheet, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"

import { AboutBody } from "./About"
import type { SongPageModel } from "./useSongPageModel"
import { StorySection } from "./Watch"

/**
 * Tab 5, Info: what is known about the song (provable facts only) and the story when there is one. A row the data does
 * not have is not drawn. The central idea moved to the Meaning tab; the comments and the photo credit are not here any
 * more: they end every tab (see SongPage).
 */
export function InfoTab({ t, model }: { t: SpTheme; model: SongPageModel }) {
  return (
    <View style={styles.tab}>
      <AboutBody t={t} model={model} withPhoto={false} />
      <StorySection t={t} model={model} />
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: 24, paddingTop: 16, paddingBottom: 24 },
})
