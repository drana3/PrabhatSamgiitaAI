import { StyleSheet, Text, View } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { pickKind, versionsOf } from "@/lib/songTranslations/derive"
import type { SongTranslation, TranslationKind } from "@/lib/songTranslations/types"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"

import type { PageUi } from "./state"
import { Eyebrow, QuietNote, Segmented, type SegItem } from "./ui"
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
 * THE TRANSLATION PAGE. The full translation of the song in one kind at a time, Official, Poetic or Literal, only the
 * kinds this song has. The reader's last choice is remembered on the device (and used again when the song has it).
 * Under the text come the explanation of and comments on the translation, drawn only when there are some. A second
 * official version (91 songs have one) is the "Other version" under the first. Everything comes from the translations
 * the server serves; nothing is made up here (see lib/songTranslations).
 */
export function TranslationBody({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const { kinds, items } = model.translations
  const kind = pickKind(ui.translationKind, kinds)
  if (!kind) return <QuietNote t={t}>{model.translationsLoading ? tr("songPage.translation.loading") : tr("songPage.lyrics.expand.none")}</QuietNote>
  const versions = versionsOf(items, kind)
  const segments: Array<SegItem<TranslationKind>> = kinds.map((id) => ({ id, label: tr(KIND_LABEL[id]) }))
  return (
    <View>
      <View style={styles.switch}>
        {kinds.length > 1 ? (
          <Segmented t={t} items={segments} value={kind} onChange={ui.setTranslationKind} label={tr("songPage.translation.kind")} role="radio" fit />
        ) : (
          <Eyebrow t={t}>{tr(KIND_LABEL[kind])}</Eyebrow>
        )}
      </View>
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
