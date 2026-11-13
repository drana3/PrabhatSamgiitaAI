import { StyleSheet, Text, View } from "react-native"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"

import { TuneGlyph } from "./Glyphs"

/**
 * The small pill of the chords card: "C · No capo", "D · Capo 2", "Sa on C". With `onPress` it opens the capo sheet; without
 * it (the colleagues' pages, which only say where the document puts the capo) it is the same pill, not pressable.
 */
export function TunePill({ t, text, a11y, onPress }: { t: SpTheme; text: string; a11y: string; onPress?: () => void }) {
  const inner = (
    <>
      <TuneGlyph size={16} color={t.ink800} />
      <Text style={[styles.pillText, { color: t.ink900 }]} numberOfLines={1}>
        {text}
      </Text>
    </>
  )
  const look = [styles.pill, { backgroundColor: t.sand100, borderColor: t.sand400 }]
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y} style={look}>
        {inner}
      </View>
    )
  }
  return (
    <SpPress onPress={onPress} accessibilityLabel={a11y} pressedScale={0.96} hitSlop={4} style={look}>
      {inner}
    </SpPress>
  )
}

const styles = StyleSheet.create({
  pill: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 9999, borderWidth: 1 },
  pillText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18, flexShrink: 1 },
})
