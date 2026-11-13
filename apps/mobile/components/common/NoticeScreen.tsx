import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Press } from "@/components/songs-v2/Press"
import { amControl, amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"

export type NoticeAction = { label: string; onPress: () => void }

/**
 * The one "not found / could not load / try again" page of the redesign: a title, one honest sentence,
 * a primary action and an optional quiet one. Use it instead of an empty page, a stub text or a
 * spinner that never ends.
 */
export function NoticeScreen({
  eyebrow,
  title,
  body,
  primary,
  secondary,
  children,
}: {
  eyebrow?: string
  title: string
  body?: string
  primary?: NoticeAction
  secondary?: NoticeAction
  children?: ReactNode
}) {
  const theme = useAmTheme()
  const bottom = useScrollBottomInset()
  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <View style={[styles.body, { paddingBottom: bottom }]}>
        {eyebrow ? <Text style={[amType.label, { color: theme.eyebrow }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: theme.textHeading }]} accessibilityRole="header">
          {title}
        </Text>
        {body ? <Text style={[styles.text, { color: theme.textBody }]}>{body}</Text> : null}
        {children}
        {primary ? (
          <Press
            accessibilityRole="button"
            accessibilityLabel={primary.label}
            onPress={primary.onPress}
            outerStyle={styles.buttonOuter}
            style={[styles.button, { backgroundColor: theme.brand }]}
          >
            <Text style={[styles.buttonText, { color: theme.onBrand }]}>{primary.label}</Text>
          </Press>
        ) : null}
        {secondary ? (
          <Press
            accessibilityRole="button"
            accessibilityLabel={secondary.label}
            onPress={secondary.onPress}
            outerStyle={styles.buttonOuter}
            style={[styles.button, { borderColor: theme.line, borderWidth: 1 }]}
          >
            <Text style={[styles.buttonText, { color: theme.textHeading }]}>{secondary.label}</Text>
          </Press>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: amGap.gutter + 6, gap: amGap.text },
  title: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, textTransform: "uppercase", letterSpacing: -0.6 },
  text: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24 },
  buttonOuter: { alignSelf: "flex-start", minHeight: 44 },
  button: {
    height: amControl.pillHeight,
    borderRadius: amRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16 },
})
