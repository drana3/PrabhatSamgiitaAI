import { StyleSheet, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { usePageT } from "@/lib/songPage/pageCopy"

import { AboutBody, CentralIdea, PhotoCredit } from "./About"
import { CommentsSection } from "./Comments"
import type { SongPageModel } from "./useSongPageModel"
import { StorySection } from "./Watch"

/**
 * Tab 5, Info: what is known about the song (the central idea, then provable facts only), the story when there is one,
 * the members' comments, and the small photo credit at the very end. A row the data does not have is not drawn.
 */
export function InfoTab({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  return (
    <View style={styles.tab}>
      {model.meaning.central ? (
        <View style={styles.pad}>
          <CentralIdea t={t} tr={tr} model={model} />
        </View>
      ) : null}
      <AboutBody t={t} model={model} withPhoto={false} />
      <StorySection t={t} model={model} />
      <CommentsSection t={t} model={model} />
      {model.photo ? (
        <View style={styles.pad}>
          <PhotoCredit t={t} model={model} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: 24, paddingTop: 16, paddingBottom: 24 },
  pad: { paddingHorizontal: 20 },
})
