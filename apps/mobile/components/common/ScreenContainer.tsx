import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { ChevronLeft } from "lucide-react-native"
import { useRouter } from "expo-router"

import { IconButton } from "@/components/common/IconButton"
import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = ViewProps & {
  edges?: ("top" | "right" | "bottom" | "left")[]
  padded?: boolean
  title?: string
  subtitle?: string
  showBack?: boolean
  /** @deprecated Guru chrome removed — kept for call-site compatibility. */
  showGuru?: boolean
}

export function ScreenContainer({
  children,
  style,
  edges = ["top"],
  padded = true,
  title,
  subtitle,
  showBack = Boolean(title),
  showGuru: _showGuru = false,
  ...rest
}: Props) {
  const router = useRouter()

  return (
    <SafeAreaView edges={edges} style={[styles.safe, style]} {...rest}>
      {title ? (
        <View style={[styles.header, !padded && styles.headerGutter]}>
          {showBack ? (
            <IconButton soft accessibilityLabel="Go back" onPress={() => router.back()}>
              <ChevronLeft size={22} color={colors.textPrimary} />
            </IconButton>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.headerSpacer} />
        </View>
      ) : null}

      <View style={[styles.inner, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  )
}

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
}: {
  title: string
  actionLabel?: string
  onActionPress?: () => void
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress} accessibilityRole="button">
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  headerGutter: {
    paddingHorizontal: spacing.lg,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 26,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  action: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.primary,
  },
})
