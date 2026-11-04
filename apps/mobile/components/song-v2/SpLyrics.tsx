import { Pressable, StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { ScriptId } from "@/lib/songPage/scripts"
import type { SpLine } from "@/lib/songPage/spLines"

import { SpIcon } from "./SpIcon"
import { SpCard, SpPress } from "./SpUi"

/** Font family and size of a word in a script (`.wd`, `.dv .wd`). */
function wordFont(script: ScriptId): { fontFamily: string; fontSize: number; lineHeight: number } {
  if (script === "devanagari") return { fontFamily: amFonts.devanagari, fontSize: 20, lineHeight: 30 }
  if (script === "bengali") return { fontFamily: amFonts.bengali, fontSize: 20, lineHeight: 30 }
  return { fontFamily: amFonts.medium, fontSize: 19, lineHeight: 28 }
}

/** `.tools`: the script and translation pill, and the Chords toggle. */
export function SpTools({
  t,
  langPill,
  chordsAvailable,
  chordsOn,
  onLang,
  onChords,
}: {
  t: SpTheme
  langPill: string
  chordsAvailable: boolean
  chordsOn: boolean
  onLang: () => void
  onChords: () => void
}) {
  return (
    <View style={styles.tools}>
      <SpPress
        onPress={onLang}
        accessibilityLabel="Script and translations"
        style={[styles.tpill, { backgroundColor: t.white, borderColor: t.sand300 }]}
      >
        <Text style={[styles.tpillText, { color: t.ink800 }]} numberOfLines={1}>
          {langPill}
        </Text>
        <SpIcon name="chevDown" size={14} color={t.ink500} strokeWidth={2} />
      </SpPress>
      {chordsAvailable ? (
        <SpPress
          onPress={onChords}
          accessibilityState={{ selected: chordsOn }}
          accessibilityLabel="Chords"
          style={[
            styles.tpill,
            { backgroundColor: chordsOn ? t.ink900 : t.white, borderColor: chordsOn ? t.ink900 : t.sand300 },
          ]}
        >
          <Text style={[styles.tpillText, { color: chordsOn ? t.onInk : t.ink800 }]}>Chords</Text>
        </SpPress>
      ) : null}
    </View>
  )
}

/** `.chordchip`: what the chords are set to; "Change" jumps to the Chords section. */
export function SpChordChip({ t, text, onPress }: { t: SpTheme; text: string; onPress: () => void }) {
  return (
    <SpPress
      onPress={onPress}
      accessibilityLabel="Chord settings, opens the Chords tab"
      style={[styles.chordChip, { backgroundColor: t.orange100 }]}
    >
      <Text style={[styles.chordChipText, { color: t.orange700 }]} numberOfLines={1}>
        {text}
      </Text>
      <Text style={[styles.chordChipGo, { color: t.orange700 }]}>Change</Text>
    </SpPress>
  )
}

/** `.gloss`: the sage card that shows the meaning of the word you touch. */
export function SpGloss({ t, title, detail }: { t: SpTheme; title: string; detail: string }) {
  return (
    <View style={[styles.gloss, { backgroundColor: t.sage200 }]} accessibilityLiveRegion="polite">
      <Text style={[styles.glossTitle, { color: t.sage900 }]}>{title}</Text>
      <Text style={[styles.glossDetail, { color: t.sage900 }]}>{detail}</Text>
    </View>
  )
}

/**
 * `.tcard` of the Lyrics tab: the gloss card, then each line as word buttons with the translation lines and a hairline
 * under it. With chords on, a word is a column: chord above, word, swara below (harmonium).
 */
export function SpLyrics({
  t,
  lines,
  script,
  secondScript,
  selected,
  onSelect,
  glossTitle,
  glossDetail,
  chordsOn,
  emptyText,
}: {
  t: SpTheme
  lines: SpLine[]
  script: ScriptId
  secondScript: ScriptId | null
  selected: string | null
  onSelect: (key: string) => void
  glossTitle: string
  glossDetail: string
  chordsOn: boolean
  emptyText: string
}) {
  const font = wordFont(script)
  return (
    <SpCard t={t}>
      <SpGloss t={t} title={glossTitle} detail={glossDetail} />
      {lines.length === 0 ? (
        <Text style={{ fontFamily: amFonts.regular, fontSize: 17, lineHeight: 26, color: t.ink500 }}>{emptyText}</Text>
      ) : (
        <View style={styles.toks}>
          {lines.map((line, li) => (
            <View key={li} style={styles.lineBlock}>
              <View style={styles.wordRow}>
                {line.tokens.map((token) => {
                  const on = selected === token.key
                  return (
                    <Pressable
                      key={token.key}
                      accessibilityRole="button"
                      accessibilityLabel={token.text}
                      accessibilityState={{ selected: on }}
                      onPress={() => onSelect(token.key)}
                      onHoverIn={() => onSelect(token.key)}
                      onFocus={() => onSelect(token.key)}
                      style={[
                        styles.wd,
                        chordsOn && styles.wdWithCh,
                        on && { backgroundColor: t.orange500 },
                      ]}
                    >
                      {chordsOn ? (
                        <Text style={[styles.wch, { color: t.orange700 }]}>{token.chord}</Text>
                      ) : null}
                      <Text
                        style={[
                          font,
                          { color: on ? "#FFFFFF" : t.ink800 },
                          !on && {
                            textDecorationLine: "underline",
                            textDecorationStyle: "dotted",
                            textDecorationColor: t.ink300,
                          },
                        ]}
                      >
                        {token.text}
                      </Text>
                      {chordsOn ? <Text style={[styles.wsw, { color: t.ink500 }]}>{token.swara}</Text> : null}
                    </Pressable>
                  )
                })}
              </View>
              {line.second ? (
                <Text
                  style={[
                    styles.sub,
                    { color: t.ink500, fontStyle: "normal", fontFamily: wordFont(secondScript ?? "devanagari").fontFamily },
                  ]}
                >
                  {line.second}
                </Text>
              ) : null}
              {line.translations.map((text, k) => (
                <Text
                  key={k}
                  style={[
                    styles.sub,
                    k === 0
                      ? { color: t.ink500, fontStyle: "italic" }
                      : { color: t.ink800, fontStyle: "normal", fontFamily: amFonts.medium, paddingTop: 0 },
                  ]}
                >
                  {text}
                </Text>
              ))}
              {li < lines.length - 1 ? <View style={[styles.brk, { backgroundColor: t.sand300 }]} /> : null}
            </View>
          ))}
        </View>
      )}
    </SpCard>
  )
}

const styles = StyleSheet.create({
  tools: { flexDirection: "row", gap: 5, paddingHorizontal: 10 },
  tpill: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 70,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  tpillText: { fontFamily: amFonts.semi, fontSize: 13.5 },
  chordChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
    marginHorizontal: 10,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 70,
  },
  chordChipText: { fontFamily: amFonts.semi, fontSize: 14, flexShrink: 1 },
  chordChipGo: { fontFamily: amFonts.bold, fontSize: 13, textDecorationLine: "underline" },
  gloss: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, minHeight: 64, justifyContent: "center", gap: 2 },
  glossTitle: { fontFamily: amFonts.display, fontSize: 18, lineHeight: 22, letterSpacing: -0.18 },
  glossDetail: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20.3 },
  toks: {},
  lineBlock: {},
  wordRow: { flexDirection: "row", flexWrap: "wrap", columnGap: 2 },
  wd: { paddingHorizontal: 8, paddingVertical: 8, minHeight: 44, borderRadius: 70, justifyContent: "center" },
  wdWithCh: { paddingTop: 0, minHeight: 60, alignItems: "flex-start" },
  wch: { minHeight: 22, fontFamily: amFonts.display, fontSize: 16, lineHeight: 22, letterSpacing: -0.16 },
  wsw: { minHeight: 16, fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.48, marginTop: -2 },
  sub: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22, paddingHorizontal: 8, paddingBottom: 8 },
  brk: { height: 1, marginTop: 4, marginBottom: 8 },
})
