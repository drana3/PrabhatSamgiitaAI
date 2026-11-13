import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type LayoutChangeEvent } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

import { KPress } from "@/components/kirtan/KPress"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKeyboardLift } from "@/hooks/useKeyboardLift"
import { useSheetBackHandler } from "@/hooks/useSheetBackHandler"
import { useT } from "@/lib/i18n"
import { rubberBandClamp, settleSnap } from "@/lib/playerV2/gesture"
import { QUALITIES, QUALITY_KIND, ROOTS, buildChord, cleanChordName, isChordName, suggestedChords, type Quality } from "@/lib/songChords/chordName"

import { PILL } from "./parts"

/**
 * The chord sheet: docked to the bottom of the "offer chords" screen while a word is selected. It is not a modal, the
 * lyric sheet above stays usable (tap another word and the sheet follows) and the screen scrolls so the selected word
 * stays in sight above it (app/upload-chords.tsx, lib/songChords/reveal.ts).
 *
 * Content, top to bottom: the word, the chord on it now, the chords already used in this chart, the usual chords of
 * the key (a grid), "More chords" (a two-step picker: the root note, then the kind), "No chord", and "Type a chord"
 * as the last resort. Done is always in the header, and so is the grab area.
 *
 * Motion (apple-design): one spring-driven value moves the sheet, only transform and opacity. The header drags it 1:1
 * from where it was grabbed, past the open position it resists like rubber, and on release it lands where the finger's
 * momentum projects to (open, or away, which closes it). Any change of height (another page) springs from the live
 * position, so a gesture can interrupt it at any moment. The keyboard lifts it frame for frame (iOS).
 */
export type ChordSheetProps = {
  theme: SongsTheme
  open: boolean
  word: string
  current: string | null
  keyName: string
  used: string[]
  onPick: (chord: string) => void
  onClear: () => void
  onPrevious: (() => void) | null
  onNext: (() => void) | null
  /** Done, a drag down, tap outside or Back */
  onClose: () => void
  /** how much of the bottom of the screen the sheet covers now (0 when it is away); the screen scrolls to keep the word clear of it */
  onHeight?: (covered: number) => void
  /** a screen that has no words (the chord cycle ring) names the place in its own words: the small heading and the title, shown as given */
  place?: { over: string; title: string }
}

type Page = "main" | "more" | "type"

const MAX_WIDTH = 560
const RUBBER_LIMIT = 48
const FLING_SPEED = 800
const AWAY = 48
const GUTTER = 16
const GAP = 8

export function ChordSheet({ theme, open, word, current, keyName, used, onPick, onClear, onPrevious, onNext, onClose, onHeight, place }: ChordSheetProps) {
  const t = useT()
  const reduce = useReducedMotion()
  const insets = useSafeAreaInsets()
  const { width: windowW, height: windowH } = useWindowDimensions()
  const lift = useKeyboardLift()

  const sheetW = Math.min(windowW, MAX_WIDTH)
  const maxH = Math.min(Math.round(windowH * 0.7), 560)
  const bottomPad = Math.max(insets.bottom, 16) + 8

  const [mounted, setMounted] = useState(open)
  const [contentH, setContentH] = useState(0)
  const [headH, setHeadH] = useState(96)
  const [page, setPage] = useState<Page>("main")

  const y = useSharedValue(maxH + AWAY)
  const startY = useSharedValue(0)
  const openY = useSharedValue(0)
  const hiddenY = useSharedValue(maxH + AWAY)
  const pageIn = useSharedValue(1)
  const dir = useSharedValue(1)

  const visibleH = Math.min(contentH, maxH)
  const ready = open && contentH > 0

  useSheetBackHandler(open, onClose)

  // Escape closes it on the web (where there is no Back button).
  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof document === "undefined") return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const unmount = useCallback(() => {
    setMounted(false)
    setContentH(0)
  }, [])

  const animateTo = useCallback(
    (target: number, velocity = 0, after?: () => void) => {
      if (reduce) {
        y.value = withTiming(target, { duration: 150 }, (done) => {
          if (done && after) runOnJS(after)()
        })
        return
      }
      const config = Math.abs(velocity) > FLING_SPEED ? amSpring.fling : amSpring.default
      y.value = withSpring(target, { ...config, velocity }, (done) => {
        if (done && after) runOnJS(after)()
      })
    },
    [reduce, y],
  )

  // the resting positions follow the measured height
  useEffect(() => {
    openY.value = maxH - visibleH
    hiddenY.value = maxH + AWAY
  }, [visibleH, maxH, openY, hiddenY])

  // opening: mount it, then slide in once its height is known
  useEffect(() => {
    if (open) {
      if (!mounted) {
        y.value = maxH + AWAY
        setMounted(true)
      }
      setPage("main")
    } else if (mounted) {
      animateTo(maxH + AWAY, 0, unmount)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // another word keeps the sheet where it is, on the main page
  useEffect(() => {
    setPage("main")
  }, [word])

  // sliding in, and every change of height afterwards (a longer page), springs from where the sheet is now
  useEffect(() => {
    if (ready) animateTo(maxH - visibleH)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, visibleH, maxH])

  useEffect(() => {
    onHeight?.(ready ? visibleH : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, visibleH])

  useEffect(
    () => () => {
      onHeight?.(0)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const go = useCallback(
    (next: Page) => {
      dir.value = next === "main" ? -1 : 1
      pageIn.value = reduce ? 1 : 0
      setPage(next)
      if (!reduce) pageIn.value = withSpring(1, amSpring.default)
    },
    [dir, pageIn, reduce],
  )

  const drag = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(y)
      startY.value = y.value
    })
    .onUpdate((event) => {
      y.value = rubberBandClamp(startY.value + event.translationY, openY.value, hiddenY.value, RUBBER_LIMIT)
    })
    .onEnd((event) => {
      const target = settleSnap(y.value, event.velocityY, [openY.value, hiddenY.value])
      const config = Math.abs(event.velocityY) > FLING_SPEED ? amSpring.fling : amSpring.default
      y.value = withSpring(target, { ...config, velocity: event.velocityY }, (done) => {
        if (done && target === hiddenY.value) runOnJS(onClose)()
      })
    })

  const sheetStyle = useAnimatedStyle(() => {
    const span = Math.max(1, hiddenY.value - openY.value)
    const shown = 1 - Math.min(1, Math.max(0, (y.value - openY.value) / span))
    return reduce
      ? { opacity: shown, transform: [{ translateY: openY.value - lift.value }] }
      : { opacity: 1, transform: [{ translateY: y.value - lift.value }] }
  })
  const pageStyle = useAnimatedStyle(() => ({ opacity: pageIn.value, transform: [{ translateX: (1 - pageIn.value) * dir.value * 24 }] }))

  const onContentLayout = (event: LayoutChangeEvent) => setContentH(Math.ceil(event.nativeEvent.layout.height))
  const onHeadLayout = (event: LayoutChangeEvent) => setHeadH(Math.ceil(event.nativeEvent.layout.height))
  const bodyMax = Math.max(160, maxH - headH - bottomPad)

  if (!mounted) return null

  return (
    <View pointerEvents="box-none" style={s.layer}>
      <Animated.View
        accessibilityViewIsModal={false}
        accessibilityLabel={t("chordOffer.sheet.a11y", { word })}
        style={[s.sheet, { width: sheetW, height: maxH, backgroundColor: theme.card, borderColor: theme.line }, sheetStyle]}
      >
        <View onLayout={onContentLayout} style={s.content}>
          <View onLayout={onHeadLayout}>
            <GestureDetector gesture={drag}>
              <View style={s.grab} collapsable={false}>
                <View style={[s.handle, { backgroundColor: theme.dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.18)" }]} />
                <View style={s.head}>
                  <View style={s.titles}>
                    <Text style={[s.over, { color: theme.accent }]} numberOfLines={1}>
                      {place ? place.over : t("chordOffer.sheet.over")}
                    </Text>
                    <Text style={[s.word, { color: theme.textHeading }]} numberOfLines={1} accessibilityRole="header" accessibilityLiveRegion="polite">
                      {place ? place.title : t("chordOffer.sheet.title", { word })}
                    </Text>
                    <Text style={[s.now, { color: current ? theme.textHeading : theme.textBody }]} numberOfLines={1} accessibilityLiveRegion="polite">
                      {current ? t("chordOffer.sheet.now", { chord: current }) : t("chordOffer.sheet.empty")}
                    </Text>
                  </View>
                  <View style={s.headActions}>
                    <Step theme={theme} dir="prev" label={t("chordOffer.sheet.previous")} onPress={onPrevious} />
                    <Step theme={theme} dir="next" label={t("chordOffer.sheet.next")} onPress={onNext} />
                    <KPress
                      accessibilityRole="button"
                      accessibilityLabel={t("chordOffer.sheet.done")}
                      onPress={onClose}
                      pressedScale={0.96}
                      style={[s.done, { backgroundColor: theme.ink900 }]}
                    >
                      <Text style={[s.doneText, { color: theme.onInk }]}>{t("chordOffer.sheet.done")}</Text>
                    </KPress>
                  </View>
                </View>
              </View>
            </GestureDetector>
          </View>

          <Animated.View style={pageStyle}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={[s.body, { maxHeight: bodyMax }]}
              contentContainerStyle={[s.bodyContent, { paddingBottom: bottomPad }]}
            >
              {page === "main" ? (
                <MainPage theme={theme} width={sheetW - GUTTER * 2} current={current} keyName={keyName} used={used} onPick={onPick} onClear={onClear} onMore={() => go("more")} onType={() => go("type")} />
              ) : page === "more" ? (
                <MorePage
                  theme={theme}
                  width={sheetW - GUTTER * 2}
                  current={current}
                  onBack={() => go("main")}
                  onPick={(chord) => {
                    onPick(chord)
                    go("main")
                  }}
                />
              ) : (
                <TypePage
                  theme={theme}
                  onBack={() => go("main")}
                  onPick={(chord) => {
                    onPick(chord)
                    go("main")
                  }}
                />
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  )
}

function Chevron({ color, dir }: { color: string; dir: "prev" | "next" | "back" }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d={dir === "next" ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function Step({ theme, dir, label, onPress }: { theme: SongsTheme; dir: "prev" | "next"; label: string; onPress: (() => void) | null }) {
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress }}
      onPress={onPress ?? undefined}
      pressedScale={0.92}
      style={[s.step, { borderColor: theme.line, opacity: onPress ? 1 : 0.35 }]}
    >
      <Chevron color={theme.textHeading} dir={dir} />
    </KPress>
  )
}

function Tile({ theme, label, caption, on, width, onPress, a11y, tone = "plain" }: { theme: SongsTheme; label: string; caption?: string; on?: boolean; width?: number; onPress: () => void; a11y: string; tone?: "plain" | "quiet" }) {
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: Boolean(on) }}
      onPress={onPress}
      pressedScale={0.95}
      outerStyle={width ? { width } : undefined}
      style={[
        s.tile,
        caption ? s.tileTall : null,
        {
          backgroundColor: on ? theme.ink900 : tone === "quiet" ? theme.peach : theme.page,
          borderColor: on ? theme.ink900 : tone === "quiet" ? theme.accent : theme.line,
        },
      ]}
    >
      <Text style={[s.tileText, { color: on ? theme.onInk : tone === "quiet" ? theme.accent : theme.textHeading }]} numberOfLines={1}>
        {label}
      </Text>
      {caption ? (
        <Text style={[s.tileCaption, { color: on ? theme.onInk : theme.textBody }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </KPress>
  )
}

function Section({ theme, label, children }: { theme: SongsTheme; label: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: theme.textBody }]} accessibilityRole="header">
        {label}
      </Text>
      {children}
    </View>
  )
}

function MainPage({
  theme,
  width,
  current,
  keyName,
  used,
  onPick,
  onClear,
  onMore,
  onType,
}: {
  theme: SongsTheme
  width: number
  current: string | null
  keyName: string
  used: string[]
  onPick: (chord: string) => void
  onClear: () => void
  onMore: () => void
  onType: () => void
}) {
  const t = useT()
  const usual = useMemo(() => suggestedChords(keyName), [keyName])
  const tile = Math.floor((width - GAP * 3) / 4)
  return (
    <>
      {used.length ? (
        <Section theme={theme} label={t("chordOffer.sheet.used")}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.rowScroll}>
            {used.map((chord) => (
              <Tile key={chord} theme={theme} label={chord} on={chord === current} a11y={t("chordOffer.sheet.chip.a11y", { chord })} onPress={() => onPick(chord)} width={Math.max(52, tile)} />
            ))}
          </ScrollView>
        </Section>
      ) : null}
      <Section theme={theme} label={t("chordOffer.sheet.usual", { key: keyName })}>
        <View style={s.grid}>
          {usual.map((chord) => (
            <Tile key={chord} theme={theme} label={chord} on={chord === current} a11y={t("chordOffer.sheet.chip.a11y", { chord })} onPress={() => onPick(chord)} width={tile} />
          ))}
          <Tile theme={theme} label={t("chordOffer.sheet.moreTile")} a11y={t("chordOffer.sheet.more")} tone="quiet" onPress={onMore} width={tile} />
        </View>
      </Section>
      <View style={s.footer}>
        <KPress
          accessibilityRole="button"
          accessibilityLabel={t("chordOffer.sheet.noChord")}
          onPress={onClear}
          pressedScale={0.97}
          outerStyle={s.footerMain}
          style={[s.footerButton, { borderColor: current ? theme.dangerText : theme.line }]}
        >
          <Text style={[s.footerText, { color: current ? theme.dangerText : theme.textBody }]}>{t("chordOffer.sheet.noChord")}</Text>
        </KPress>
        <KPress accessibilityRole="button" accessibilityLabel={t("chordOffer.sheet.type")} onPress={onType} pressedScale={0.97} outerStyle={s.footerMain} style={[s.footerButton, { borderColor: theme.line }]}>
          <Text style={[s.footerText, { color: theme.textHeading }]}>{t("chordOffer.sheet.type")}</Text>
        </KPress>
      </View>
    </>
  )
}

function SubHead({ theme, label, onBack }: { theme: SongsTheme; label: string; onBack: () => void }) {
  const t = useT()
  return (
    <KPress accessibilityRole="button" accessibilityLabel={t("chordOffer.sheet.back")} onPress={onBack} pressedScale={0.97} outerStyle={s.backOuter} style={s.back}>
      <Chevron color={theme.accent} dir="back" />
      <Text style={[s.backText, { color: theme.accent }]}>{label}</Text>
    </KPress>
  )
}

function MorePage({ theme, width, current, onBack, onPick }: { theme: SongsTheme; width: number; current: string | null; onBack: () => void; onPick: (chord: string) => void }) {
  const t = useT()
  const [root, setRoot] = useState<string | null>(null)
  const sixth = Math.floor((width - GAP * 5) / 6)
  const fifth = Math.floor((width - GAP * 4) / 5)
  return (
    <>
      <SubHead theme={theme} label={t("chordOffer.sheet.more")} onBack={onBack} />
      <Section theme={theme} label={t("chordOffer.sheet.step1")}>
        <View style={s.grid}>
          {ROOTS.map((r) => (
            <Tile key={r} theme={theme} label={r} on={r === root} a11y={t("chordOffer.sheet.root.a11y", { root: r })} onPress={() => setRoot(r)} width={sixth} />
          ))}
        </View>
      </Section>
      <Section theme={theme} label={t("chordOffer.sheet.step2")}>
        {root ? (
          <View style={s.grid}>
            {QUALITIES.map((q: Quality) => {
              const chord = buildChord(root, q)
              return (
                <Tile
                  key={q || "major"}
                  theme={theme}
                  label={chord}
                  caption={t(`chordOffer.kind.${QUALITY_KIND[q]}` as "chordOffer.kind.major")}
                  on={chord === current}
                  a11y={t("chordOffer.sheet.use", { chord })}
                  onPress={() => onPick(chord)}
                  width={fifth}
                />
              )
            })}
          </View>
        ) : (
          <Text style={[s.waitText, { color: theme.textBody }]}>{t("chordOffer.sheet.step2.wait")}</Text>
        )}
      </Section>
    </>
  )
}

function TypePage({ theme, onBack, onPick }: { theme: SongsTheme; onBack: () => void; onPick: (chord: string) => void }) {
  const t = useT()
  const [typed, setTyped] = useState("")
  const [bad, setBad] = useState<string | null>(null)
  const input = useRef<TextInput>(null)
  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 120)
    return () => clearTimeout(id)
  }, [])
  const submit = () => {
    const name = cleanChordName(typed)
    if (!name) return
    if (!isChordName(name)) {
      setBad(name)
      return
    }
    setBad(null)
    onPick(name)
  }
  return (
    <>
      <SubHead theme={theme} label={t("chordOffer.sheet.type")} onBack={onBack} />
      <Text style={[s.waitText, { color: theme.textBody }]}>{t("chordOffer.sheet.typeHint")}</Text>
      <View style={[s.input, { backgroundColor: theme.page, borderColor: bad ? theme.dangerText : theme.line }]}>
        <TextInput
          ref={input}
          value={typed}
          onChangeText={(text) => {
            setTyped(text)
            setBad(null)
          }}
          onSubmitEditing={submit}
          placeholder={t("chordOffer.sheet.typePlaceholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t("chordOffer.sheet.type")}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={16}
          returnKeyType="done"
          style={[s.inputText, { color: theme.textHeading }]}
        />
        <KPress
          accessibilityRole="button"
          accessibilityLabel={t("chordOffer.sheet.use", { chord: cleanChordName(typed) || "…" })}
          accessibilityState={{ disabled: !typed.trim() }}
          onPress={typed.trim() ? submit : undefined}
          pressedScale={0.96}
          style={[s.useTyped, { backgroundColor: theme.ink900, opacity: typed.trim() ? 1 : 0.4 }]}
        >
          <Text style={[s.doneText, { color: theme.onInk }]}>{t("chordOffer.sheet.use", { chord: cleanChordName(typed) || "…" })}</Text>
        </KPress>
      </View>
      {bad ? (
        <Text style={[s.waitText, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
          {t("chordOffer.sheet.typeBad", { chord: bad })}
        </Text>
      ) : null}
    </>
  )
}

const s = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", alignItems: "center" },
  sheet: { position: "absolute", bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1.5, borderBottomWidth: 0, overflow: "hidden" },
  content: { position: "absolute", top: 0, left: 0, right: 0 },
  grab: { paddingTop: 8 },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 8 },
  titles: { flex: 1, minWidth: 0, gap: 2 },
  over: { fontFamily: amFonts.semi, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase" },
  word: { fontFamily: amFonts.bold, fontSize: 24, lineHeight: 28 },
  now: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  headActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  step: { width: 44, height: 44, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  done: { height: 44, minWidth: 72, paddingHorizontal: 16, borderRadius: PILL, alignItems: "center", justifyContent: "center" },
  doneText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: GUTTER, paddingTop: 8, gap: 16 },
  section: { gap: 8 },
  sectionLabel: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  rowScroll: { flexDirection: "row", gap: GAP },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: { minHeight: 52, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tileTall: { minHeight: 60, paddingVertical: 6 },
  tileText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  tileCaption: { fontFamily: amFonts.medium, fontSize: 10, lineHeight: 12 },
  footer: { flexDirection: "row", gap: GAP },
  footerMain: { flex: 1 },
  footerButton: { minHeight: 48, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  footerText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18, textAlign: "center" },
  backOuter: { alignSelf: "flex-start" },
  back: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingRight: 12 },
  backText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  waitText: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  input: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 24, paddingLeft: 16, paddingRight: 4, minHeight: 56 },
  inputText: { flex: 1, minWidth: 0, fontFamily: amFonts.bold, fontSize: 18, lineHeight: 24, paddingVertical: 12, outlineStyle: "none" as never },
  useTyped: { height: 48, minWidth: 96, paddingHorizontal: 16, borderRadius: PILL, alignItems: "center", justifyContent: "center" },
})
