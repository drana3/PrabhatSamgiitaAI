import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { HOME_SEARCH_EXAMPLES } from "@prabhat/core"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  signedIn: boolean
  feelingOn: boolean
  onSelect: (example: (typeof HOME_SEARCH_EXAMPLES)[number]) => void
}

/** Same home chips as the website: By number / By words / By feeling. */
export function HomeSearchExamples({ signedIn, feelingOn, onSelect }: Props) {
  return (
    <View style={styles.row} accessibilityRole="summary" accessibilityLabel="Search examples">
      {HOME_SEARCH_EXAMPLES.map((example) => {
        const feelingGuest = example.mode === "feeling" && !signedIn
        const feelingNeedsEnable = example.mode === "feeling" && signedIn && !feelingOn
        const showQuery = !feelingGuest && !feelingNeedsEnable
        return (
          <Pressable
            key={example.label}
            accessibilityRole="button"
            accessibilityLabel={
              feelingGuest
                ? `${example.label}: Sign in to use Feeling search`
                : feelingNeedsEnable
                  ? `${example.label}: Enable Feeling search in Profile`
                  : `${example.label}: ${example.description}`
            }
            onPress={() => onSelect(example)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            {/*
              Separate Text nodes (not nested weighted Inter faces). Android often
              drops glyphs like "number" / "feeling" when fontWeight fights the face.
            */}
            <Text style={styles.label}>{example.label}</Text>
            {showQuery ? <Text style={styles.query}> · {example.query}</Text> : null}
            {feelingGuest ? <Text style={styles.badge}>Sign in</Text> : null}
            {feelingNeedsEnable ? <Text style={styles.badge}>Profile</Text> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipPressed: { opacity: 0.85 },
  label: {
    ...typography.caption,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : "Inter_700Bold",
    color: colors.textPrimary,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  query: {
    fontFamily: Platform.OS === "android" ? "sans-serif" : "Inter_500Medium",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  badge: {
    ...typography.caption,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : "Inter_700Bold",
    fontSize: 10,
    textTransform: "uppercase",
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
})
