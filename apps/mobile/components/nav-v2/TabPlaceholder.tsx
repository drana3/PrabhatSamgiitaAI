import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { PressScale } from "@/components/today/motion"
import { amGap, amControl, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { navV2Layout } from "@/lib/navV2"
import { useAmTheme } from "@/hooks/useAmTheme"
import { href } from "@/utils/href"

/**
 * Stand-in for a tab whose redesigned screen is built on another branch.
 * It links to the screen that exists today. When the real route lands, replace the
 * file under app/v2/ with a re-export of it (see NAV_V2_TABS in lib/navV2.ts).
 */
export function TabPlaceholder({ title, note, legacyHref }: { title: string; note: string; legacyHref: string }) {
  const theme = useAmTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { contentInset } = navV2Layout(insets.bottom)

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <View style={[styles.body, { paddingHorizontal: amGap.gutter, paddingBottom: contentInset }]}>
        <Text style={[amType.label, { color: theme.eyebrow }]}>Coming from another branch</Text>
        <Text style={[styles.title, { color: theme.textHeading }]}>{title}</Text>
        <Text style={[styles.note, { color: theme.textBody }]}>{note}</Text>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Open the current ${title} screen`}
          onPress={() => router.push(href(legacyHref))}
          style={[styles.button, { backgroundColor: theme.brand }]}
        >
          <Text style={[styles.buttonText, { color: theme.onBrand }]}>Open the current screen</Text>
        </PressScale>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: "center", gap: amGap.text },
  title: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 48, textTransform: "uppercase" },
  note: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24 },
  button: {
    height: amControl.pillHeight,
    borderRadius: amRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 24,
  },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16 },
})
