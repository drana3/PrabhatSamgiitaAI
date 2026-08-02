import { StyleSheet, Text, View, type ViewProps } from "react-native"

import { colors, spacing, typography } from "@/lib/client"

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
}) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

export function ScreenContainer({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.screen, style]} {...props}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  eyebrow: {
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    color: colors.navy950,
    fontSize: typography.heading,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.stone600,
    fontSize: typography.body,
    lineHeight: 24,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.ivory50,
  },
})
