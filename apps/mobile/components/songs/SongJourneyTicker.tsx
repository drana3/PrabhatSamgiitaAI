import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { colors } from "@/constants/colors"
import { partitionSongJourneyTabs, type SongJourneyTab } from "@/constants/songJourney"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type TabItem = {
  id: SongJourneyTab
  label: string
  hint: string
}

type Props = {
  tabs: readonly TabItem[]
  selected: SongJourneyTab
  onSelect: (id: SongJourneyTab) => void
}

function TabChip({
  item,
  active,
  onPress,
}: {
  item: TabItem
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${item.label}, ${item.hint}`}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
      <Text style={[styles.hint, active && styles.hintActive]}>{item.hint}</Text>
    </Pressable>
  )
}

/** One row: Lyrics / Notation, then a gap, then Listen / Watch. */
export function SongJourneyTicker({ tabs, selected, onSelect }: Props) {
  const { learn, media } = partitionSongJourneyTabs(tabs)

  return (
    <View style={styles.wrap} accessibilityRole="tablist" accessibilityLabel="Song sections">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {learn.map((item) => (
          <TabChip
            key={item.id}
            item={item}
            active={selected === item.id}
            onPress={() => onSelect(item.id)}
          />
        ))}
        {learn.length > 0 && media.length > 0 ? <View style={styles.groupGap} /> : null}
        {media.map((item) => (
          <TabChip
            key={item.id}
            item={item}
            active={selected === item.id}
            onPress={() => onSelect(item.id)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  groupGap: {
    width: spacing.xxxl,
  },
  chip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 96,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  label: { ...typography.label, color: colors.textPrimary },
  labelActive: { color: colors.white },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  hintActive: { color: "rgba(255,255,255,0.7)" },
})
