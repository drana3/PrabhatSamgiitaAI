import { Linking, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { NoticeScreen } from "@/components/common/NoticeScreen"
import { Press } from "@/components/songs-v2/Press"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import {
  ANDROID_PACKAGE,
  appPlatform,
  storeTarget,
  useUpdateAnswer,
  type UpdateAnswer,
} from "@/lib/appUpdate"
import { useT } from "@/lib/i18n"

function openStore(answer: UpdateAnswer) {
  const target = storeTarget(answer, appPlatform(), ANDROID_PACKAGE)
  if (target) void Linking.openURL(target).catch(() => undefined)
  return target
}

/**
 * Sits over the whole app (app/_layout.tsx). "Required": a full-screen stop with one button to the store,
 * nothing underneath can be reached. "Recommended": a thin dismissible strip. "Ok": draws nothing.
 */
export function UpdateGate() {
  const { answer, bannerHidden, hideBanner } = useUpdateAnswer()
  if (answer.status === "required") return <RequiredScreen answer={answer} />
  if (answer.status === "recommended" && !bannerHidden) {
    return <Banner answer={answer} onDismiss={hideBanner} />
  }
  return null
}

function RequiredScreen({ answer }: { answer: UpdateAnswer }) {
  const t = useT()
  const theme = useAmTheme()
  const hasStore = storeTarget(answer, appPlatform(), ANDROID_PACKAGE) !== null
  return (
    <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: theme.page }]}>
      <NoticeScreen
        eyebrow={t("update.required.eyebrow")}
        title={t("update.required.title")}
        body={t("update.required.body")}
        primary={hasStore ? { label: t("update.required.button"), onPress: () => openStore(answer) } : undefined}
      >
        {hasStore ? null : (
          <Text style={[styles.hint, { color: theme.textBody }]}>{t("update.required.noStore")}</Text>
        )}
      </NoticeScreen>
    </View>
  )
}

function Banner({ answer, onDismiss }: { answer: UpdateAnswer; onDismiss: () => void }) {
  const t = useT()
  const theme = useAmTheme()
  const insets = useSafeAreaInsets()
  const hasStore = storeTarget(answer, appPlatform(), ANDROID_PACKAGE) !== null
  return (
    <View
      pointerEvents="box-none"
      style={[styles.bannerWrap, { paddingTop: insets.top + amGap.text }]}
    >
      <View style={[styles.banner, { backgroundColor: theme.brand }]}>
        <Text style={[styles.bannerText, { color: theme.onBrand }]} numberOfLines={2}>
          {t("update.banner.text")}
        </Text>
        {hasStore ? (
          <Press
            accessibilityRole="button"
            accessibilityLabel={t("update.banner.button")}
            onPress={() => openStore(answer)}
            outerStyle={styles.action}
            style={styles.actionInner}
          >
            <Text style={[styles.actionText, { color: theme.onBrand }]}>{t("update.banner.button")}</Text>
          </Press>
        ) : null}
        <Press
          accessibilityRole="button"
          accessibilityLabel={t("update.banner.dismiss")}
          onPress={onDismiss}
          outerStyle={styles.action}
          style={styles.actionInner}
        >
          <Text style={[styles.actionText, styles.quiet, { color: theme.onBrand }]}>
            {t("update.banner.dismiss")}
          </Text>
        </Press>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cover: { zIndex: 1000, elevation: 1000 },
  hint: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  bannerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 900, elevation: 900, paddingHorizontal: amGap.gutter },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: amGap.text,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: amRadius.pill,
    minHeight: 48,
  },
  bannerText: { flex: 1, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 18 },
  action: { minHeight: 44, justifyContent: "center" },
  actionInner: { paddingHorizontal: 10, minHeight: 44, justifyContent: "center" },
  actionText: { fontFamily: amFonts.semi, fontSize: 14 },
  quiet: { opacity: 0.75 },
})
