import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"

import { SpSheet } from "@/components/song-v2/SpSheet"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { planFor } from "@/lib/songPdf/html"
import { summaryOf, toggleCode } from "@/lib/songPdf/languages"
import { shareSongPdf } from "@/lib/songPdf/share"
import { PDF_VARIANTS, type PdfSongInput, type PdfVariantId } from "@/lib/songPdf/types"
import { lyricLanguageName } from "@/lib/songPage/lyricLanguages"
import { scriptName, usePageT, type PageT } from "@/lib/songPage/pageCopy"
import type { ScriptId } from "@/lib/songPage/scripts"
import { useSongPdfStore } from "@/stores/songPdfStore"

import { songTitle } from "./Hero"
import { LanguageList } from "./LanguageList"
import type { PageUi } from "./state"
import { Segmented, type SegItem } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const SCRIPTS: ScriptId[] = ["roman", "devanagari", "bengali"]

/** What the PDF needs, taken from the song page: the lines of each script, the word meanings, one text per translation language. */
export function pdfInputOf(model: SongPageModel): PdfSongInput | null {
  const song = model.song
  if (!song) return null
  const composed = model.about.find((row) => row.id === "composed")
  const translations: Record<string, string> = {}
  const rank = { official: 0, literal: 1, poetic: 2 } as Record<string, number>
  for (const item of [...model.translations.items].sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9) || a.position - b.position)) {
    if (item.text.trim() && !translations[item.language]) translations[item.language] = item.text.trim()
  }
  const meta = song as { raga?: string | null; tala?: string | null }
  return {
    number: song.number,
    title: songTitle(model),
    composed: composed && composed.id === "composed" ? `${composed.date.day} ${MONTHS[composed.date.month - 1] ?? ""} ${composed.date.year}`.replace("  ", " ") : null,
    raga: meta.raga ?? null,
    tala: meta.tala ?? null,
    romanLines: model.sources.roman,
    linesByScript: { roman: model.sources.roman, devanagari: model.sources.devanagari, bengali: model.sources.bengali },
    glosses: model.glosses,
    translations,
  }
}

/** The word languages that count now: the chosen ones the song has, or the one the page shows. */
export function effectiveWordLanguages(chosen: readonly string[], model: SongPageModel): string[] {
  const have = chosen.filter((c) => model.wordLanguages.includes(c))
  return have.length ? have : model.wordLanguages.length ? [model.wordLanguage] : []
}

/** Toggles a word language: the PDF stacks all of them, the page shows the first one. */
export function useWordLanguageToggle(model: SongPageModel) {
  const chosen = useSongPdfStore((s) => s.wordLanguages)
  return (code: string) => {
    // the base of a change is what is on screen, so a first tap changes what the person sees
    const next = toggleCode(effectiveWordLanguages(chosen, model), code)
    useSongPdfStore.setState({ wordLanguages: next })
    if (next[0]) model.setWordLanguage(next[0])
  }
}

function Miniature({ t, id, on }: { t: SpTheme; id: PdfVariantId; on: boolean }) {
  const portrait = id === "reader"
  const line = (w: string, k: number) => <View key={k} style={[styles.ln, { width: w as `${number}%`, backgroundColor: on ? t.ink900 : t.ink500 }]} />
  const col = (w: string, n: number, g = false) => (
    <View style={{ width: w as `${number}%`, gap: 3 }}>{Array.from({ length: n }, (_, k) => <View key={k} style={{ gap: 1.5 }}>{line("80%", 0)}{g ? <View style={[styles.ln, { width: "50%", height: 1.5, backgroundColor: t.orange500 }]} /> : null}</View>)}</View>
  )
  return (
    <View style={[styles.page, portrait ? styles.portrait : styles.landscape, { backgroundColor: t.white, borderColor: t.sand400 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.rule, { backgroundColor: t.sand400 }]} />
      <View style={[styles.cols, portrait && { flexDirection: "column" }]}>
        {id === "sheet" ? <>{col("58%", 4, true)}{col("34%", 4)}</> : null}
        {id === "study" ? <>{col("34%", 4)}{col("26%", 4, true)}{col("30%", 4)}</> : null}
        {id === "reader" ? <>{col("90%", 3)}{col("90%", 2)}</> : null}
        {id === "singing" ? col("90%", 3) : null}
      </View>
    </View>
  )
}

function LayoutCards({ t, tr }: { t: SpTheme; tr: PageT }) {
  const variant = useSongPdfStore((s) => s.variant)
  const setVariant = useSongPdfStore((s) => s.setVariant)
  return (
    <View style={styles.grid}>
      {PDF_VARIANTS.map((id) => {
        const on = id === variant
        return (
          <SpPress
            key={id}
            onPress={() => setVariant(id)}
            accessibilityRole="radio"
            accessibilityLabel={`${tr(`pdf.v.${id}`)}. ${tr(`pdf.v.${id}.d`)}`}
            accessibilityState={{ selected: on }}
            pressedScale={0.97}
            style={[styles.card, { borderColor: on ? (t.dark ? t.action : t.ink900) : t.sand400, borderWidth: on ? 2 : 1, backgroundColor: t.dark ? t.sand100 : t.white }]}
          >
            <Miniature t={t} id={id} on={on} />
            <Text style={[styles.cardName, { color: t.ink900 }]}>{tr(`pdf.v.${id}`)}</Text>
            <Text style={[styles.cardText, { color: t.ink500 }]} numberOfLines={2}>{tr(`pdf.v.${id}.d`)}</Text>
          </SpPress>
        )
      })}
    </View>
  )
}

function ChoiceRow({ t, tr, label, codes, onPress }: { t: SpTheme; tr: PageT; label: string; codes: readonly string[]; onPress: () => void }) {
  const { names, more } = summaryOf(codes)
  return (
    <SpPress onPress={onPress} accessibilityLabel={`${label}. ${names || tr("pdf.off")}`} pressedScale={0.985} style={[styles.choice, { borderTopColor: t.sand300 }]}>
      <Text style={[styles.label, { color: t.ink800 }]}>{label}</Text>
      <View style={styles.value}>
        <Text style={[styles.valueText, { color: t.ink900 }]} numberOfLines={1}>{names || tr("pdf.off")}</Text>
        {more ? <View style={[styles.more, { backgroundColor: t.sand300 }]}><Text style={[styles.moreText, { color: t.ink900 }]}>{tr("lang.more", { count: more })}</Text></View> : null}
        <Text style={[styles.chev, { color: t.ink500 }]}>›</Text>
      </View>
    </SpPress>
  )
}

type View_ = "main" | "words" | "translation"

/** THE PDF SHEET: pick a layout, the script and the languages, make the PDF on the phone and hand it to the share sheet. */
export function PdfSheet({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const open = ui.sheet === "pdf"
  const [view, setView] = useState<View_>("main")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const variant = useSongPdfStore((s) => s.variant)
  const wordChoice = useSongPdfStore((s) => s.wordLanguages)
  const translationLanguages = useSongPdfStore((s) => s.translationLanguages)
  const toggleTranslation = useSongPdfStore((s) => s.toggleTranslationLanguage)
  const toggleWord = useWordLanguageToggle(model)
  const input = useMemo(() => pdfInputOf(model), [model.song, model.sources, model.glosses, model.translations, model.about])
  const wordLanguages = effectiveWordLanguages(wordChoice, model)
  const [script, setScript] = useState<ScriptId>("roman")
  const close = () => {
    setView("main")
    setNote(null)
    ui.setSheet(null)
  }
  const options = { variant, script, wordLanguages, translationLanguages }
  const plan = input ? planFor(input, options) : null
  const scriptItems: Array<SegItem<ScriptId>> = SCRIPTS.filter((id) => id !== "bengali" || model.scripts.includes(id)).map((id) => ({ id, label: scriptName(tr, id), disabled: !model.scripts.includes(id) }))

  const make = async () => {
    if (!input || busy) return
    setBusy(true)
    setNote(null)
    try {
      const done = await shareSongPdf(input, options)
      const missing = [...done.plan.missing.translations, ...done.plan.missing.wordLanguages].map(lyricLanguageName)
      setNote(missing.length ? tr("pdf.missing", { names: [...new Set(missing)].join(", ") }) : tr("pdf.done"))
    } catch {
      setNote(tr("pdf.failed"))
    } finally {
      setBusy(false)
    }
  }

  const translationAvailable = Object.keys(input?.translations ?? {})
  return (
    <SpSheet t={t} visible={open} onClose={close} label={tr("pdf.title")} testID="pdf-sheet">
      <View style={styles.body}>
        {view === "main" ? (
          <>
            <Text style={[styles.title, { color: t.ink900 }]} accessibilityRole="header">{tr("pdf.title")}</Text>
            <Text style={[styles.label, { color: t.ink800, marginTop: 16, marginBottom: 8 }]}>{tr("pdf.layout")}</Text>
            <LayoutCards t={t} tr={tr} />
            <View style={styles.stack}>
              <Text style={[styles.label, { color: t.ink800 }]}>{tr("pdf.script")}</Text>
              <Segmented t={t} items={scriptItems} value={script} onChange={setScript} label={tr("pdf.script")} role="radio" fit />
            </View>
            {variant === "singing" ? null : (
              <>
                {variant === "sheet" || variant === "study" ? <ChoiceRow t={t} tr={tr} label={tr("pdf.words")} codes={wordLanguages} onPress={() => setView("words")} /> : null}
                <ChoiceRow t={t} tr={tr} label={tr("pdf.translation")} codes={translationLanguages.filter((c) => translationAvailable.includes(c))} onPress={() => setView("translation")} />
              </>
            )}
            {(variant === "sheet" || variant === "study") && model.wordLanguages.length === 0 ? <Text style={[styles.hint, { color: t.ink500 }]}>{tr("pdf.noWordsHint")}</Text> : null}
            {note ? <Text style={[styles.hint, { color: t.ink800 }]} accessibilityLiveRegion="polite">{note}</Text> : null}
            <SpPress onPress={make} disabled={busy || !input} accessibilityLabel={busy ? tr("pdf.making") : tr("pdf.make")} pressedScale={0.97} style={[styles.make, { backgroundColor: t.action }, busy && { opacity: 0.6 }]}>
              <Text style={[styles.makeText, { color: t.onAction }]}>{busy ? tr("pdf.making") : tr("pdf.make")}</Text>
            </SpPress>
          </>
        ) : (
          <>
            <View style={styles.head}>
              <SpPress onPress={() => setView("main")} accessibilityLabel={tr("lang.back")} pressedScale={0.94} style={[styles.back, { borderColor: t.sand400 }]}>
                <Text style={[styles.chev, { color: t.ink900, transform: [{ scaleX: -1 }] }]}>›</Text>
              </SpPress>
              <Text style={[styles.title, { color: t.ink900 }]} accessibilityRole="header">{view === "words" ? tr("lang.layer.words") : tr("lang.layer.translation")}</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {view === "words" ? (
                <LanguageList t={t} tr={tr} available={model.wordLanguages} chosen={wordLanguages} onToggle={toggleWord} />
              ) : (
                <LanguageList t={t} tr={tr} available={translationAvailable} chosen={translationLanguages.filter((c) => translationAvailable.includes(c))} onToggle={toggleTranslation} />
              )}
            </ScrollView>
            <SpPress onPress={() => setView("main")} accessibilityLabel={tr("lang.done")} pressedScale={0.97} style={[styles.make, { backgroundColor: t.action }]}>
              <Text style={[styles.makeText, { color: t.onAction }]}>{tr("lang.done")}</Text>
            </SpPress>
          </>
        )}
      </View>
    </SpSheet>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 28 },
  label: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47.5%", borderRadius: 16, padding: 10, gap: 4 },
  cardName: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20, marginTop: 4 },
  cardText: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  page: { borderWidth: 1, padding: 6, gap: 5, alignSelf: "center", width: "100%" },
  landscape: { height: 68 },
  portrait: { height: 68, width: 52 },
  rule: { height: 1 },
  cols: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  ln: { height: 3, opacity: 0.75 },
  stack: { paddingVertical: 12, gap: 8 },
  choice: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  value: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  valueText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  more: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  moreText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16 },
  chev: { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 24 },
  hint: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, paddingTop: 8 },
  make: { minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: 16 },
  makeText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
})

/** THE LANGUAGES SHEET: opened from the Aa popover; word meanings and translation as two layers of one list of languages. */
export function LanguagesSheet({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const open = ui.sheet === "languages"
  const [layer, setLayer] = useState<"words" | "translation">("words")
  const wordChoice = useSongPdfStore((s) => s.wordLanguages)
  const translationLanguages = useSongPdfStore((s) => s.translationLanguages)
  const toggleTranslation = useSongPdfStore((s) => s.toggleTranslationLanguage)
  const toggleWord = useWordLanguageToggle(model)
  const translationAvailable = useMemo(() => [...new Set(model.translations.items.filter((i) => i.text.trim()).map((i) => i.language))], [model.translations])
  const items: Array<SegItem<"words" | "translation">> = [
    { id: "words", label: tr("lang.layer.words") },
    { id: "translation", label: tr("lang.layer.translation") },
  ]
  return (
    <SpSheet t={t} visible={open} onClose={() => ui.setSheet(null)} label={tr("lang.title")} testID="languages-sheet">
      <View style={styles.body}>
        <Text style={[styles.title, { color: t.ink900 }]} accessibilityRole="header">{tr("lang.title")}</Text>
        <View style={{ marginTop: 12 }}>
          <Segmented t={t} items={items} value={layer} onChange={setLayer} label={tr("lang.title")} role="tab" fit />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          {layer === "words" ? (
            <LanguageList t={t} tr={tr} available={model.wordLanguages} chosen={effectiveWordLanguages(wordChoice, model)} onToggle={toggleWord} />
          ) : (
            <LanguageList t={t} tr={tr} available={translationAvailable} chosen={translationLanguages.filter((c) => translationAvailable.includes(c))} onToggle={toggleTranslation} />
          )}
        </ScrollView>
        <SpPress onPress={() => ui.setSheet(null)} accessibilityLabel={tr("lang.done")} pressedScale={0.97} style={[styles.make, { backgroundColor: t.action }]}>
          <Text style={[styles.makeText, { color: t.onAction }]}>{tr("lang.done")}</Text>
        </SpPress>
      </View>
    </SpSheet>
  )
}
