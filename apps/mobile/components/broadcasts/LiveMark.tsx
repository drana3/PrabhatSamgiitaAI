import { StyleSheet, Text, View } from "react-native"

import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { BroadcastPhase } from "@/lib/broadcasts/types"

/**
 * The mark of a broadcast's phase: a word and a dot, never colour alone. "Live" is the filled one (white on the strong
 * orange), "Upcoming" an outline, "Ended" quiet text.
 */
export function LiveMark({ phase, theme, day }: { phase: BroadcastPhase; theme: SongsTheme; day?: { day: number; total: number | null } | null }) {
  const t = useT()
  // a broadcast that runs for days says which day it is on: "Live · Day 3 of 9"
  const span = phase === "now" && day ? (day.total ? t("bc.p.day.of", { day: day.day, total: day.total }) : t("bc.p.day", { day: day.day })) : null
  const label = phase === "now" ? (span ? `${t("bc.p.live")} · ${span}` : t("bc.p.live")) : phase === "upcoming" ? t("bc.p.upcoming") : t("bc.p.ended")
  const live = phase === "now"
  return (
    <View
      style={[s.pill, live ? { backgroundColor: amColors.orange700, borderColor: amColors.orange700 } : { backgroundColor: "transparent", borderColor: phase === "upcoming" ? theme.accent : theme.line }]}
      accessible
      accessibilityLabel={label}
    >
      {live ? <View style={s.dot} /> : null}
      <Text style={[s.text, { color: live ? "#FFFFFF" : phase === "upcoming" ? theme.accent : theme.textMuted }]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, height: 28, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  text: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" },
})
