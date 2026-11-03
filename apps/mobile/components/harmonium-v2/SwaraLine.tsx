import { Pressable, StyleSheet, Text, View } from "react-native"

import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { DisplayWord } from "@/lib/harmonium-v2/lines"

type Props = {
  theme: AmTheme
  words: readonly DisplayWord[]
  /** chord drawn as selected (matches by name) */
  activeChord?: string | null
  /** tapping a chord letter */
  onChordPress?: (chord: string) => void
}

/**
 * A lyric line as the harmonium player reads it: chord letter above the word where
 * the chord changes, swara below it. Words wrap onto new rows; each word keeps its
 * chord and swara in one column so they never drift apart.
 */
export function SwaraLine({ theme, words, activeChord, onChordPress }: Props) {
  return (
    <View style={styles.line}>
      {words.map((entry, index) => {
        const active = Boolean(entry.chord) && entry.chord === activeChord
        return (
          <View key={`${entry.word}-${index}`} style={styles.column}>
            {entry.chord ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Chord ${entry.chord}, show the keys`}
                accessibilityState={{ selected: active }}
                hitSlop={8}
                disabled={!onChordPress}
                onPressIn={() => onChordPress?.(entry.chord!)}
                style={[
                  styles.chord,
                  { backgroundColor: active ? amColors.orange500 : "transparent", borderColor: active ? amColors.orange500 : theme.line },
                ]}
              >
                <Text style={[styles.chordText, { color: active ? amColors.white : theme.eyebrow }]}>{entry.chord}</Text>
              </Pressable>
            ) : (
              <View style={styles.chordGap} />
            )}
            <Text style={[styles.word, { color: theme.textHeading }]}>{entry.word}</Text>
            <Text style={[styles.swara, { color: theme.textBody }]}>{entry.swara ?? " "}</Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 12 },
  column: { alignItems: "flex-start", minWidth: 40 },
  chord: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chordGap: { height: 28 },
  chordText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
  word: { fontFamily: amFonts.medium, fontSize: 18, lineHeight: 24, marginTop: 4 },
  swara: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16 },
})
