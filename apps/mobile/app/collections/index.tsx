import { useMemo, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SearchBar } from "@/components/common/SearchBar"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import {
  allCollections,
  collectionCount,
  collectionGroups,
  collectionSearchPrompt,
} from "@/data/collections"
import { href } from "@/utils/href"

export default function CollectionsScreen() {
  const router = useRouter()
  const [query, setQuery] = useState("")

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return collectionGroups
    return collectionGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.value.toLowerCase().includes(q) ||
            group.title.toLowerCase().includes(q) ||
            group.id.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [query])

  return (
    <ScreenContainer edges={["top"]} padded={false} title="Collections" subtitle={`${collectionCount} special collections`}>
      <View style={styles.searchWrap}>
        <SearchBar
          editable
          showSparkle={false}
          showMic
          placeholder="Filter by name or category..."
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery("")}
          onMicPress={() =>
            router.push(
              href(
                `/search?voice=1&q=${encodeURIComponent("Search Prabhat Samgiita for collections")}`,
              ),
            )
          }
        />
      </View>

      <FlatList
        ListHeaderComponent={
          <View style={styles.chips}>
            {collectionGroups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => setQuery(group.id)}
                style={[styles.chip, query === group.id && styles.chipActive]}
              >
                <Text style={styles.chipText}>
                  {group.title} · {group.items.length}
                </Text>
              </Pressable>
            ))}
            {query ? (
              <Pressable onPress={() => setQuery("")} style={[styles.chip, styles.chipClear]}>
                <Text style={styles.chipText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        }
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: group }) => (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <Text style={styles.groupDesc}>{group.description}</Text>
            {group.items.map((collection) => (
              <Pressable
                key={collection.label}
                accessibilityRole="button"
                accessibilityLabel={`${collection.label}, ${collection.count} songs`}
                onPress={() =>
                  router.push(
                    href(`/search?q=${encodeURIComponent(collectionSearchPrompt(collection.label))}`),
                  )
                }
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSoft }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{collection.label}</Text>
                  <Text style={styles.rowMeta}>{collection.count} songs</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No collections matched. Try “festival”, “season”, or “Hindi”.</Text>
        }
        ListFooterComponent={
          <Text style={styles.footer}>
            {allCollections.length} curated collections — same catalog paths as the website Explore page.
          </Text>
        }
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerCopy: { flex: 1 },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...softShadow(1),
  },
  input: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    padding: 0,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipClear: { backgroundColor: colors.surfaceWarm },
  chipText: { ...typography.caption, color: colors.textPrimary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section },
  group: { marginBottom: spacing.xxl },
  groupTitle: { ...typography.h3, color: colors.textPrimary },
  groupDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowTitle: { ...typography.bodySmall, color: colors.textPrimary },
  rowMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  empty: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
    lineHeight: 18,
  },
})
