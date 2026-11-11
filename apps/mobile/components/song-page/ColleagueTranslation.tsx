import { ScrollView, StyleSheet, Text, View } from "react-native"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useColleagueT, type ColleagueT } from "@/lib/psColleagues/copy"
import { COLLEAGUE_LANG_NAME, variantOf, type ColleagueText, type TranslationVariant } from "@/lib/psColleagues/translations"
import { paragraphsOf } from "@/lib/songTranslations/derive"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"

import { Eyebrow } from "./ui"

/**
 * The chips of the Translation page when the colleagues' archives hold translations of the song: "Official" (the
 * translation the page always had) and one chip per colleague text (English, Русский, Українська, Français). A chip
 * is a separate variant; nothing replaces the Official text. Drawn only when there is at least one colleague text.
 */
export function VariantChips({
  t,
  texts,
  hasOfficial,
  value,
  onChange,
}: {
  t: SpTheme
  texts: readonly ColleagueText[]
  hasOfficial: boolean
  value: TranslationVariant
  onChange: (variant: TranslationVariant) => void
}) {
  const tr = usePageT()
  const tc = useColleagueT()
  const items: Array<{ id: TranslationVariant; label: string }> = [
    ...(hasOfficial ? [{ id: "official" as const, label: tr("songPage.translation.official") }] : []),
    ...texts.map((text) => ({ id: variantOf(text.lang), label: text.lang === "en" ? tc("colleagues.chip.en") : COLLEAGUE_LANG_NAME[text.lang] })),
  ]
  if (items.length < 2) return null
  const on = t.dark ? t.action : t.ink900
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.chips} accessibilityRole="tablist" accessibilityLabel={tc("colleagues.variants.a11y")}>
      {items.map((item) => {
        const selected = item.id === value
        return (
          <SpPress
            key={item.id}
            onPress={() => onChange(item.id)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            pressedScale={0.96}
            style={[styles.chip, { backgroundColor: selected ? on : t.white, borderColor: selected ? on : t.sand400 }]}
          >
            <Text style={[styles.chipText, { color: selected ? (t.dark ? t.onAction : t.onInk) : t.ink900 }]} numberOfLines={1}>
              {item.label}
            </Text>
          </SpPress>
        )
      })}
    </ScrollView>
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
  scroll: { flexGrow: 0, marginBottom: 16 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: { minHeight: 40, borderRadius: 9999, borderWidth: 1, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
  version: { paddingHorizontal: 20, gap: 12, paddingBottom: 24 },
  text: { gap: 14 },
  body: { fontFamily: amFonts.regular },
  credit: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
