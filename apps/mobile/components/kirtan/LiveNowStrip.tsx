import { StyleSheet, Text, View } from "react-native"
import { ChevronRight } from "lucide-react-native"

import { LiveDot } from "@/components/kirtan/LiveCard"
import { KPress } from "@/components/kirtan/KPress"
import { useAmTheme } from "@/hooks/useAmTheme"
import { amColors, amDarkSurface } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { LiveItem } from "@/lib/kirtan/live"

/** Slim neutral strip (ink in Light, raised surface in Dark; bright orange only in the pulsing dot) under the chips of Today while something is live: `LIVE NOW · title`. It opens the live screen. */
export function LiveNowStrip({ item, onOpen }: { item: LiveItem; onOpen: (item: LiveItem) => void }) {
  const theme = useAmTheme()
  const dark = theme.page === amDarkSurface.page
  const bg = dark ? amDarkSurface.inner : amColors.ink900
  const fg = dark ? amDarkSurface.heading : amColors.white
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={`Live now: ${item.title}. Open`}
      onPress={() => onOpen(item)}
      pressedScale={0.985}
      outerStyle={styles.outer}
      style={[styles.strip, { backgroundColor: bg }]}
    >
      <LiveDot color={amColors.orange500} />
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        <Text style={styles.bold}>LIVE NOW</Text>
        {` · ${item.title}`}
      </Text>
      <View>
        <ChevronRight size={18} color={fg} strokeWidth={2.2} />
      </View>
    </KPress>
  )
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: 16 },
  strip: { height: 40, borderRadius: 20, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  text: { flex: 1, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 18 },
  bold: { fontFamily: amFonts.bold, letterSpacing: 0.6 },
})
