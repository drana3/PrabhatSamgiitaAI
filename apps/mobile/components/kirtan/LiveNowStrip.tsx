import { StyleSheet, Text, View } from "react-native"
import { ChevronRight } from "lucide-react-native"

import { LiveDot } from "@/components/kirtan/LiveCard"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { LiveItem } from "@/lib/kirtan/live"

/** Slim orange strip under the chips of Today while something is live: `LIVE NOW · title`. It opens the live screen. */
export function LiveNowStrip({ item, onOpen }: { item: LiveItem; onOpen: (item: LiveItem) => void }) {
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={`Live now: ${item.title}. Open`}
      onPress={() => onOpen(item)}
      pressedScale={0.985}
      outerStyle={styles.outer}
      style={styles.strip}
    >
      <LiveDot />
      <Text style={styles.text} numberOfLines={1}>
        <Text style={styles.bold}>LIVE NOW</Text>
        {` · ${item.title}`}
      </Text>
      <View>
        <ChevronRight size={18} color="#1E1E1E" strokeWidth={2.2} />
      </View>
    </KPress>
  )
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: 16 },
  strip: { height: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: amColors.orange500, flexDirection: "row", alignItems: "center", gap: 10 },
  text: { flex: 1, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 18, color: "#1E1E1E" },
  bold: { fontFamily: amFonts.bold, letterSpacing: 0.6 },
})
