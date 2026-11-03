import { StyleSheet, Text, View } from "react-native"

import { Card, SectionHeading } from "@/components/song-v2/common"
import { scriptTextStyle } from "@/components/song-v2/scriptText"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"
import { splitWords } from "@/lib/songPage/chordChart"
import { alignWords, glossFor, type WordGlosses } from "@/lib/songPage/songContent"
import { localeLabel } from "@/constants/languages"

/**
 * Word by word (SCR-16 item 5, round 11). Each tile: the word, its Devanagari
 * when both lines have the same number of words, and the gloss in the chosen
 * language. A word with no gloss says so. Shown only when reviewed glosses exist.
 */
export function WordsSection({
  theme,
  romanLines,
  devanagariLines,
  glosses,
  languages,
  onMissingGloss,
}: {
  theme: AmTheme
  romanLines: string[]
  devanagariLines: string[]
  glosses: WordGlosses
  languages: string[]
  onMissingGloss: () => void
}) {
  const primary = languages[0] ?? "en"
  const englishOnly = primary !== "en" && !glosses.byLanguage[primary]
  return (
    <View style={styles.section}>
      <SectionHeading theme={theme}>Words</SectionHeading>
      {englishOnly ? <Text style={[amType.body, { color: theme.textBody }]}>Word meanings in English only</Text> : null}
      <Card theme={theme} style={styles.card}>
        {romanLines.map((line, l) => {
          const deva = alignWords(line, devanagariLines[l])
          return (
            <View key={l} style={styles.line}>
              {splitWords(line).map((word, w) => {
                const gloss = glossFor(glosses, languages, l, w)
                return (
                  <View key={w} style={[styles.tile, { backgroundColor: theme.inner, borderColor: theme.line }]}>
                    <Text style={[styles.word, { color: theme.textHeading }]}>{word}</Text>
                    {deva ? (
                      <Text style={[scriptTextStyle("devanagari", amFontSize.body), { color: theme.textMuted }]}>
                        {deva[w]}
                      </Text>
                    ) : null}
                    {gloss ? (
                      <Text style={[amType.body, { color: theme.textBody }]}>
                        {gloss.language !== primary ? `${gloss.text} (${localeLabel(gloss.language)})` : gloss.text}
                      </Text>
                    ) : (
                      <Text
                        style={[amType.body, { color: theme.textMuted }]}
                        onPress={onMissingGloss}
                        accessibilityRole="link"
                      >
                        No gloss yet · Tell us
                      </Text>
                    )}
                  </View>
                )
              })}
            </View>
          )
        })}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: amSpace.s3 },
  card: { gap: amSpace.s4 },
  line: { flexDirection: "row", flexWrap: "wrap", gap: amSpace.s2 },
  tile: {
    borderRadius: amRadius.sm,
    borderWidth: 1,
    paddingHorizontal: amSpace.s3,
    paddingVertical: amSpace.s2,
    minHeight: 44,
    gap: 2,
  },
  word: { fontFamily: amFonts.bold, fontSize: amFontSize.body },
})
