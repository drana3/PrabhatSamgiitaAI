import { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { QUALITIES, ROOTS, buildChord, cleanChordName, isChordName, suggestedChords, type Quality } from "@/lib/songChords/chordName"

import { ActionButton, Chip, CORNER } from "./parts"

/**
 * The chord palette, docked under the lyric sheet while a word is selected. Quick row: the chords already used in this
 * chart, then the usual chords of the key (I, IV, V, vi, ii, iii, V7). "Another chord": a root and a kind, or typed
 * (slash chords such as G/B). Tapping a chord puts it on the word at once; "No chord here" clears it.
 */
export function ChordPalette({
  theme,
  word,
  current,
  keyName,
  used,
  onPick,
  onClear,
  onPrevious,
  onNext,
  onDone,
}: {
  theme: SongsTheme
  word: string
  current: string | null
  keyName: string
  used: string[]
  onPick: (chord: string) => void
  onClear: () => void
  onPrevious: (() => void) | null
  onNext: (() => void) | null
  onDone: () => void
}) {
  const t = useT()
  const reduce = useReducedMotion()
  const lift = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    lift.value = reduce ? 1 : withSpring(1, amSpring.default)
  }, [lift, reduce])
  const enter = useAnimatedStyle(() => ({ opacity: lift.value, transform: [{ translateY: (1 - lift.value) * 24 }] }))

  const common = useMemo(() => suggestedChords(keyName), [keyName])
  const [more, setMore] = useState(false)
  const [root, setRoot] = useState<string | null>(null)
  const [typed, setTyped] = useState("")
  const [typedBad, setTypedBad] = useState<string | null>(null)

  const submitTyped = () => {
    const name = cleanChordName(typed)
    if (!name) return
    if (!isChordName(name)) {
      setTypedBad(name)
      return
    }
    setTypedBad(null)
    setTyped("")
    onPick(name)
  }

  const row = (chords: string[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.chips}>
      {chords.map((chord) => (
        <Chip key={chord} theme={theme} label={chord} on={chord === current} a11y={t("chordOffer.palette.chip.a11y", { chord })} minWidth={52} onPress={() => onPick(chord)} />
      ))}
    </ScrollView>
  )

  return (
    <Animated.View style={[s.dock, { backgroundColor: theme.card, borderTopColor: theme.line }, enter]}>
      <View style={s.head}>
        <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={1} accessibilityRole="header" accessibilityLiveRegion="polite">
          {t("chordOffer.palette.title", { word })}
        </Text>
        <ActionButton theme={theme} tone="quiet" label={t("chordOffer.palette.done")} onPress={onDone} style={s.done} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={s.group}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.chips}>
            <Chip theme={theme} label={t("chordOffer.palette.clear")} role="button" danger={current !== null} onPress={onClear} />
            {onPrevious ? <Chip theme={theme} label="‹" role="button" a11y={t("chordOffer.palette.previous")} minWidth={44} onPress={onPrevious} /> : null}
            {onNext ? <Chip theme={theme} label="›" role="button" a11y={t("chordOffer.palette.next")} minWidth={44} onPress={onNext} /> : null}
          </ScrollView>
        </View>
        {used.length ? (
          <View style={s.group}>
            <Text style={[s.sub, { color: theme.textBody }]}>{t("chordOffer.palette.used")}</Text>
            {row(used)}
          </View>
        ) : null}
        <View style={s.group}>
          <Text style={[s.sub, { color: theme.textBody }]}>{t("chordOffer.palette.common", { key: keyName })}</Text>
          {row(common)}
        </View>
        <View style={s.group}>
          <Chip theme={theme} role="button" label={t("chordOffer.palette.other")} on={more} onPress={() => setMore((was) => !was)} />
          {more ? (
            <View style={s.more}>
              <Text style={[s.sub, { color: theme.textBody }]}>{t("chordOffer.palette.root")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.chips}>
                {ROOTS.map((r) => (
                  <Chip key={r} theme={theme} label={r} on={r === root} minWidth={48} onPress={() => setRoot(r)} />
                ))}
              </ScrollView>
              {root ? (
                <>
                  <Text style={[s.sub, { color: theme.textBody }]}>{t("chordOffer.palette.kind")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.chips}>
                    {QUALITIES.map((q: Quality) => {
                      const chord = buildChord(root, q)
                      return <Chip key={q || "major"} theme={theme} label={chord} on={chord === current} role="button" a11y={t("chordOffer.palette.use", { chord })} minWidth={56} onPress={() => onPick(chord)} />
                    })}
                  </ScrollView>
                </>
              ) : null}
              <Text style={[s.sub, { color: theme.textBody }]}>{t("chordOffer.palette.type")}</Text>
              <View style={[s.input, { backgroundColor: theme.page, borderColor: typedBad ? theme.dangerText : theme.line }]}>
                <TextInput
                  value={typed}
                  onChangeText={(text) => {
                    setTyped(text)
                    setTypedBad(null)
                  }}
                  onSubmitEditing={submitTyped}
                  placeholder={t("chordOffer.palette.typePlaceholder")}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("chordOffer.palette.type")}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={16}
                  returnKeyType="done"
                  style={[s.inputText, { color: theme.textHeading }]}
                />
                <ActionButton theme={theme} label={t("chordOffer.palette.use", { chord: cleanChordName(typed) || "…" })} onPress={submitTyped} disabled={!typed.trim()} style={s.useTyped} />
              </View>
              {typedBad ? (
                <Text style={[s.sub, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
                  {t("chordOffer.palette.typeBad", { chord: typedBad })}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  dock: { borderTopWidth: 1.5, maxHeight: 360, paddingTop: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  title: { flex: 1, minWidth: 0, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  done: { minWidth: 88 },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 14, gap: 12 },
  group: { gap: 6 },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  sub: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, paddingHorizontal: 16, textTransform: "uppercase", letterSpacing: 0.6 },
  more: { gap: 8 },
  input: { marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: CORNER, paddingLeft: 12, paddingRight: 4, minHeight: 52 },
  inputText: { flex: 1, minWidth: 0, fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, paddingVertical: 10, outlineStyle: "none" as never },
  useTyped: { minHeight: 44, minWidth: 96, paddingHorizontal: 12 },
})
