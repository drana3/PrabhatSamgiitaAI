import { StyleSheet, Text, View } from "react-native"
import { ChevronRight, TrendingUp } from "lucide-react-native"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { KPress } from "@/components/kirtan/KPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import type { ChartCardData } from "@/hooks/useKiirtanCharts"
import { useT } from "@/lib/i18n"

/**
 * "Most played": ONE quiet card (Dada, 12 Nov 2026; it replaced the two coloured cards "this week" and "all time"). The same white card as
 * the tiles of My Kiirtan: a round mark, the name, the period the card shows, and the first three recordings by name, no numbers.
 * The numbers of plays and the switch Week / Month / All time live on the screen it opens (app/top-played.tsx). Drawn only while the
 * week chart has enough rows (lib/kirtan/charts.ts).
 */
export function MostPlayedCard({ p, card, onOpen }: { p: AmProto; card: ChartCardData; onOpen: () => void }) {
  const t = useT()
  const title = t("kh.chart.title")
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={t("kh.chart.a11y", { title, first: card.lines[0]?.title ?? "" })}
      onPress={onOpen}
      pressedScale={0.98}
      outerStyle={styles.outer}
      style={[styles.card, { backgroundColor: p.white, borderColor: p.sand300 }]}
    >
      <View style={styles.head}>
        <View style={[styles.disc, { backgroundColor: p.orange100 }]}>
          <TrendingUp size={22} color={p.ink800} strokeWidth={1.9} />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: p.ink800 }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.sub, { color: p.ink500 }]} numberOfLines={1}>
            {t("kh.chart.sub")}
          </Text>
        </View>
        <ChevronRight size={20} color={p.ink500} strokeWidth={2.2} />
      </View>
      <View style={styles.lines}>
        {card.lines.map((line, i) => (
          <View key={line.rank} style={[styles.line, i > 0 && { borderTopColor: p.sand300, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.name, { color: p.ink800 }]} numberOfLines={1}>
              {line.title}
            </Text>
          </View>
        ))}
      </View>
    </KPress>
  )
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: HOME_INSET },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  lines: { paddingLeft: 52 },
  line: { minHeight: 36, justifyContent: "center" },
  name: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
})
