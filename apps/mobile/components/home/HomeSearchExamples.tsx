import { Pressable, StyleSheet, Text, View } from "react-native"
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
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    flexWrap: "nowrap",
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
    fontWeight: "700",
    color: colors.textPrimary,
  },
  query: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  badge: {
    ...typography.caption,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
    fontWeight: "700",
    fontSize: 10,
    textTransform: "uppercase",
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
  },
})
