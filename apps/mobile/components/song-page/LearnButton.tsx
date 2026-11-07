import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPill, SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useLearnSongs } from "@/hooks/useLearnSongs"
import { learnSongId } from "@/lib/learn/learnSongs"
import { songPathHref } from "@/lib/learn/routes"
import { usePageT } from "@/lib/songPage/pageCopy"
import { href } from "@/utils/href"

import type { SongPageModel } from "./useSongPageModel"

/**
 * "Learn this song": puts the song on the Learn list (the same list the Learn tab shows). Once it is there the
 * button says so and opens the song's learning path instead.
 */
export function LearnButton({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  const router = useRouter()
  const learn = useLearnSongs()
  const song = model.song
  if (!song) return null
  const number = song.number
  if (learn.has(number)) {
    return (
      <View style={styles.row}>
        <View style={styles.inList} accessibilityLabel={tr("songPage.learn.in.a11y", { number })}>
          <SpIcon name="check" size={20} color={t.accentText} strokeWidth={2.4} />
          <Text style={[styles.inText, { color: t.ink900 }]} numberOfLines={1}>{tr("songPage.learn.in")}</Text>
        </View>
        <SpPress
          onPress={() => router.push(href(songPathHref(learnSongId(number))))}
          accessibilityLabel={tr("songPage.learn.in.a11y", { number })}
          style={styles.open}
        >
          <Text style={[styles.openText, { color: t.accentText }]}>{tr("songPage.learn.open")}</Text>
          <SpIcon name="chevRight" size={18} color={t.accentText} strokeWidth={2.2} />
        </SpPress>
      </View>
    )
  }
  return (
    <View style={styles.row}>
      <SpPill
        t={t}
        variant="peach"
        icon="plus"
        label={tr("songPage.learn.add")}
        accessibilityLabel={tr("songPage.learn.add.a11y", { number })}
        onPress={() => {
          const result = learn.add(number, song.title)
          if (result.status !== "invalid") model.showToast(tr("songPage.learn.added", { number }))
        }}
        style={styles.pill}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  pill: { paddingHorizontal: 22 },
  inList: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, flexShrink: 1 },
  inText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22, flexShrink: 1 },
  open: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 4 },
  openText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
})
