import { StyleSheet, Text, View } from "react-native"

import { openExternal } from "@/lib/openLink"
import { SpringSheet } from "@/components/assistant-v2/SpringSheet"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { privacyUrl } from "@/lib/webLinks"

/**
 * First-use consent before any question reaches the AI service (App Store 5.1.2(i)). It says plainly where the
 * words go and asks for an explicit yes. Closing it any way (Not now, the X, the scrim, Back) is a no.
 */
export function AiConsentSheet({
  theme,
  visible,
  onAgree,
  onNotNow,
}: {
  theme: AmTheme
  visible: boolean
  onAgree: () => void
  onNotNow: () => void
}) {
  const t = useT()
  return (
    <SpringSheet visible={visible} onClose={onNotNow} title={t("assistant.consent.title")} theme={theme}>
      <View style={styles.body}>
        <Text style={[styles.lead, { color: theme.textHeading }]}>{t("assistant.consent.body")}</Text>
        <Text style={[styles.detail, { color: theme.textBody }]}>{t("assistant.consent.detail")}</Text>
        <PressScale
          accessibilityRole="link"
          accessibilityLabel={t("assistant.consent.privacy")}
          onPress={() => void openExternal(privacyUrl())}
          pressedScale={0.98}
          style={styles.link}
        >
          <Text style={[styles.linkText, { color: theme.brandPress }]}>{t("assistant.consent.privacy")}</Text>
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t("assistant.consent.agree")}
          onPress={onAgree}
          style={[styles.primary, { backgroundColor: theme.brand }]}
        >
          <Text style={[styles.primaryText, { color: theme.onBrand }]}>{t("assistant.consent.agree")}</Text>
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t("assistant.consent.notNow")}
          onPress={onNotNow}
          style={[styles.secondary, { borderColor: theme.line }]}
        >
          <Text style={[styles.secondaryText, { color: theme.textHeading }]}>{t("assistant.consent.notNow")}</Text>
        </PressScale>
      </View>
    </SpringSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 16, paddingHorizontal: 4 },
  lead: { ...amType.body, fontFamily: amFonts.semi },
  detail: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 21 },
  link: { minHeight: amTouchTarget, justifyContent: "center" },
  linkText: { fontFamily: amFonts.medium, fontSize: 15, textDecorationLine: "underline" },
  primary: {
    height: 52,
    borderRadius: amRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: amFonts.semi, fontSize: 17 },
  secondary: {
    height: 52,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontFamily: amFonts.medium, fontSize: 16 },
})
