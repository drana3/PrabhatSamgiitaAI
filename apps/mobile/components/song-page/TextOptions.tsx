import { useCallback, useEffect, useRef, useState } from "react"
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useCoverWhile } from "@/lib/sheetCover"
import { activeLineKind, lineKinds, type LineKind } from "@/lib/songTranslations/derive"
import { scriptName, usePageT, type PageT } from "@/lib/songPage/pageCopy"
import type { ScriptId } from "@/lib/songPage/scripts"

import { summaryOf } from "@/lib/songPdf/languages"
import { useSongPdfStore } from "@/stores/songPdfStore"

import { effectiveWordLanguages } from "./PdfSheet"
import { PronunciationRow } from "./Pronunciation"
import type { PageUi, TextScaleIndex } from "./state"
import { Segmented, type SegItem } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/**
 * THE TEXT OPTIONS (board 2, variant 1). One small "Aa" button in the header row of the text block and, under
 * it, a compact popover: text size, script, and the translation under each lyric line (Off, Literal or Poetic, only
 * the kinds the song has; Off is the default). It takes no room in the page. Like a sheet it registers with lib/sheetCover.ts (the mini-player slides away while it is
 * open), the Android back button and Escape close it, and a tap outside closes it.
 */

const REDUCED_MS = 150
const POPOVER_WIDTH = 318
const SCRIPT_ORDER: ScriptId[] = ["roman", "devanagari", "bengali"]

/** The round "Aa" button. It measures itself on press so the popover opens right under it. */
export function TextOptionsButton({ t, ui, wordLanguage = false }: { t: SpTheme; ui: PageUi; wordLanguage?: boolean }) {
  const tr = usePageT()
  const ref = useRef<View | null>(null)
  const open = ui.options !== null
  const press = () => {
    if (open) return ui.closeOptions()
    const node = ref.current
    if (!node) return ui.openOptions(120, wordLanguage)
    node.measureInWindow((_x, y, _w, h) => ui.openOptions(Math.round(y + h), wordLanguage))
  }
  return (
    <View ref={ref} collapsable={false}>
      <SpPress
        onPress={press}
        accessibilityLabel={tr("songPage.options.button")}
        accessibilityState={{ selected: open }}
        pressedScale={0.92}
        style={[styles.aa, { backgroundColor: open ? (t.dark ? t.action : t.ink900) : t.white, borderColor: open ? (t.dark ? t.action : t.ink900) : t.sand400 }]}
      >
        <Text style={[styles.aaText, { color: open ? (t.dark ? t.onAction : t.onInk) : t.ink900 }]}>
          A<Text style={styles.aaSmall}>a</Text>
        </Text>
      </SpPress>
    </View>
  )
}

function SizeRow({ t, tr, ui }: { t: SpTheme; tr: PageT; ui: PageUi }) {
  const index = ui.scaleIndex
  const step = (delta: -1 | 1) => ui.setScaleIndex(Math.max(0, Math.min(2, index + delta)) as TextScaleIndex)
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: t.ink800 }]}>{tr("songPage.options.size")}</Text>
      <View style={styles.step}>
        <SpPress onPress={() => step(-1)} disabled={index === 0} accessibilityLabel={tr("songPage.options.size.smaller")} pressedScale={0.94} style={[styles.stepBtn, { backgroundColor: t.white, borderColor: t.sand400 }, index === 0 && styles.dim]}>
          <Text style={[styles.stepText, { color: t.ink900, fontSize: 14 }]}>A</Text>
        </SpPress>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i <= index ? t.action : t.sand400 }]} />
          ))}
        </View>
        <SpPress onPress={() => step(1)} disabled={index === 2} accessibilityLabel={tr("songPage.options.size.bigger")} pressedScale={0.94} style={[styles.stepBtn, { backgroundColor: t.white, borderColor: t.sand400 }, index === 2 && styles.dim]}>
          <Text style={[styles.stepText, { color: t.ink900, fontSize: 21 }]}>A</Text>
        </SpPress>
      </View>
    </View>
  )
}

function ScriptRow({ t, tr, model }: { t: SpTheme; tr: PageT; model: SongPageModel }) {
  // Roman and Devanagari are always offered (a missing one is greyed); Bengali only when the song has it
  const ids = SCRIPT_ORDER.filter((id) => id !== "bengali" || model.scripts.includes(id))
  const items: Array<SegItem<ScriptId>> = ids.map((id) => ({
    id,
    label: scriptName(tr, id),
    a11y: model.scripts.includes(id) ? scriptName(tr, id) : `${scriptName(tr, id)}. ${tr("songPage.script.missing")}`,
    disabled: !model.scripts.includes(id),
  }))
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: t.ink800 }]}>{tr("songPage.options.script")}</Text>
      <Segmented t={t} items={items} value={model.lines.primaryScript} onChange={(id) => model.setScript(id)} label={tr("songPage.options.script")} role="radio" fit />
    </View>
  )
}

function LineTranslationRow({ t, tr, model, ui }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi }) {
  // Off is always there; Literal and Poetic only when this song has them (Official is a whole text, not a line setting)
  const kinds = lineKinds(model.translations.kinds)
  const value = activeLineKind(ui.lineTranslation, model.translations.kinds) ?? "off"
  const label: Record<LineKind, "songPage.translation.literal" | "songPage.translation.poetic"> = { literal: "songPage.translation.literal", poetic: "songPage.translation.poetic" }
  const items: Array<SegItem<"off" | LineKind>> = [{ id: "off", label: tr("songPage.options.translation.off") }, ...kinds.map((id) => ({ id, label: tr(label[id]) }))]
  return (
    <View style={styles.stack}>
      <View style={styles.labelCol}>
        <Text style={[styles.label, { color: t.ink800 }]}>{tr("songPage.options.translation")}</Text>
        {kinds.length ? null : <Text style={[styles.hint, { color: t.ink500 }]}>{tr("songPage.options.translation.none")}</Text>}
      </View>
      {kinds.length ? <Segmented t={t} items={items} value={value} onChange={ui.setLineTranslation} label={tr("songPage.options.translation")} role="radio" fit /> : null}
    </View>
  )
}

/**
 * The languages of the word by word meanings, as ONE row: the names chosen and a "+N" when there are more, then an arrow.
 * The list itself (many can be on, a search, the languages the song does not have yet) opens in its own sheet, so a long
 * list of languages takes no room here. Shown when the song has word meanings or the page asked for it.
 */
function WordLanguageRow({ t, tr, model, ui }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi }) {
  const chosen = useSongPdfStore((s) => s.wordLanguages)
  if (model.wordLanguages.length === 0) return null
  const { names, more } = summaryOf(effectiveWordLanguages(chosen, model))
  const open = () => {
    ui.closeOptions()
    ui.setSheet("languages")
  }
  return (
    <>
      <SpPress onPress={open} accessibilityLabel={`${tr("songWords.language.title")}. ${names}`} pressedScale={0.985} style={styles.row}>
        <Text style={[styles.label, { color: t.ink800 }]}>{tr("songWords.language.title")}</Text>
        <View style={styles.value}>
          <Text style={[styles.valueText, { color: t.ink900 }]} numberOfLines={1}>{names}</Text>
          {more ? <Text style={[styles.valueMore, { color: t.ink500 }]}>{tr("lang.more", { count: more })}</Text> : null}
          <Text style={[styles.chev, { color: t.ink500 }]}>›</Text>
        </View>
      </SpPress>
      <View style={[styles.rule, { backgroundColor: t.sand300 }]} />
    </>
  )
}

/** The way into the PDF sheet, the last row of the popover. */
function PdfRow({ t, tr, ui }: { t: SpTheme; tr: PageT; ui: PageUi }) {
  const open = () => {
    ui.closeOptions()
    ui.setSheet("pdf")
  }
  return (
    <>
      <View style={[styles.rule, { backgroundColor: t.sand300 }]} />
      <SpPress onPress={open} accessibilityLabel={tr("pdf.button")} pressedScale={0.985} style={styles.row}>
        <Text style={[styles.label, { color: t.ink800 }]}>{tr("pdf.button")}</Text>
        <Text style={[styles.chev, { color: t.ink500 }]}>›</Text>
      </SpPress>
    </>
  )
}

function Card({ t, tr, model, ui, withWordLanguage }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi; withWordLanguage: boolean }) {
  return (
    <>
      <SizeRow t={t} tr={tr} ui={ui} />
      <View style={[styles.rule, { backgroundColor: t.sand300 }]} />
      <ScriptRow t={t} tr={tr} model={model} />
      <View style={[styles.rule, { backgroundColor: t.sand300 }]} />
      <LineTranslationRow t={t} tr={tr} model={model} ui={ui} />
      <View style={[styles.rule, { backgroundColor: t.sand300 }]} />
      {withWordLanguage ? <WordLanguageRow t={t} tr={tr} model={model} ui={ui} /> : null}
      <PronunciationRow t={t} ui={ui} onOpen={ui.closeOptions} last />
      <PdfRow t={t} tr={tr} ui={ui} />
    </>
  )
}

/**
 * The popover, drawn in the page's sheet layer (above the scroll, under nothing). Enter and exit are one value
 * (a spring), so a tap that closes it halfway back turns around from where it is; only opacity and transform move.
 */
export function TextOptionsPopover({ t, model, ui }: { t: SpTheme; model: SongPageModel; ui: PageUi }) {
  const tr = usePageT()
  const { width, height } = useWindowDimensions()
  const reduce = useReducedMotion()
  const open = ui.options !== null
  const [mounted, setMounted] = useState(open)
  const progress = useSharedValue(0)
  const last = useRef<{ top: number; wordLanguage: boolean } | null>(ui.options)
  if (ui.options) last.current = ui.options
  const close = ui.closeOptions
  const closeRef = useRef(close)
  closeRef.current = close
  const unmount = useCallback(() => setMounted(false), [])

  useCoverWhile(mounted)

  useEffect(() => {
    if (open) {
      setMounted(true)
      progress.value = reduce ? withTiming(1, { duration: REDUCED_MS }) : withSpring(1, amSpring.default)
      return
    }
    const done = (finished?: boolean) => {
      "worklet"
      if (finished) runOnJS(unmount)()
    }
    progress.value = reduce ? withTiming(0, { duration: REDUCED_MS }, done) : withSpring(0, amSpring.default, done)
  }, [open, reduce, progress, unmount])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeRef.current()
      return true
    })
    let off: (() => void) | undefined
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") closeRef.current()
      }
      document.addEventListener("keydown", onKey)
      off = () => document.removeEventListener("keydown", onKey)
    }
    return () => {
      sub.remove()
      off?.()
    }
  }, [open])

  const style = useAnimatedStyle(() =>
    reduce
      ? { opacity: progress.value }
      : { opacity: Math.min(1, progress.value * 1.4), transform: [{ translateY: (1 - progress.value) * -8 }, { scale: 0.94 + 0.06 * progress.value }] },
  )

  if (!mounted) return null
  const top = (last.current?.top ?? 120) + 8
  const w = Math.min(POPOVER_WIDTH, width - 32)
  return (
    <View style={styles.root} pointerEvents="box-none" accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={tr("songPage.sheet.close")} onPress={close} />
      <Animated.View
        accessibilityLabel={tr("songPage.options.title")}
        style={[styles.pop, { top, width: w, maxHeight: Math.max(240, height - top - 24), backgroundColor: t.dark ? t.sand100 : t.white, borderColor: t.sand400 }, style]}
      >
        <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
          <Card t={t} tr={tr} model={model} ui={ui} withWordLanguage={last.current?.wordLanguage ?? false} />
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  aa: { width: 44, height: 44, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  aaText: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.4 },
  aaSmall: { fontSize: 13 },
  root: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  pop: { position: "absolute", right: 16, borderRadius: 28, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, overflow: "hidden", transformOrigin: "top right" },
  stack: { paddingVertical: 12, gap: 10 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rule: { height: StyleSheet.hairlineWidth },
  label: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  labelCol: { flex: 1, gap: 2 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  step: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: amFonts.bold },
  dim: { opacity: 0.4 },
  value: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  valueText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  valueMore: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  chev: { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 24 },
  dots: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
