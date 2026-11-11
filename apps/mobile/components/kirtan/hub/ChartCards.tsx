import { StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { ChevronRight } from "lucide-react-native"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { ChartCardData } from "@/hooks/useKiirtanCharts"
import { kiirtanTone } from "@/lib/kirtan/tone"
import { useT } from "@/lib/i18n"

/** Week: the kiirtan colours; all time: the bhajan colours (lib/kirtan/tone.ts), so two charts read as two cards. */
function tone(id: ChartCardData["chart"]["id"]): readonly [string, string] {
  return id === "week" ? kiirtanTone("bnk", "kiirtan") : kiirtanTone("devotional", "bhajan")
}

/**
 * "Charts": a card per chart with the first three places by name (the number of plays is only on the full screen the card
 * opens). Drawn only for the charts that have enough rows (lib/kirtan/charts.ts).
 */
export function ChartCards({ cards, onOpen }: { cards: readonly ChartCardData[]; onOpen: (card: ChartCardData) => void }) {
  const t = useT()
  return (
    <View style={styles.list}>
      {cards.map((card) => {
        const [from, to] = tone(card.chart.id)
        const title = t(card.chart.titleKey)
        return (
          <KPress
            key={card.chart.id}
            accessibilityRole="button"
            accessibilityLabel={t("kh.chart.a11y", { title, first: card.lines[0]?.title ?? "" })}
            onPress={() => onOpen(card)}
            pressedScale={0.98}
            style={[styles.card, { backgroundColor: to }]}
          >
            <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.head}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <ChevronRight size={20} color={amColors.white} strokeWidth={2.4} />
            </View>
            {card.lines.map((line) => (
              <View key={line.rank} style={styles.line}>
                <Text style={styles.place}>{line.rank}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {line.title}
                </Text>
              </View>
            ))}
          </KPress>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingHorizontal: HOME_INSET },
  card: { borderRadius: 24, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { flex: 1, fontFamily: amFonts.display, fontSize: 16, lineHeight: 18, textTransform: "uppercase", letterSpacing: -0.2, color: amColors.white },
  line: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  place: { width: 18, fontFamily: amFonts.display, fontSize: 18, lineHeight: 22, color: "rgba(255,255,255,0.7)" },
  name: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, color: amColors.white },
})
