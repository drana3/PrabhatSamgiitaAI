import { StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { mixHex } from "@/lib/playerV2/coverTint"
import type { ScriptId } from "@/lib/songPage/scripts"

import { SpPress } from "./SpUi"

/** Font of a lyric line in a script (Noto for Devanagari and Bengali, Roboto for Roman). */
function lineFont(script: ScriptId): { fontFamily: string; fontSize: number; lineHeight: number } {
  if (script === "devanagari") return { fontFamily: amFonts.devanagariBold, fontSize: 22, lineHeight: 34 }
  if (script === "bengali") return { fontFamily: amFonts.bengaliBold, fontSize: 22, lineHeight: 34 }
  return { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 30 }
}

/**
 * The Spotify lyrics card: the first lines of the song, big, on the colour of the cover. White on this tone
 * passes AA (the tints are picked for it). Tap opens the full player on its karaoke view.
 */
export function SpLyricsCard({
  t,
  tint,
  lines,
  script,
  onPress,
}: {
  t: SpTheme
  tint: string
  lines: string[]
  script: ScriptId
  onPress: () => void
}) {
  if (!lines.length) return null
  const font = lineFont(script)
  return (
    <SpPress
      onPress={onPress}
      accessibilityLabel="Lyrics preview. Open the player with the words"
      pressedScale={0.985}
      style={[styles.card, { backgroundColor: mixHex(tint, "#000000", t.dark ? 0.2 : 0.08) }]}
    >
      <View style={styles.head}>
        <Text style={styles.over}>Lyrics</Text>
        <View style={styles.open}>
          <Text style={styles.openText}>Sing along</Text>
          <PlayerIcon name="chevronDown" size={18} color="rgba(255,255,255,0.8)" />
        </View>
      </View>
      {lines.map((line, i) => (
        <Text key={`${i}-${line}`} style={[styles.line, font]} numberOfLines={2}>
          {line}
        </Text>
      ))}
    </SpPress>
  )
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 10, marginTop: 18, borderRadius: 30, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", color: "#F5C253" },
  open: { flexDirection: "row", alignItems: "center", gap: 2 },
  openText: { fontFamily: amFonts.semi, fontSize: 13, color: "rgba(255,255,255,0.8)" },
  line: { color: "#FFFFFF" },
})
