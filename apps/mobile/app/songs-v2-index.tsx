import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { ChevronLeft, ChevronRight, Search } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Press } from "@/components/songs-v2/Press"
import { Reveal } from "@/components/today/motion"
import { TwoToneHeading } from "@/components/today/TodayBlocks"
import { amControl, amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { collectionCount, collectionGroups } from "@/data/collections"
import { useAmTheme } from "@/hooks/useAmTheme"
import { allCollectionsLabel, filterCollectionGroups, songCountLabel } from "@/lib/songsV2/collections"
import { href } from "@/utils/href"

/**
 * `All 68` (spec SCR-11 item 4): a full-screen, searchable index of every
 * collection, grouped, one white card row each with its song count.
 */
export default function SongsV2IndexScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const [query, setQuery] = useState("")
  const groups = useMemo(() => filterCollectionGroups(collectionGroups, query), [query])

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
      >
        <Reveal index={0}>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            pressedScale={0.92}
            style={[styles.back, { backgroundColor: theme.card, borderColor: theme.line }]}
          >
            <ChevronLeft size={22} color={theme.textHeading} />
          </Press>
        </Reveal>
        <Reveal index={1}>
          <TwoToneHeading theme={theme} first={allCollectionsLabel(collectionCount)} second="collections" />
        </Reveal>
        <Reveal index={2}>
          <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Search size={20} color={theme.textBody} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Find a collection"
              placeholderTextColor={theme.textMuted}
              accessibilityLabel="Find a collection"
              autoCorrect={false}
              style={[styles.input, { color: theme.textHeading }]}
            />
          </View>
        </Reveal>

        {groups.map((group, index) => (
          <Reveal key={group.id} index={3 + index} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={[amType.label, { color: theme.eyebrow }]}>{group.title}</Text>
              <Text style={[amType.label, { color: theme.textMuted }]}>{group.items.length}</Text>
            </View>
            <View style={styles.stack}>
              {group.items.map((item) => (
                <Press
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label}, ${songCountLabel(item.count)}`}
                  onPress={() =>
                    router.push(
                      href(`/songs-v2-collection?id=${encodeURIComponent(item.label)}&title=${encodeURIComponent(item.label)}`),
                    )
                  }
                  pressedScale={0.985}
                  style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}
                >
                  <View style={styles.flex}>
                    <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
                      {item.label}
                    </Text>
                    <Text style={[amType.label, { color: theme.eyebrow }]}>{songCountLabel(item.count)}</Text>
                  </View>
                  <ChevronRight size={20} color={theme.textMuted} />
                </Press>
              ))}
            </View>
          </Reveal>
        ))}
        {!groups.length ? <Text style={[amType.body, { color: theme.textBody }]}>No collection matches “{query}”.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: amGap.block, paddingBottom: amSpace.s32, paddingTop: amSpace.s2 },
  back: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    height: amControl.pillHeight,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
    paddingHorizontal: amGap.padCard,
  },
  input: { flex: 1, fontFamily: amFonts.regular, fontSize: 16, height: amControl.pillHeight },
  group: { gap: amSpace.s3 },
  groupHead: { flexDirection: "row", justifyContent: "space-between" },
  stack: { gap: amGap.grid },
  flex: { flex: 1, gap: amSpace.s1 },
  row: {
    minHeight: 64,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    paddingVertical: amSpace.s3,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
  },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24 },
})
