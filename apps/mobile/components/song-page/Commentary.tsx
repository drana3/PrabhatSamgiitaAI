import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { lyricLanguage, lyricLanguageName } from "@/lib/songPage/lyricLanguages"
import type { MeaningSource } from "@/lib/songPage/meaningInfo"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"

import { Eyebrow } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

export function sourceLabel(tr: PageT, source: MeaningSource): string {
  return source === "official" ? tr("songPage.meaning.official") : source === "reviewed" ? tr("songPage.meaning.reviewed") : tr("songPage.meaning.machine")
}

/**
 * "Commentary in English". One language at a time, the one chosen in the text options (there is no second
 * chooser here). When the language asked for is missing, it says that English is shown instead.
 */
function CommentaryHeader({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  const meaning = model.meaning
  // the name in its own script ("Русский"), so the sentence reads the same in any language of the app
  const nameOf = (code: string) => lyricLanguage(code)?.native ?? lyricLanguageName(code)
  const name = nameOf(meaning.status === "none" && meaning.wanted ? meaning.wanted : meaning.language)
  const wantedName = nameOf(meaning.wanted)
  // the sentence has the language in it; split it there so the name can be bold in any language
  const [lead = "", tail = ""] = tr("songPage.meaning.in", { language: "\u0001" }).split("\u0001")
  return (
    <View style={styles.header}>
      <Text style={[styles.headerLine, { color: t.ink800 }]}>
        <Text>{lead}</Text>
        <Text style={{ fontFamily: amFonts.bold, color: t.ink900 }}>{name}</Text>
        {tail ? <Text>{tail}</Text> : null}
      </Text>
      {meaning.fellBack ? (
        <Text style={[styles.headerNote, { color: t.ink500 }]}>{tr("songPage.meaning.unavailable", { language: wantedName })}</Text>
      ) : meaning.status === "none" && meaning.wanted !== "en" ? (
        <Text style={[styles.headerNote, { color: t.ink500 }]}>{tr("songPage.meaning.unavailableNone", { language: wantedName })}</Text>
      ) : null}
    </View>
  )
}

/** The explanation of the song in plain words, only when a reviewed one exists (see songContent.explanationIsUsable). */
function Explanation({ t, tr, model }: { t: SpTheme; tr: PageT; model: SongPageModel }) {
  const e = model.explanation
  if (!e) {
    return (
      <View style={[styles.slot, { borderColor: t.ink500 }]}>
        <Eyebrow t={t}>{tr("songPage.commentary.plain")}</Eyebrow>
        <Text style={[styles.slotText, { color: t.ink500 }]}>{tr("songPage.commentary.plain.none")}</Text>
      </View>
    )
  }
  return (
    <View style={styles.explain}>
      <Eyebrow t={t}>{tr("songPage.commentary.plain")}</Eyebrow>
      <Text style={[styles.body, { color: t.ink900 }]}>{e.summary}</Text>
      {e.keyPoints.map((point, i) => (
        <Text key={i} style={[styles.point, { color: t.ink900 }]}>{`•  ${point}`}</Text>
      ))}
      {e.keyTerms.map((term) => (
        <Text key={term.term} style={[styles.point, { color: t.ink800 }]}>
          <Text style={{ fontFamily: amFonts.bold, color: t.ink900 }}>{term.term}</Text>
          {` · ${term.meaning}`}
        </Text>
      ))}
    </View>
  )
}

/**
 * THE COMMENTARY TAB (board 3, variant A: one white card). The central idea when the data has one, then the
 * explanation in plain words (a dashed note says honestly when none is written), and where it comes from.
 */
export function CommentaryBody({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  const meaning = model.meaning
  const central = meaning.central
  const empty = !central && !model.explanation
  return (
    <View>
      <CommentaryHeader t={t} model={model} />
      <View style={[styles.card, { backgroundColor: t.white }]}>
        {central ? (
          <View style={[styles.central, { backgroundColor: t.dark ? t.sand100 : t.sage200 }]}>
            <Text style={[styles.centralLabel, { color: t.dark ? t.ink500 : t.sage800 }]}>
              {`${tr("songPage.meaning.centralIdea")} · ${meaning.source === "official" ? tr("songPage.meaning.officialTag") : tr("songPage.meaning.machineTag")}`}
            </Text>
            <Text style={[styles.centralText, { color: t.dark ? t.ink900 : t.sage900 }]}>{central}</Text>
          </View>
        ) : null}
        {empty ? (
          <Text style={[styles.body, { color: t.ink500 }]}>
            {meaning.status === "loading" ? tr("songPage.meaning.loading", { language: lyricLanguageName(meaning.wanted) }) : tr("songPage.commentary.empty")}
          </Text>
        ) : (
          <Explanation t={t} tr={tr} model={model} />
        )}
        {central ? <Text style={[styles.source, { color: t.ink500 }]}>{tr("songPage.meaning.source")}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { gap: 2, paddingHorizontal: 20, paddingBottom: 12 },
  headerLine: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  headerNote: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  card: { marginHorizontal: 20, borderRadius: 24, padding: 16, gap: 16 },
  central: { borderRadius: 20, padding: 18, gap: 8 },
  centralLabel: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  centralText: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 26 },
  explain: { gap: 8, paddingHorizontal: 4 },
  body: { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 27 },
  point: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 24 },
  slot: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  slotText: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  source: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
})
