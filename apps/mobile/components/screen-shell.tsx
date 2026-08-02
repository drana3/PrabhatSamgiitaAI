import { Ionicons } from "@expo/vector-icons"
import type { ReactNode } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ScrollViewProps,
  type ViewProps,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { cardElevation, hairline, layout } from "@/lib/theme"
import { colors, radii, spacing, typography } from "@/lib/client"

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

export function ScreenSafe({
  children,
  edges = ["top"],
}: {
  children: ReactNode
  edges?: ("top" | "bottom" | "left" | "right")[]
}) {
  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safe} edges={edges}>
        {children}
      </SafeAreaView>
    </ScreenContainer>
  )
}

export function ScreenScroll({
  children,
  contentContainerStyle,
  ...props
}: ScrollViewProps) {
  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  )
}

export function SurfaceCard({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.surfaceCard, style]} {...props}>
      {children}
    </View>
  )
}

export function ScreenLoader() {
  return (
    <ScreenContainer style={styles.loaderWrap}>
      <ActivityIndicator color={colors.gold500} size="large" />
    </ScreenContainer>
  )
}

export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.backButton}>
      <Text style={styles.backLabel}>{label}</Text>
    </Pressable>
  )
}

export function PrimaryButton({
  label,
  style,
  ...props
}: { label: string } & Omit<PressableProps, "children">) {
  return (
    <Pressable
      style={(state) => [styles.primaryButton, typeof style === "function" ? style(state) : style]}
      {...props}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  )
}

export function SecondaryButton({
  label,
  style,
  ...props
}: { label: string } & Omit<PressableProps, "children">) {
  return (
    <Pressable
      style={(state) => [styles.secondaryButton, typeof style === "function" ? style(state) : style]}
      {...props}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  )
}

export function EmptyState({
  icon = "search-outline",
  title,
  copy,
}: {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  copy?: string
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.gold500} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {copy ? <Text style={styles.emptyCopy}>{copy}</Text> : null}
    </View>
  )
}

export function QuickChips({
  items,
  onSelect,
}: {
  items: string[]
  onSelect: (value: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((item) => (
        <Pressable key={item} onPress={() => onSelect(item)} style={styles.chip}>
          <Text style={styles.chipText}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  eyebrow: {
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: colors.navy950,
    fontSize: typography.heading,
    fontWeight: "700",
    lineHeight: 28,
  },
  subtitle: {
    color: colors.stone600,
    fontSize: typography.body,
    lineHeight: 22,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.ivory50,
  },
  safe: { flex: 1 },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  surfaceCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: hairline,
    padding: spacing.md,
    gap: spacing.sm,
    ...cardElevation(1),
  },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  backLabel: {
    color: colors.gold500,
    fontWeight: "700",
    fontSize: typography.caption,
  },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.navy950,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    ...cardElevation(1),
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: typography.body,
  },
  secondaryButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(9, 45, 86, 0.15)",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  secondaryButtonText: {
    color: colors.navy950,
    fontWeight: "700",
    fontSize: typography.body,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ivory100,
    borderWidth: 1,
    borderColor: "rgba(202, 138, 39, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.navy950,
    fontSize: typography.body,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyCopy: {
    color: colors.stone600,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: "center",
  },
  chipRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(202, 138, 39, 0.3)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: colors.navy950,
    fontSize: typography.caption,
    fontWeight: "600",
  },
})

export { layout }
