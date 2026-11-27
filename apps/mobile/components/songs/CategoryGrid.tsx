import { Pressable, StyleSheet, Text, View } from "react-native"
import {
  CloudRain,
  Flame,
  Flower2,
  Heart,
  Leaf,
  Library,
  Moon,
  Music,
  PartyPopper,
  Sparkles,
  Sunrise,
} from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { collectionCount } from "@/data/collections"

const iconMap = {
  sparkles: Sparkles,
  leaf: Leaf,
  heart: Heart,
  flower2: Flower2,
  sunrise: Sunrise,
  moon: Moon,
  "cloud-rain": CloudRain,
  "party-popper": PartyPopper,
  flame: Flame,
  peace: Flower2,
  music: Music,
} as const

export type CategoryChip = {
  id: string
  label: string
  icon: keyof typeof iconMap
}

type Props = {
  items: readonly CategoryChip[]
  onSelect?: (id: string) => void
  onSeeAll?: () => void
}

export function CategoryGrid({ items, onSelect, onSeeAll }: Props) {
  return (
    <View style={styles.grid}>
      {items.map((cat) => {
        const Icon = iconMap[cat.icon]
        return (
          <Pressable
            key={cat.id}
            accessibilityRole="button"
            accessibilityLabel={cat.label}
            onPress={() => onSelect?.(cat.id)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Icon size={16} color={colors.primary} strokeWidth={2} />
            <Text style={styles.label}>{cat.label}</Text>
          </Pressable>
        )
      })}
      {onSeeAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Browse all ${collectionCount} collections`}
          onPress={onSeeAll}
          style={({ pressed }) => [styles.chip, styles.allChip, pressed && styles.pressed]}
        >
          <Library size={16} color={colors.primary} strokeWidth={2} />
          <Text style={styles.label}>All {collectionCount}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  allChip: {
    borderColor: colors.primary,
  },
  pressed: {
    backgroundColor: colors.primaryLight,
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
  },
})
