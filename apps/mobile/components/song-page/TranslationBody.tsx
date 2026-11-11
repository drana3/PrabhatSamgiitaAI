import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useColleagueTexts } from "@/hooks/useColleagueData"
import { langOfVariant, pickVariant, type TranslationVariant } from "@/lib/psColleagues/translations"
import { useLanguage } from "@/lib/i18n"
import { meaningKind } from "@/lib/songPage/songTabs"
import { versionsOf } from "@/lib/songTranslations/derive"
import type { SongTranslation, TranslationKind } from "@/lib/songTranslations/types"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"

import { ColleagueVersions, VariantChips } from "./ColleagueTranslation"
import type { PageUi } from "./state"
import { Eyebrow, QuietNote } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

const KIND_LABEL: Record<TranslationKind, "songPage.translation.official" | "songPage.translation.poetic" | "songPage.translation.literal"> = {
  official: "songPage.translation.official",
  poetic: "songPage.translation.poetic",
  literal: "songPage.translation.literal",
}

/** One text of the translation: its words, the "Checked" mark only for a text the team checked, the credit, and its commentary (not drawn when empty). */
function Version({ t, tr, item, scale, heading }: { t: SpTheme; tr: PageT; item: SongTranslation; scale: number; heading: string | null }) {
  const size = Math.round(17 * scale)
  const paragraphs = item.text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return (
    <View style={styles.version}>
      {heading ? <Eyebrow t={t}>{heading}</Eyebrow> : null}
      <View style={styles.text}>
        {paragraphs.map((paragraph, i) => (
          <Text key={i} style={[styles.body, { color: t.ink900, fontSize: size, lineHeight: Math.round(size * 1.6) }]}>
            {paragraph}
          </Text>
        ))}
      </View>
      {item.checked || item.creditLine ? (
        <View style={styles.meta}>
          {item.checked ? (
            <View style={[styles.checked, { backgroundColor: t.dark ? t.sand100 : t.sage200 }]} accessibilityLabel={tr("songPage.translation.checked.a11y")}>
              <SpIcon name="check" size={14} color={t.dark ? t.ink900 : t.sage800} strokeWidth={2.6} />
              <Text style={[styles.checkedText, { color: t.dark ? t.ink900 : t.sage800 }]}>{tr("songPage.translation.checked")}</Text>
            </View>
          ) : null}
          {item.creditLine ? <Text style={[styles.credit, { color: t.ink500 }]}>{item.creditLine}</Text> : null}
        </View>
      ) : null}
      {item.commentary ? (
        <View style={[styles.commentary, { backgroundColor: t.white }]}>
          <Eyebrow t={t}>{tr("songPage.translation.commentary")}</Eyebrow>
          <Text style={[styles.commentaryText, { color: t.ink900 }]}>{item.commentary}</Text>
        </View>
      ) : null}
    </View>
  )
}

/**
 * THE TRANSLATION. One text, no choice of kind (decision of 11 November 2026): the Official translation when the song has
 * one, else the only kind it has. When the text is not the official one, a small line names its kind. Under the text come
 * the credit and the commentary of the translation, drawn only when there are some. A second official version (91 songs
 * have one) is the "Other version" under the first. Everything comes from the translations the server serves; nothing is
 * made up here (see lib/songTranslations).
 */
export function TranslationBody({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const appLanguage = useLanguage()
  const { kinds, items } = model.translations
  const kind = meaningKind(kinds)
  // the colleagues' archives: separate variants next to Official, never in its place
  const colleagueTexts = useColleagueTexts(model.song?.number)
  const [chosen, setChosen] = useState<TranslationVariant | null>(null)
  const variant = pickVariant({ chosen, hasOfficial: kind !== null, texts: colleagueTexts, appLanguage })
  const lang = langOfVariant(variant)
  const colleague = lang ? colleagueTexts.find((text) => text.lang === lang) : undefined
  const chips = colleagueTexts.length ? <VariantChips t={t} texts={colleagueTexts} hasOfficial={kind !== null} value={variant} onChange={setChosen} /> : null
  if (colleague) {
    return (
      <View>
        {chips}
        <ColleagueVersions t={t} text={colleague} scale={ui.scale} />
      </View>
    )
  }
  if (!kind) return <QuietNote t={t}>{model.translationsLoading ? tr("songPage.translation.loading") : tr("songPage.lyrics.expand.none")}</QuietNote>
  const versions = versionsOf(items, kind)
  return (
    <View>
      {chips}
      {kind !== "official" ? (
        <View style={styles.switch}>
          <Eyebrow t={t}>{tr(KIND_LABEL[kind])}</Eyebrow>
        </View>
      ) : null}
      {versions.map((item, i) => (
        <Version key={item.id} t={t} tr={tr} item={item} scale={ui.scale} heading={i > 0 ? tr("songPage.translation.otherVersion") : null} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  switch: { paddingHorizontal: 20, paddingBottom: 16, alignItems: "flex-start" },
  version: { paddingHorizontal: 20, gap: 12, paddingBottom: 24 },
  text: { gap: 14 },
  body: { fontFamily: amFonts.regular },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  checked: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  checkedText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  credit: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  commentary: { borderRadius: 24, padding: 16, gap: 8 },
  commentaryText: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 25 },
})
