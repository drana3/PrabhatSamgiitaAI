import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useLearnSongs } from "@/hooks/useLearnSongs"
import { learnSongId } from "@/lib/learn/learnSongs"
import { songPathHref } from "@/lib/learn/routes"
import { usePageT } from "@/lib/songPage/pageCopy"
import { href } from "@/utils/href"

import type { SongPageModel } from "./useSongPageModel"

/** An open book: the mark of Learn on this page. It is not a check, because a check is already Saved and Downloaded. */
export function BookGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M12 6.5C10.2 5.2 7.6 4.6 4.5 5v12.5c3.1-.4 5.7.2 7.5 1.5 1.8-1.3 4.4-1.9 7.5-1.5V5c-3.1-.4-5.7.2-7.5 1.5zM12 6.5V19" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/**
 * The Learn row, one line under the title (the song page, decision of 10 November 2026). Two states:
 *
 *   not on the list   "Add to learning": a peach row with a book and a plus. A tap puts the song on the Learn list (the same
 *                     list the Learn tab shows), a toast says "PS n added to Learn", and the row turns into the next state.
 *   on the list       "In your Learn list · Open": a quiet green row. "Open" goes to the song's learning path.
 */
export function LearnButton({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  const router = useRouter()
  const learn = useLearnSongs()
  const reduce = useReducedMotion()
  const song = model.song
  if (!song) return null
  const number = song.number
  const enter = reduce ? undefined : FadeIn.duration(220)
  if (learn.has(number)) {
    const open = () => router.push(href(songPathHref(learnSongId(number))))
    return (
      <Animated.View key="in" entering={enter} style={styles.wrap}>
        <SpPress
          onPress={open}
          accessibilityLabel={tr("songPage.learn.in.a11y", { number })}
          style={[styles.row, { backgroundColor: t.dark ? t.sand100 : t.sage200 }]}
        >
          <BookGlyph size={22} color={t.dark ? t.ink900 : t.sage800} />
          <Text style={[styles.text, { color: t.dark ? t.ink900 : t.sage900 }]} numberOfLines={1}>
            {tr("songPage.learn.in")}
          </Text>
          <View style={styles.go}>
            <Text style={[styles.goText, { color: t.accentText }]}>{tr("songPage.learn.open")}</Text>
            <SpIcon name="chevRight" size={18} color={t.accentText} strokeWidth={2.2} />
          </View>
        </SpPress>
      </Animated.View>
    )
  }
  return (
    <Animated.View key="add" entering={enter} style={styles.wrap}>
      <SpPress
        onPress={() => {
          const result = learn.add(number, song.title)
          if (result.status !== "invalid") model.showToast(tr("songPage.learn.added", { number }))
        }}
        accessibilityLabel={tr("songPage.learn.add.a11y", { number })}
        style={[styles.row, { backgroundColor: t.orange100 }]}
      >
        <BookGlyph size={22} color={t.orange700} />
        <Text style={[styles.text, { color: t.orange700 }]} numberOfLines={1}>
          {tr("songLearn.add")}
        </Text>
        <SpIcon name="plus" size={22} color={t.orange700} strokeWidth={2.2} />
      </SpPress>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16 },
  row: { minHeight: 52, borderRadius: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  go: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44 },
  goText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
})
