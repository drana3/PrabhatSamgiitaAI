import { useMemo } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import { StoryRow, songLine } from "@/components/stories/StoryParts"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { minutesOf, useStories, useStorySongTitles } from "@/hooks/useStories"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { filterStories, sortStories } from "@/lib/stories/list"
import type { Story } from "@/lib/stories/types"
import { useStoriesStore } from "@/stores/storiesStore"

/**
 * The Stories chip of Search: the stories whose title, PS number or song name match the words typed (the same
 * match the Stories page uses), each opening its reading page. Mounted only while the chip is chosen, so the
 * list is not fetched for a search that never looks at stories. Below it, one row opens the whole list.
 */
export function StoryResults({ p, query, onOpen, onBrowse }: { p: AmProto; query: string; onOpen: (story: Story) => void; onBrowse: () => void }) {
  const t = useT()
  const theme = useSongsTheme()
  const read = useStoriesStore((state) => state.read)
  const { stories, loading, failed, reload } = useStories()
  const songTitle = useStorySongTitles(stories)
  const shown = useMemo(
    () => filterStories(sortStories(stories), { query, filter: "all", read, songTitle }),
    [stories, query, read, songTitle],
  )

  return (
    <View style={s.wrap}>
      {loading && !stories.length ? (
        <View style={s.status} accessibilityLiveRegion="polite">
          <ActivityIndicator color={p.orange500} />
        </View>
      ) : failed && !stories.length ? (
        <View style={s.status} accessibilityLiveRegion="polite">
          <Text style={[s.text, { color: p.ink500 }]}>{t("search.stories.failed")}</Text>
          <TodayPress accessibilityRole="button" accessibilityLabel={t("common.tryAgain")} onPress={reload} pressedScale={0.95} style={[s.pill, { backgroundColor: p.white, borderColor: p.sand300 }]}>
            <Text style={[s.pillText, { color: p.ink800 }]}>{t("common.tryAgain")}</Text>
          </TodayPress>
        </View>
      ) : shown.length ? (
        shown.map((story) => (
          <StoryRow key={story.slug} theme={theme} story={story} line={songLine(story, songTitle)} minutes={minutesOf(story)} read={story.slug in read} onOpen={onOpen} />
        ))
      ) : (
        <Text style={[s.text, s.pad, { color: p.ink500 }]} accessibilityLiveRegion="polite">
          {t("search.stories.none", { query: query.trim() })}
        </Text>
      )}
      <TodayPress accessibilityRole="button" accessibilityLabel={t("search.stories.a11y")} onPress={onBrowse} pressedScale={0.98} style={[s.all, { backgroundColor: p.white, borderColor: p.sand300 }]}>
        <Text style={[s.text, { color: p.ink800 }]}>{t("search.stories.all")}</Text>
      </TodayPress>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  status: { alignItems: "flex-start", gap: 12, paddingHorizontal: 20 },
  text: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
  pad: { paddingHorizontal: 20 },
  pill: { height: 44, paddingHorizontal: 20, borderRadius: 70, borderWidth: 1, justifyContent: "center" },
  pillText: { fontFamily: amFonts.semi, fontSize: 15 },
  all: { marginHorizontal: 16, padding: 18, borderRadius: 20, borderWidth: 1 },
})
