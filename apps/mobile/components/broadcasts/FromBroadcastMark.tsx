import { StyleSheet, Text } from "react-native"
import { useRouter } from "expo-router"

import { AirGlyph } from "@/components/broadcasts/BroadcastCard"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useFromBroadcast } from "@/hooks/useFromBroadcast"
import { formatDate, useT } from "@/lib/i18n"
import { href } from "@/utils/href"

/**
 * "From a live broadcast: <title>, <date>" on a recording's page: a quiet row that opens the broadcast's page. Nothing at all
 * for a recording that did not come from one.
 */
export function FromBroadcastMark({ recordingId, theme }: { recordingId: string; theme: SongsTheme }) {
  const t = useT()
  const router = useRouter()
  const mark = useFromBroadcast(recordingId)
  if (!mark) return null
  const line = t("bc.rec.from", { title: mark.title, date: formatDate(mark.date, "medium") })
  return (
    <KPress accessibilityRole="link" accessibilityLabel={line} onPress={() => router.push(href(`/broadcast/${encodeURIComponent(mark.id)}`))} pressedScale={0.98} style={[s.row, { backgroundColor: theme.peach, borderColor: theme.line }]}>
      <AirGlyph color={theme.accent} size={24} />
      <Text style={[s.text, { color: theme.textHeading }]}>{line}</Text>
    </KPress>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 20, marginTop: 16 },
  text: { flex: 1, fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
})
