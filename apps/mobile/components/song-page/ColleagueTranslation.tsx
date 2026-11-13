import { StyleSheet, Text, View } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpSheet } from "@/components/song-v2/SpSheet"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useColleagueT, type ColleagueT } from "@/lib/psColleagues/copy"
import { useColleagueTexts } from "@/hooks/useColleagueData"
import { useLanguage } from "@/lib/i18n"
import { COLLEAGUE_LANG_NAME, pickVariant, variantOf, type ColleagueText, type TranslationVariant } from "@/lib/psColleagues/translations"
import { meaningKind } from "@/lib/songPage/songTabs"
import { paragraphsOf } from "@/lib/songTranslations/derive"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"

import { OptionRow, OptionTick } from "./OptionRow"
import type { PageUi } from "./state"
import { Eyebrow } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

type VariantItem = { id: TranslationVariant; label: string; source: string | null }

/**
 * The texts the Meaning tab can read and the one it reads now: the reader's own choice while it is still offered, else
 * the page's pick (Official first). Shared by the button on the page and the list in its sheet.
 */
export function useVariants(model: SongPageModel, ui: PageUi) {
  const tr = usePageT()
  const tc = useColleagueT()
  const appLanguage = useLanguage()
  const texts = useColleagueTexts(model.song?.number)
  const hasOfficial = meaningKind(model.translations.kinds) !== null
  const value = pickVariant({ chosen: ui.variant, hasOfficial, texts, appLanguage })
  const items: VariantItem[] = [
    ...(hasOfficial ? [{ id: "official" as const, label: tr("songPage.translation.official"), source: null }] : []),
    ...texts.map((text) => ({ id: variantOf(text.lang), label: text.lang === "en" ? tc("colleagues.chip.en") : COLLEAGUE_LANG_NAME[text.lang], source: tc("colleagues.source") })),
  ]
  return { texts, hasOfficial, value, items, title: tc("colleagues.variants.a11y") }
}

/**
 * Which translation the Meaning tab reads, when the colleagues' archives hold translations of the song besides the
 * Official one: ONE small round button on a single line that names the text now on the page ("Official", "English ·
 * colleagues", "Русский", "Українська", "Français") with a small arrow. A tap opens the list in a bottom sheet of the
 * page (VariantSheet). Nothing replaces the Official text; a variant is separate. Drawn only when there are two texts or more.
 */
export function VariantPicker({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const { items, value, title } = useVariants(model, ui)
  if (items.length < 2) return null
  const current = items.find((item) => item.id === value) ?? items[0]
  return (
    <View style={styles.bar}>
      <SpPress
        onPress={() => ui.setSheet("translationVariant")}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current?.label ?? ""}${current?.source ? `, ${current.source}` : ""}`}
        pressedScale={0.96}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={[styles.pill, { backgroundColor: t.white, borderColor: t.sand400 }]}
      >
        <Text style={[styles.pillText, { color: t.ink900 }]} numberOfLines={1}>
          {current?.label}
        </Text>
        <SpIcon name="chevDown" size={16} color={t.ink500} strokeWidth={2.2} />
      </SpPress>
    </View>
  )
}

/** The list behind the button: every text on its own row with its source under it ("From colleagues' collection" for the colleagues' texts), the chosen one ticked. */
export function VariantSheet({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const { items, value, title } = useVariants(model, ui)
  return (
    <SpSheet t={t} visible={ui.sheet === "translationVariant"} onClose={() => ui.setSheet(null)} label={title} testID="translation-variant-sheet">
      <View style={styles.sheet}>
        <Text style={[styles.sheetTitle, { color: t.ink900 }]} accessibilityRole="header">
          {title}
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={title}>
          {items.map((item) => (
            <OptionRow
              key={item.id}
              t={t}
              label={item.label}
              hint={item.source}
              role="radio"
              selected={item.id === value}
              a11y={item.source ? `${item.label}, ${item.source}` : item.label}
              onPress={() => {
                ui.setVariant(item.id)
                ui.setSheet(null)
              }}
            >
              <OptionTick t={t} on={item.id === value} />
            </OptionRow>
          ))}
        </View>
      </View>
    </SpSheet>
  )
}

function Version({ t, tc, tr, text, version, scale, other }: { t: SpTheme; tc: ColleagueT; tr: PageT; text: ColleagueText; version: ColleagueText["versions"][number]; scale: number; other: boolean }) {
  const size = Math.round(17 * scale)
  const credit = [tc("colleagues.source"), version.note].filter(Boolean).join(" · ")
  return (
    <View style={styles.version}>
      {other ? <Eyebrow t={t}>{tr("songPage.translation.otherVersion")}</Eyebrow> : null}
      {version.title ? <Eyebrow t={t}>{version.title}</Eyebrow> : null}
      <View style={styles.text}>
        {paragraphsOf(version.text).map((paragraph, i) => (
          <Text key={i} style={[styles.body, { color: t.ink900, fontSize: size, lineHeight: Math.round(size * 1.6) }]}>
            {paragraph}
          </Text>
        ))}
      </View>
      <Text style={[styles.credit, { color: t.ink500 }]} accessibilityLabel={`${credit}, ${COLLEAGUE_LANG_NAME[text.lang]}`}>
        {credit}
      </Text>
    </View>
  )
}

/** The text of one colleague translation (and its second versions), each with its source line under it. */
export function ColleagueVersions({ t, text, scale }: { t: SpTheme; text: ColleagueText; scale: number }) {
  const tr = usePageT()
  const tc = useColleagueT()
  return (
    <View>
      {text.versions.map((version, i) => (
        <Version key={i} t={t} tc={tc} tr={tr} text={text} version={version} scale={scale} other={i > 0} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center" },
  pill: { height: 36, flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 14, paddingRight: 10, borderRadius: 9999, borderWidth: 1, maxWidth: "100%" },
  pillText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18, flexShrink: 1 },
  sheet: { paddingHorizontal: 20, paddingBottom: 24 },
  sheetTitle: { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 28, paddingBottom: 8 },
  version: { paddingHorizontal: 20, gap: 12, paddingBottom: 24 },
  text: { gap: 14 },
  body: { fontFamily: amFonts.regular },
  credit: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
