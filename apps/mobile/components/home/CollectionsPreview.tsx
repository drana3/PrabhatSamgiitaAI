import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Library } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { collectionCount, featuredCollections, type CollectionItem } from "@/data/collections"

type Props = {
  onOpenCollection: (item: CollectionItem) => void
  onSeeAll: () => void
}

export function CollectionsPreview({ onOpenCollection, onSeeAll }: Props) {
  return (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Special collections</Text>
          <Text style={styles.meta}>{collectionCount} curated paths through the catalog</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onSeeAll}>
          <Text style={styles.seeAll}>All {collectionCount}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {featuredCollections.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${item.count} songs`}
            onPress={() => onOpenCollection(item)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.iconWrap}>
              <Library size={16} color={colors.primary} />
            </View>
            <Text style={styles.label} numberOfLines={2}>
              {item.label.replace(/ Songs?$/i, "")}
            </Text>
            <Text style={styles.count}>{item.count} songs</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Browse all ${collectionCount} collections`}
          onPress={onSeeAll}
          style={({ pressed }) => [styles.card, styles.browseAll, pressed && { opacity: 0.92 }]}
        >
          <Text style={styles.browseTitle}>Browse all</Text>
          <Text style={styles.browseSub}>{collectionCount} collections</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    maxWidth: 220,
  },
  seeAll: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 4,
  },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  card: {
    width: 140,
    minHeight: 118,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  browseAll: {
    backgroundColor: colors.surfaceWarm,
    justifyContent: "center",
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    minHeight: 36,
  },
  count: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  browseTitle: {
    ...typography.label,
    color: colors.primaryDark,
  },
  browseSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
})
