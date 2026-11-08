import { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"

import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { isWhiteKey, noteNameOfMidi, swaraOfMidi, type KeyboardWindow } from "@/lib/pianoNotes/keys"
import type { PianoHand } from "@/lib/pianoNotes/types"

const WHITE_HEIGHT = 168
const BLACK_HEIGHT = 102
const MIN_WHITE_WIDTH = 24
const FIXED_WHITE_WIDTH = 30
const BLACK_RATIO = 0.62

/**
 * A piano keyboard of several octaves. `lit` colours the keys of the step that is shown (right hand orange, left hand
 * ink). With `onPressKey` a key answers on touch-down. Every key says its swara for the Sa in use (the notes of Sa on
 * C are the white keys); the C keys also say their octave so a player finds their place. A window wider than the phone
 * scrolls sideways instead of making the keys too thin to hit.
 */
export function PianoKeyboard({
  theme,
  window: range,
  sa,
  lit,
  onPressKey,
  labels = true,
}: {
  theme: SongsTheme
  window: KeyboardWindow
  sa: string
  lit?: ReadonlyMap<number, PianoHand>
  onPressKey?: (midi: number) => void
  labels?: boolean
}) {
  const [width, setWidth] = useState(0)
  const keys = useMemo(() => {
    const whites: number[] = []
    const blacks: Array<{ midi: number; after: number }> = []
    for (let midi = range.start; midi <= range.end; midi += 1) {
      if (isWhiteKey(midi)) whites.push(midi)
      else blacks.push({ midi, after: whites.length - 1 })
    }
    return { whites, blacks }
  }, [range.start, range.end])
  const fits = width > 0 && width / keys.whites.length >= MIN_WHITE_WIDTH
  const whiteWidth = fits ? width / keys.whites.length : FIXED_WHITE_WIDTH
  const total = whiteWidth * keys.whites.length
  const colour = (midi: number, hand: PianoHand | undefined, base: string) => (hand === "left" ? theme.ink900 : hand === "right" ? amColors.orange700 : base)
  const body = (
    <View style={{ width: total, height: WHITE_HEIGHT - 6 }}>
      <View style={styles.whites}>
        {keys.whites.map((midi) => {
          const hand = lit?.get(midi)
          const on = hand !== undefined
          const ink = on ? "#FFFFFF" : "#5B5652"
          return (
            <Pressable
              key={midi}
              disabled={!onPressKey}
              onPressIn={() => onPressKey?.(midi)}
              accessibilityRole={onPressKey ? "button" : "image"}
              accessibilityLabel={`${swaraOfMidi(midi, sa)}, ${noteNameOfMidi(midi)}`}
              accessibilityState={{ selected: on }}
              style={[styles.white, { width: whiteWidth, backgroundColor: colour(midi, hand, "#FBF8F4"), borderColor: theme.line }]}
            >
              {labels ? <Text style={[styles.swara, { color: ink }]}>{swaraOfMidi(midi, sa)}</Text> : null}
              {labels && midi % 12 === 0 ? <Text style={[styles.octave, { color: ink }]}>{`C${Math.floor(midi / 12) - 1}`}</Text> : null}
            </Pressable>
          )
        })}
      </View>
      {keys.blacks.map(({ midi, after }) => {
        const hand = lit?.get(midi)
        const bw = whiteWidth * BLACK_RATIO
        return (
          <Pressable
            key={midi}
            disabled={!onPressKey}
            onPressIn={() => onPressKey?.(midi)}
            accessibilityRole={onPressKey ? "button" : "image"}
            accessibilityLabel={`${swaraOfMidi(midi, sa)}, ${noteNameOfMidi(midi)}`}
            accessibilityState={{ selected: hand !== undefined }}
            style={[styles.black, { left: (after + 1) * whiteWidth - bw / 2, width: bw, backgroundColor: colour(midi, hand, "#1E1E1E") }]}
          >
            {labels && whiteWidth >= 26 ? <Text style={styles.blackText}>{swaraOfMidi(midi, sa)}</Text> : null}
          </Pressable>
        )
      })}
    </View>
  )
  return (
    <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={styles.frame}>
      {fits || width === 0 ? body : <ScrollView horizontal showsHorizontalScrollIndicator={false}>{body}</ScrollView>}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { width: "100%", borderRadius: 12, overflow: "hidden", backgroundColor: "#1E1E1E", paddingTop: 6, paddingHorizontal: 0 },
  whites: { flexDirection: "row", height: WHITE_HEIGHT - 6 },
  white: { height: "100%", borderRightWidth: StyleSheet.hairlineWidth, justifyContent: "flex-end", alignItems: "center", paddingBottom: 6, gap: 1 },
  swara: { fontFamily: amFonts.bold, fontSize: 9, lineHeight: 12 },
  octave: { fontFamily: amFonts.medium, fontSize: 8, lineHeight: 10, opacity: 0.8 },
  black: { position: "absolute", top: 0, height: BLACK_HEIGHT, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, alignItems: "center", justifyContent: "flex-end", paddingBottom: 4 },
  blackText: { fontFamily: amFonts.bold, fontSize: 7, lineHeight: 9, color: "#FFFFFF", opacity: 0.85 },
})
