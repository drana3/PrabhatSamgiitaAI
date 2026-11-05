import { StyleSheet, Text, View } from "react-native"

import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { hiddenLine } from "@/lib/songsV2/rowMenu"

/**
 * "3 hidden · Show": a quiet line under a list's header while songs are hidden from it, so the listener
 * never loses songs silently. Show brings them all back. Nothing is drawn when nothing is hidden.
 */
export function HiddenLine({ theme, count, onShow }: { theme: SongsTheme; count: number; onShow: () => void }) {
  const line = hiddenLine(count)
  if (!line) return null
  return (
    <View style={styles.row} accessibilityRole="summary">
      <Text style={[styles.text, { color: theme.textBody }]}>{line} · </Text>
      <Press
        accessibilityRole="button"
        accessibilityLabel={`Show ${count} hidden ${count === 1 ? "song" : "songs"}`}
        onPress={onShow}
        pressedScale={0.94}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={[styles.show, { color: theme.accent }]}>Show</Text>
      </Press>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12 },
  text: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
  show: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
})
