import { useCallback, useMemo, useState } from "react"
import { FlatList, Platform, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SpRound } from "@/components/song-v2/SpUi"
import { CloseGlyph, SearchGlyph } from "@/components/songs-v2/Glyphs"
import { ChipsRow } from "@/components/songs-v2/ListParts"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { FeaturedStoryCard, StoryRow, songLine } from "@/components/stories/StoryParts"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { minutesOf, usePrefetchMinutes, useStorySongTitles, useStories } from "@/hooks/useStories"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import {
  EMPTY_STORIES_TEXT,
  STORY_CHIPS,
  featuredStory,
  filterStories,
  sortStories,
  storiesCountLabel,
  type StoryFilter,
} from "@/lib/stories/list"
import { unreadCount } from "@/lib/stories/readState"
import type { Story } from "@/lib/stories/types"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useStoriesStore } from "@/stores/storiesStore"
import { href } from "@/utils/href"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"

const SIDE = 16
const REVEALED_ROWS = 4
const INTRO = "How a Prabhat Samgiita song was born, in a few minutes of reading."

/**
 * Stories behind the songs: a pinned bar (back, title, count, search, All / Unread), then one featured story on
 * a photo and the rest as rows. A row opens the reading page (/stories/[slug]). Read stories are marked and the
 * Unread chip hides them.
 */
export default function StoriesScreen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const insets = useSafeAreaInsets()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = Platform.OS === "web" ? 54 : insets.top
  const openedAt = useRevealClock()
  const bottomInset = useScrollBottomInset()
  const read = useStoriesStore((s) => s.read)

  const { stories, loading, failed, reload } = useStories()
  const minutesVersion = usePrefetchMinutes(stories)
  const songTitle = useStorySongTitles(stories)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<StoryFilter>("all")

  const sorted = useMemo(() => sortStories(stories), [stories])
  const unread = useMemo(() => unreadCount(sorted.map((s) => s.slug), read), [sorted, read])
  const shown = useMemo(() => filterStories(sorted, { query, filter, read, songTitle }), [sorted, query, filter, read, songTitle])
  const plain = query.trim().length === 0 && filter === "all"
  const featured = useMemo(() => (plain ? featuredStory(sorted, read) : null), [plain, sorted, read])
  const rows = useMemo(() => (featured ? shown.filter((s) => s.slug !== featured.slug) : shown), [shown, featured])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const minutes = useCallback((story: Story) => minutesOf(story), [minutesVersion])

  const open = useCallback((story: Story) => router.push(href(`/stories/${story.slug}`)), [router])
  const clear = useCallback(() => {
    setQuery("")
    setFilter("all")
  }, [])
  const chips = useMemo(() => STORY_CHIPS.map((c) => ({ id: c.id, label: c.label })), [])

  const header = (
    <View>
      {plain ? (
        <SongsReveal index={3}>
          <Text style={[styles.intro, { color: theme.textBody }]}>{INTRO}</Text>
        </SongsReveal>
      ) : null}
      {featured ? (
        <SongsReveal index={4}>
          <FeaturedStoryCard
            theme={theme}
            story={featured}
            line={songLine(featured, songTitle)}
            minutes={minutes(featured)}
            read={featured.slug in read}
            onOpen={open}
          />
        </SongsReveal>
      ) : null}
      {featured && rows.length ? (
        <Text style={[amType.label, styles.section, { color: theme.eyebrow }]} accessibilityRole="header">
          More stories
        </Text>
      ) : null}
    </View>
  )

  const renderItem = useCallback(
    ({ item, index }: { item: Story; index: number }) => {
      const row = (
        <StoryRow
          theme={theme}
          story={item}
          line={songLine(item, songTitle)}
          minutes={minutes(item)}
          read={item.slug in read}
          onOpen={open}
        />
      )
      return index < REVEALED_ROWS ? <SongsReveal index={5 + index}>{row}</SongsReveal> : row
    },
    [theme, songTitle, minutes, read, open],
  )

  const empty = loading ? (
    <View style={styles.emptyBox}>
      <Text style={[styles.empty, { color: theme.textBody }]}>Loading stories…</Text>
    </View>
  ) : failed ? (
    <View style={styles.emptyBox}>
      <Text style={[styles.empty, { color: theme.textBody }]}>Stories could not be loaded. Check your connection and try again.</Text>
      <Press accessibilityRole="button" accessibilityLabel="Try again" onPress={reload} pressedScale={0.96} style={styles.emptyBtn}>
        <Text style={[styles.emptyLink, { color: theme.accent }]}>Try again</Text>
      </Press>
    </View>
  ) : (
    <View style={styles.emptyBox}>
      <Text style={[styles.empty, { color: theme.textBody }]}>{EMPTY_STORIES_TEXT}</Text>
      <Press accessibilityRole="button" accessibilityLabel="Clear search and filter" onPress={clear} pressedScale={0.96} style={styles.emptyBtn}>
        <Text style={[styles.emptyLink, { color: theme.accent }]}>Show all stories</Text>
      </Press>
    </View>
  )

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page }]}>
        {/* the pinned bar: back, title, search and filter stay while the list scrolls */}
        <View style={[styles.bar, { paddingTop: inset, backgroundColor: theme.page }]}>
          <SongsReveal index={0}>
            <View style={styles.titleRow}>
              <SpRound t={sp} icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(href(NAV_V2_HOME_ROUTE)))} />
              <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2} accessibilityRole="header" accessibilityLabel="Stories behind the songs">
                <Text style={styles.titleLight}>Stories behind{"\n"}</Text>
                the songs
              </Text>
              <Text style={[styles.count, { color: theme.textBody }]} numberOfLines={1}>
                {storiesCountLabel(shown.length, sorted.length, filter, unread)}
              </Text>
            </View>
          </SongsReveal>
          <SongsReveal index={1}>
            <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <SearchGlyph color={theme.textBody} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by title or song"
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Search stories by title or song"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
                style={[styles.input, { color: theme.textHeading }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
              />
              {query ? (
                <Press accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} pressedScale={0.88} style={styles.clearBtn}>
                  <CloseGlyph size={18} color={theme.textBody} />
                </Press>
              ) : null}
            </View>
          </SongsReveal>
          <SongsReveal index={2}>
            <ChipsRow theme={theme} chips={chips} active={filter} onPick={(id) => setFilter(id as StoryFilter)} />
          </SongsReveal>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(story) => story.slug}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={featured ? null : empty}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomInset }}
          initialNumToRender={8}
          windowSize={7}
        />
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { zIndex: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: 20, height: 56 },
  title: {
    flex: 1,
    fontFamily: amFonts.display,
    fontSize: 24,
    lineHeight: 25,
    letterSpacing: -0.48,
    textTransform: "uppercase",
  },
  titleLight: { fontFamily: amFonts.regular },
  count: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17, fontVariant: ["tabular-nums"] },
  search: {
    height: 48,
    marginHorizontal: SIDE,
    marginTop: 8,
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, height: 48, fontFamily: amFonts.medium, fontSize: 16 },
  clearBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  intro: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, paddingHorizontal: 20, paddingBottom: 16 },
  section: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12 },
  emptyBox: { paddingHorizontal: 20, paddingTop: 20, gap: 4 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
  emptyBtn: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  emptyLink: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
