import { useMemo, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SearchGlyph } from "@/components/songs-v2/Glyphs"
import { CardButton, EmptyNote, overStyle, SectionHeading } from "@/components/songs-v2/primitives"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { BackHeader } from "@/components/songs-v2/StorageParts"
import { amFonts } from "@/constants/tokens/amTypography"
import { collectionCount, collectionGroups } from "@/data/collections"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { allCollectionsLabel, filterCollectionGroups, songCountLabel } from "@/lib/songsV2/collections"
import { href } from "@/utils/href"

/**
 * `All 68` (spec SCR-11 item 4): a full-screen, searchable index of every collection, grouped, one
 * white card row each with its song count. The prototype has no board for it, so it is built from
 * the overlay vocabulary of the Storage board: round back button, 30px two-tone heading, a 56px
 * search pill, `.over` group labels and `.cardbtn` rows. The Catalog strip hides its entry link in
 * the preview (the prototype strip has none), so this screen is reached by route or on device.
 */
export default function SongsV2IndexScreen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const inset = Platform.OS === "web" ? 54 : insets.top
  const openedAt = useRevealClock()
  const [query, setQuery] = useState("")
  const groups = useMemo(() => filterCollectionGroups(collectionGroups, query), [query])

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page, paddingTop: inset }]}>
        <SongsReveal index={0}>
          <BackHeader theme={theme} onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        </SongsReveal>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
        >
          <SongsReveal index={1} style={styles.heading}>
            <SectionHeading theme={theme} first={allCollectionsLabel(collectionCount)} second="collections" />
          </SongsReveal>

          <SongsReveal index={2}>
            <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <SearchGlyph color={theme.textBody} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Find a collection"
                placeholderTextColor={theme.textBody}
                accessibilityLabel="Find a collection"
                autoCorrect={false}
                style={[styles.input, { color: theme.textHeading }]}
              />
            </View>
          </SongsReveal>

          {groups.map((group, index) => (
            <SongsReveal key={group.id} index={3 + index} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={[overStyle, { color: theme.accent }]}>{group.title}</Text>
                <Text style={[overStyle, { color: theme.textBody }]}>{group.items.length}</Text>
              </View>
              {group.items.map((item) => (
                <CardButton
                  key={item.label}
                  theme={theme}
                  eyebrow={songCountLabel(item.count)}
                  title={item.label}
                  onPress={() =>
                    router.push(
                      href(`/songs-v2-collection?id=${encodeURIComponent(item.label)}&title=${encodeURIComponent(item.label)}`),
                    )
                  }
                />
              ))}
            </SongsReveal>
          ))}
          {!groups.length ? <EmptyNote theme={theme}>No collection matches “{query}”.</EmptyNote> : null}
        </ScrollView>
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 10, paddingBottom: 48, gap: 20 },
  heading: { paddingHorizontal: 10 },
  search: {
    height: 56,
    borderRadius: 70,
    borderWidth: 1,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  input: { flex: 1, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 20, height: 56 },
  group: { gap: 10 },
  groupHead: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10 },
})
