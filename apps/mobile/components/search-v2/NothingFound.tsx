import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { amPhotoChip, amScrimPhoto } from "@/constants/tokens/amColors"
import { amProto, type AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { BrowseTile } from "@/lib/searchCards/browse"
import { searchPhoto } from "@/lib/searchCards/photo"
import { HINT_EXAMPLES, type SearchHint } from "@/lib/unifiedSearchQuery"

type P = { p: AmProto }

const HINTS: readonly { hint: SearchHint; label: "searchBy.row.number" | "searchBy.row.firstLine" | "searchBy.row.feeling" }[] = [
  { hint: "number", label: "searchBy.row.number" },
  { hint: "words", label: "searchBy.row.firstLine" },
  { hint: "feeling", label: "searchBy.row.feeling" },
]

/**
 * "Nothing found", made useful (Dada, 10 Nov 2026): what was looked for, what to try (a song number, a word of the first
 * line, a feeling: each one fills the field), the moods as photo tiles that open their lists, and a button that asks the team
 * to add the song. `message` is the engine's own line when it has one (a number out of range); else the usual help.
 */
export function NothingFound({
  p,
  query,
  message,
  moods,
  onTry,
  onMood,
  onAllMoods,
  onAsk,
}: P & {
  query: string
  message?: string | null
  moods: readonly BrowseTile[]
  onTry: (example: string) => void
  onMood: (tile: BrowseTile) => void
  onAllMoods: () => void
  onAsk: () => void
}) {
  const t = useT()
  return (
    <View style={s.root} testID="nothing-found">
      <View style={s.head} accessibilityLiveRegion="polite">
        <Text style={[s.title, { color: p.ink800 }]} accessibilityRole="header">
          {t("searchCards.none.title", { query })}
        </Text>
        <Text style={[s.body, { color: p.ink500 }]}>{message || t("search.noMatch")}</Text>
      </View>

      <View style={s.group}>
        <Text style={[overStyle, s.eyebrow, { color: p.orange700 }]}>{t("searchCards.none.try")}</Text>
        <View style={s.tries}>
          {HINTS.map(({ hint, label }) => (
            <TodayPress
              key={hint}
              accessibilityRole="button"
              accessibilityLabel={`${t(label)}: ${HINT_EXAMPLES[hint]}`}
              onPress={() => onTry(HINT_EXAMPLES[hint])}
              pressedScale={0.95}
              style={[s.chip, { backgroundColor: p.white, borderColor: p.sand300 }]}
            >
              <Text style={[s.chipLabel, { color: p.ink500 }]}>{t(label)}</Text>
              <Text style={[s.chipExample, { color: p.ink800 }]}>{HINT_EXAMPLES[hint]}</Text>
            </TodayPress>
          ))}
        </View>
      </View>

      {moods.length ? (
        <View style={s.group}>
          <Text style={[overStyle, s.eyebrow, { color: p.orange700 }]}>{t("searchCards.none.moods")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.moods} keyboardShouldPersistTaps="handled">
            {moods.map((tile) => (
              <TodayPress key={tile.key} accessibilityRole="button" accessibilityLabel={tile.label} onPress={() => onMood(tile)} pressedScale={0.97} style={s.mood} testID={`nothing-mood-${tile.key}`}>
                <Image source={searchPhoto(tile.photo, tile.key).thumb} contentFit="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
                <LinearGradient pointerEvents="none" colors={[amScrimPhoto[0], amScrimPhoto[1]]} locations={[0.1, 1]} style={StyleSheet.absoluteFill} />
                <Text style={s.moodLabel} numberOfLines={1}>
                  {tile.label}
                </Text>
              </TodayPress>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={s.buttons}>
        <TodayPress accessibilityRole="button" accessibilityLabel={t("searchCards.none.browseMood")} onPress={onAllMoods} pressedScale={0.95} style={[s.button, { backgroundColor: p.action }]}>
          <Text style={[s.buttonText, { color: p.onAction }]}>{t("searchCards.none.browseMood")}</Text>
        </TodayPress>
        <TodayPress accessibilityRole="button" accessibilityLabel={t("searchCards.none.ask.a11y", { query })} onPress={onAsk} pressedScale={0.95} style={[s.button, { backgroundColor: p.white, borderColor: p.sand300, borderWidth: 1 }]} testID="ask-to-add">
          <Text style={[s.buttonText, { color: p.ink800 }]}>{t("searchCards.none.ask")}</Text>
        </TodayPress>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 28 },
  head: { gap: 8, paddingHorizontal: HOME_INSET },
  title: { fontFamily: amFonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  body: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, maxWidth: 340 },
  group: { gap: 12 },
  eyebrow: { paddingHorizontal: HOME_INSET },
  tries: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: HOME_INSET },
  chip: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 22, borderWidth: 1, justifyContent: "center" },
  chipLabel: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 15 },
  chipExample: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 19 },
  moods: { gap: 10, paddingHorizontal: HOME_INSET },
  mood: { width: 132, height: 92, borderRadius: 16, overflow: "hidden", justifyContent: "flex-end", padding: 10, backgroundColor: amPhotoChip.glass.bg },
  moodLabel: { fontFamily: amFonts.display, fontSize: 15, lineHeight: 18, color: amPhotoChip.glass.fg, textTransform: "uppercase" },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: HOME_INSET },
  button: { height: 48, paddingHorizontal: 22, borderRadius: 70, justifyContent: "center", alignItems: "center" },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
