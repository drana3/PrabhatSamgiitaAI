import { useCallback, useEffect, useRef, useState } from "react"
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useCoverWhile } from "@/lib/sheetCover"
import { activeLineKind, lineKinds, type LineKind } from "@/lib/songTranslations/derive"
import { estimateCardHeight, placePopover, type PopoverPlacement } from "@/lib/songPage/optionsPlacement"
import { scriptName, usePageT, type PageT } from "@/lib/songPage/pageCopy"
import type { ScriptId } from "@/lib/songPage/scripts"

import { summaryOf } from "@/lib/songPdf/languages"
import { useSongPdfStore } from "@/stores/songPdfStore"

import { effectiveWordLanguages } from "./PdfSheet"
import { OptionRow, OptionValue } from "./OptionRow"
import { PronunciationRow } from "./Pronunciation"
import type { PageUi, TextScaleIndex } from "./state"
import { Segmented, type SegItem } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/**
 * THE TEXT OPTIONS (board 2, variant 1). One small "Aa" button in the header row of the text block and, next to
 * it, a compact card of equal rows (OptionRow.tsx): text size, script, the translation under each lyric line (its value
 * and an arrow; the choice, Off, Literal or Poetic, opens in a sheet, only the kinds the song has; Off is the default),
 * the word language when the page asks, and how to pronounce. The card hangs under the button, or opens upwards when
 * there is no room below (lib/songPage/optionsPlacement.ts). It takes no room in the page. Like a sheet it registers with lib/sheetCover.ts (the mini-player slides away while it is
 * open), the Android back button and Escape close it, and a tap outside closes it.
 */

const REDUCED_MS = 150
/** The round "Aa" button is 44 high; the card keeps this far below the status bar when it opens upwards. */
const ANCHOR_HEIGHT = 44
const TOP_INSET = 64
const POPOVER_WIDTH = 344
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

/** Text size: one pill, the same height as the script switch: small A, three dots, large A. */
function SizeRow({ t, tr, ui }: { t: SpTheme; tr: PageT; ui: PageUi }) {
  const index = ui.scaleIndex
  const step = (delta: -1 | 1) => ui.setScaleIndex(Math.max(0, Math.min(2, index + delta)) as TextScaleIndex)
  return (
    <OptionRow t={t} label={tr("songPage.options.size")}>
      <View style={[styles.step, { backgroundColor: t.white, borderColor: t.sand400 }]}>
        <SpPress onPress={() => step(-1)} disabled={index === 0} accessibilityLabel={tr("songPage.options.size.smaller")} pressedScale={0.92} style={[styles.stepBtn, index === 0 && styles.dim]}>
          <Text style={[styles.stepText, { color: t.ink900, fontSize: 14 }]}>A</Text>
        </SpPress>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i <= index ? t.action : t.sand400 }]} />
          ))}
        </View>
        <SpPress onPress={() => step(1)} disabled={index === 2} accessibilityLabel={tr("songPage.options.size.bigger")} pressedScale={0.92} style={[styles.stepBtn, index === 2 && styles.dim]}>
          <Text style={[styles.stepText, { color: t.ink900, fontSize: 21 }]}>A</Text>
        </SpPress>
      </View>
    </OptionRow>
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
    <OptionRow t={t} label={tr("songPage.options.script")}>
      <Segmented t={t} items={items} value={model.lines.primaryScript} onChange={(id) => model.setScript(id)} label={tr("songPage.options.script")} role="radio" />
    </OptionRow>
  )
}

/** The names of the choices of the translation under each line, for the row's value and for its sheet. */
export function lineChoiceLabel(tr: PageT, id: "off" | LineKind): string {
  return id === "off" ? tr("songPage.options.translation.off") : tr(id === "literal" ? "songPage.translation.literal" : "songPage.translation.poetic")
}

/**
 * The translation under each lyric line, in the same grid as the rows around it: the name, then the chosen value and an
 * arrow. The three choices (Off, and Literal or Poetic when the song has them; Official is a whole text, not a line
 * setting) open in a sheet. A song with neither says so in one small line under the name and the value stays Off.
 */
function LineTranslationRow({ t, tr, model, ui }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi }) {
  const kinds = lineKinds(model.translations.kinds)
  const value = activeLineKind(ui.lineTranslation, model.translations.kinds) ?? "off"
  if (!kinds.length) {
    return (
      <OptionRow t={t} label={tr("songPage.options.translation")} hint={tr("songPage.options.translation.none")}>
        <OptionValue t={t} text={lineChoiceLabel(tr, "off")} muted arrow={false} />
      </OptionRow>
    )
  }
  const open = () => {
    ui.closeOptions()
    ui.setSheet("lineTranslation")
  }
  return (
    <OptionRow t={t} label={tr("songPage.options.translation")} a11y={`${tr("songPage.options.translation")}. ${lineChoiceLabel(tr, value)}`} onPress={open}>
      <OptionValue t={t} text={lineChoiceLabel(tr, value)} />
    </OptionRow>
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
    <OptionRow t={t} label={tr("songWords.language.title")} a11y={`${tr("songWords.language.title")}. ${names}`} onPress={open}>
      <OptionValue t={t} text={names} more={more ? tr("lang.more", { count: more }) : null} />
    </OptionRow>
  )
}

function Card({ t, tr, model, ui, withWordLanguage }: { t: SpTheme; tr: PageT; model: SongPageModel; ui: PageUi; withWordLanguage: boolean }) {
  return (
    <>
      <SizeRow t={t} tr={tr} ui={ui} />
      <ScriptRow t={t} tr={tr} model={model} />
      <LineTranslationRow t={t} tr={tr} model={model} ui={ui} />
      {withWordLanguage ? <WordLanguageRow t={t} tr={tr} model={model} ui={ui} /> : null}
      <PronunciationRow t={t} ui={ui} onOpen={ui.closeOptions} />
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

  // the card opens away from the button: down when it fits below, up when the button is low on the screen
  const wordLanguage = last.current?.wordLanguage ?? false
  const noKinds = lineKinds(model.translations.kinds).length === 0
  const rows = 4 + (wordLanguage ? 1 : 0)
  const place: PopoverPlacement = placePopover({
    anchorBottom: last.current?.top ?? 120,
    anchorHeight: ANCHOR_HEIGHT,
    windowHeight: height,
    cardHeight: estimateCardHeight(rows, noKinds ? 1 : 0),
    topInset: TOP_INSET,
  })
  const rise = place.placement === "above" ? 1 : -1
  const style = useAnimatedStyle(() =>
    reduce
      ? { opacity: progress.value }
      : { opacity: Math.min(1, progress.value * 1.4), transform: [{ translateY: (1 - progress.value) * 8 * rise }, { scale: 0.94 + 0.06 * progress.value }] },
  )

  if (!mounted) return null
  const w = Math.min(POPOVER_WIDTH, width - 32)
  return (
    <View style={styles.root} pointerEvents="box-none" accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={tr("songPage.sheet.close")} onPress={close} />
      <Animated.View
        accessibilityLabel={tr("songPage.options.title")}
        style={[
          styles.pop,
          place.top !== null ? { top: place.top } : { bottom: place.bottom ?? 0 },
          { width: w, maxHeight: place.maxHeight, transformOrigin: place.placement === "above" ? "bottom right" : "top right", backgroundColor: t.dark ? t.sand100 : t.white, borderColor: t.sand400 },
          style,
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
          <Card t={t} tr={tr} model={model} ui={ui} withWordLanguage={wordLanguage} />
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
  pop: { position: "absolute", right: 16, borderRadius: 28, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 8, overflow: "hidden" },
  step: { flexDirection: "row", alignItems: "center", padding: 2, borderRadius: 9999, borderWidth: 1 },
  stepBtn: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: amFonts.bold },
  dim: { opacity: 0.4 },
  dots: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
