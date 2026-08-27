import { useEffect, useMemo, useRef, useState } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"

import {
  HARMONIUM_TONICS,
  RAGHUPATI_RAGHAV_SONG,
  SARGAM_EXAMPLES,
  harmoniumKeyboardLayout,
  keyboardIndexForWestern,
  parseSargamInput,
  sampleSongLineEvents,
  sampleSongPlayEvents,
  sargamPlayEvents,
  type HarmoniumKeyboardKey,
} from "@prabhat/core"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { playSheetEvents, startWesternNote, stopActiveHarmoniumNote } from "@/lib/harmoniumPlayback"

type Props = {
  tonic: string
  onTonicChange?: (tonic: string) => void
}

export function VirtualHarmonium({ tonic, onTonicChange }: Props) {
  const [typed, setTyped] = useState("")
  const [activeIndexes, setActiveIndexes] = useState<Set<number>>(new Set())
  const [playing, setPlaying] = useState(false)
  const [songLineIndex, setSongLineIndex] = useState<number | null>(null)
  const stopsRef = useRef(new Map<number, () => void>())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const keys = useMemo(() => harmoniumKeyboardLayout(tonic), [tonic])
  const whiteKeys = useMemo(() => keys.filter((key) => !key.isBlack), [keys])
  const blackKeys = useMemo(() => keys.filter((key) => key.isBlack), [keys])
  const parsedPreview = useMemo(() => parseSargamInput(typed, tonic), [typed, tonic])
  const song = RAGHUPATI_RAGHAV_SONG

  useEffect(() => {
    return () => {
      stopsRef.current.forEach((stop) => stop())
      stopsRef.current.clear()
      void stopActiveHarmoniumNote()
      timers.current.forEach(clearTimeout)
    }
  }, [])

  async function pressKey(key: HarmoniumKeyboardKey | undefined, index: number) {
    if (!key || stopsRef.current.has(index)) return
    stopsRef.current.set(index, () => undefined)
    setActiveIndexes((current) => new Set(current).add(index))
    const stop = await startWesternNote(key.western)
    if (!stopsRef.current.has(index)) {
      stop()
      return
    }
    stopsRef.current.set(index, stop)
  }

  function releaseKey(index: number) {
    const stop = stopsRef.current.get(index)
    if (!stop) return
    stop()
    stopsRef.current.delete(index)
    setActiveIndexes((current) => {
      const next = new Set(current)
      next.delete(index)
      return next
    })
  }

  async function playTyped() {
    if (!typed.trim() || playing) return
    setPlaying(true)
    try {
      await playSheetEvents(sargamPlayEvents(tonic, typed))
    } finally {
      setPlaying(false)
    }
  }

  async function playSampleSong() {
    if (playing) return
    setPlaying(true)
    timers.current.forEach(clearTimeout)
    timers.current = []
    const events = sampleSongPlayEvents(tonic, song)
    const lines = sampleSongLineEvents(tonic, song)
    for (const [lineIndex, line] of lines.entries()) {
      timers.current.push(setTimeout(() => setSongLineIndex(lineIndex), Math.round(line.startSec * 1000)))
    }
    for (const event of events) {
      timers.current.push(
        setTimeout(() => {
          const index = keyboardIndexForWestern(keys, event.western)
          setActiveIndexes(index >= 0 ? new Set([index]) : new Set())
        }, Math.round(event.startSec * 1000)),
      )
    }
    try {
      await playSheetEvents(events)
    } finally {
      setPlaying(false)
      setActiveIndexes(new Set())
      setSongLineIndex(null)
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Classic harmonium</Text>
      <Text style={styles.title}>Two-octave keyboard</Text>
      <Text style={styles.lead}>Hold keys to sustain, like bellows feeding the reeds. Play more than one key at a time.</Text>

      {onTonicChange ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tonicRow}>
          {HARMONIUM_TONICS.map((value) => (
            <Pressable
              key={value}
              onPress={() => onTonicChange(value)}
              style={[styles.tonicChip, tonic === value && styles.tonicActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: tonic === value }}
            >
              <Text style={[styles.tonicText, tonic === value && styles.tonicTextActive]}>Sa {value}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.tonicLabel}>Sa = {tonic}</Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.keyboard}>
          <View style={styles.whiteRow}>
            {whiteKeys.map((key) => {
              const index = keys.indexOf(key)
              const active = activeIndexes.has(index)
              return (
                <Pressable
                  key={key.western}
                  onPressIn={() => void pressKey(key, index)}
                  onPressOut={() => releaseKey(index)}
                  style={[styles.whiteKey, active && styles.keyActive, key.isSa && styles.saKey]}
                  accessibilityRole="button"
                  accessibilityLabel={`${key.latin} ${key.keyLabel}`}
                >
                  {key.isSa ? <View style={styles.saDot} /> : null}
                  <Text style={styles.keyDevanagari}>{key.devanagari}</Text>
                  <Text style={styles.keyLatin}>{key.latin}</Text>
                </Pressable>
              )
            })}
          </View>
          {blackKeys.map((key) => {
            const index = keys.indexOf(key)
            const active = activeIndexes.has(index)
            return (
              <Pressable
                key={key.western}
                onPressIn={() => void pressKey(key, index)}
                onPressOut={() => releaseKey(index)}
                style={[styles.blackKey, { left: `${key.blackLeftPercent}%` }, active && styles.blackKeyActive]}
                accessibilityRole="button"
                accessibilityLabel={`${key.latin} ${key.keyLabel}`}
              >
                <Text style={styles.blackLabel}>{key.devanagari}</Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>

      <Text style={styles.inputLabel}>Sample song</Text>
      <Text style={styles.songTitle}>{song.title}</Text>
      <Text style={styles.songHi}>{song.titleHi}</Text>
      <Text style={styles.lead}>Set Sa, then play each sargam syllable on the matching key.</Text>
      <Pressable
        onPress={() => void playSampleSong()}
        disabled={playing}
        style={[styles.playBtn, playing && styles.playBtnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Play on keys"
      >
        <Text style={styles.playBtnText}>{playing && songLineIndex != null ? "Playing…" : "▶ Play on keys"}</Text>
      </Pressable>
      {song.lines.map((line, index) => (
        <Text key={line.lyric} style={[styles.songLine, songLineIndex === index && styles.songLineActive]}>
          {line.lyric}
        </Text>
      ))}

      <Text style={styles.inputLabel}>Type sargam</Text>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        placeholder="Sa Re Ga Ma Pa Dha Ni Sa′"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={() => void playTyped()}
      />
      <Pressable
        onPress={() => void playTyped()}
        disabled={!typed.trim() || playing}
        style={[styles.playBtn, (!typed.trim() || playing) && styles.playBtnDisabled]}
      >
        <Text style={styles.playBtnText}>{playing ? "Playing…" : "▶ Play typed sargam"}</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exampleRow}>
        {SARGAM_EXAMPLES.map((example) => (
          <Pressable key={example} onPress={() => setTyped(example)} style={styles.exampleChip}>
            <Text style={styles.exampleText}>{example}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {parsedPreview.length ? (
        <Text style={styles.preview}>
          {parsedPreview.length} swaras · {parsedPreview.map((item) => item.western).join(" · ")}
        </Text>
      ) : typed.trim() ? (
        <Text style={styles.previewWarn}>Could not read swaras — try Sa Re Ga Ma or सा रे ग म</Text>
      ) : null}
    </View>
  )
}

const KEYBOARD_WIDTH = 640

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.playerBackground,
    padding: spacing.md,
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.spiritualGold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Inter_600SemiBold",
  },
  title: {
    ...typography.h3,
    color: colors.white,
    fontFamily: "SourceSerif4_600SemiBold",
  },
  lead: { ...typography.bodySmall, color: colors.playerMuted },
  tonicRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  tonicChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  tonicActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tonicText: { ...typography.caption, color: colors.textPrimary },
  tonicTextActive: { color: colors.primaryDark, fontFamily: "Inter_600SemiBold" },
  tonicLabel: { ...typography.caption, color: colors.playerMuted },
  keyboard: { width: KEYBOARD_WIDTH, height: 168, position: "relative" },
  whiteRow: { flexDirection: "row", height: "100%" },
  whiteKey: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: spacing.sm,
  },
  saKey: { backgroundColor: "#fff8e8" },
  keyActive: { backgroundColor: colors.primaryLight },
  saDot: {
    position: "absolute",
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.spiritualGold,
  },
  keyDevanagari: { fontSize: 14, color: colors.textPrimary, fontFamily: "SourceSerif4_600SemiBold" },
  keyLatin: { ...typography.caption, color: colors.textSecondary },
  blackKey: {
    position: "absolute",
    top: 0,
    width: 28,
    height: 96,
    marginLeft: -14,
    borderRadius: 4,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 6,
    zIndex: 2,
  },
  blackKeyActive: { backgroundColor: colors.primary },
  blackLabel: { color: colors.white, fontSize: 10 },
  inputLabel: {
    ...typography.caption,
    color: colors.spiritualGold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.xs,
    fontFamily: "Inter_600SemiBold",
  },
  songTitle: { ...typography.h3, color: colors.white, fontFamily: "SourceSerif4_600SemiBold", fontSize: 18 },
  songHi: { ...typography.caption, color: colors.playerMuted },
  songLine: { ...typography.bodySmall, color: colors.playerMuted },
  songLineActive: { color: colors.spiritualGold, fontFamily: "Inter_600SemiBold" },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.bodySmall,
  },
  playBtn: {
    borderRadius: radius.pill,
    backgroundColor: colors.spiritualGold,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  playBtnDisabled: { opacity: 0.5 },
  playBtnText: { ...typography.label, color: colors.textPrimary, fontFamily: "Inter_600SemiBold" },
  exampleRow: { gap: spacing.sm },
  exampleChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  exampleText: { ...typography.caption, color: colors.playerMuted },
  preview: { ...typography.caption, color: colors.playerMuted },
  previewWarn: { ...typography.caption, color: colors.warning },
})
