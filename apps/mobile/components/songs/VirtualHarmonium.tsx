import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"

import {
  BANDHU_HE_NIYE_CALO_SONG,
  HARMONIUM_PLAY_TEMPO_ORDER,
  HARMONIUM_PLAY_TEMPOS,
  HARMONIUM_TONICS,
  HARMONIUM_VOICE_REGISTERS,
  SARGAM_EXAMPLES,
  harmoniumKeyboardLayout,
  keyboardIndexForWestern,
  parseSargamInput,
  sampleSongLineEvents,
  sampleSongPlayEvents,
  sampleSongTiming,
  splitBookletLyric,
  sargamPlayEvents,
  type HarmoniumKeyboardKey,
  type HarmoniumPlayTempo,
  type HarmoniumSampleSong,
  type HarmoniumVoiceRegister,
} from "@prabhat/core"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { playSheetEvents, setHarmoniumSheetHighlightListener, setHarmoniumVoiceRegister, startWesternNote, stopActiveHarmoniumNote, stopHarmoniumSheetPlayback, type SheetPlaybackHandlers } from "@/lib/harmoniumPlayback"

type Props = {
  tonic: string
  onTonicChange?: (tonic: string) => void
  song?: HarmoniumSampleSong
  keyboardOnly?: boolean
  captureMode?: boolean
  onTempoBpmChange?: (bpm: number) => void
  onPressKey?: (key: HarmoniumKeyboardKey) => void
  onReleaseKey?: (key: HarmoniumKeyboardKey) => void
}

export function VirtualHarmonium({
  tonic,
  onTonicChange,
  song = BANDHU_HE_NIYE_CALO_SONG,
  keyboardOnly = false,
  captureMode = false,
  onTempoBpmChange,
  onPressKey,
  onReleaseKey,
}: Props) {
  const [typed, setTyped] = useState("")
  const [activeIndexes, setActiveIndexes] = useState<Set<number>>(new Set())
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [songLineIndex, setSongLineIndex] = useState<number | null>(null)
  const [tempo, setTempo] = useState<HarmoniumPlayTempo>("medium")
  const [voiceRegister, setVoiceRegister] = useState<HarmoniumVoiceRegister>("male")
  const stopsRef = useRef(new Map<number, () => void>())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const playbackGen = useRef(0)
  const keys = useMemo(() => harmoniumKeyboardLayout(tonic), [tonic])
  const whiteKeys = useMemo(() => keys.filter((key) => !key.isBlack), [keys])
  const blackKeys = useMemo(() => keys.filter((key) => key.isBlack), [keys])
  const parsedPreview = useMemo(() => parseSargamInput(typed, tonic), [typed, tonic])
  const tempoPreset = sampleSongTiming(tempo)
  const showSampleSong = !keyboardOnly && !captureMode
  const showPlayerTools = !keyboardOnly || captureMode

  useEffect(() => {
    onTempoBpmChange?.(tempoPreset.bpm)
  }, [onTempoBpmChange, tempoPreset.bpm])

  const applyPlaybackHighlight = useCallback((western: string | null) => {
    if (!western) {
      setPlaybackIndex(null)
      return
    }
    const index = keyboardIndexForWestern(keys, western)
    setPlaybackIndex(index >= 0 ? index : null)
  }, [keys])

  const playbackHandlers = useMemo<SheetPlaybackHandlers>(
    () => ({ onKeyHighlight: applyPlaybackHighlight }),
    [applyPlaybackHighlight],
  )

  useEffect(() => {
    const register = HARMONIUM_VOICE_REGISTERS.find((item) => item.id === voiceRegister)
    setHarmoniumVoiceRegister(register?.semitones ?? 0)
  }, [voiceRegister])

  useEffect(() => {
    setHarmoniumSheetHighlightListener(applyPlaybackHighlight)
    return () => setHarmoniumSheetHighlightListener(null)
  }, [applyPlaybackHighlight])

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
    onPressKey?.(key)
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
    const key = keys[index]
    if (key) onReleaseKey?.(key)
  }

  function stopPlayback() {
    playbackGen.current += 1
    timers.current.forEach(clearTimeout)
    timers.current = []
    stopHarmoniumSheetPlayback()
    setPlaying(false)
    setActiveIndexes(new Set())
    setPlaybackIndex(null)
    setSongLineIndex(null)
  }

  function resetSongPlayback() {
    stopPlayback()
  }

  function resetTypedPlayback() {
    stopPlayback()
    setTyped("")
  }

  async function playTyped() {
    if (!typed.trim() || playing) return
    const gen = playbackGen.current
    setPlaying(true)
    timers.current.forEach(clearTimeout)
    timers.current = []
    const events = sargamPlayEvents(tonic, typed, 60 / tempoPreset.bpm, tempoPreset.gapSec)
    try {
      await playSheetEvents(events, playbackHandlers)
    } finally {
      if (gen !== playbackGen.current) return
      setPlaying(false)
      setActiveIndexes(new Set())
      setPlaybackIndex(null)
    }
  }

  async function playSampleSong() {
    if (playing) return
    const gen = playbackGen.current
    setPlaying(true)
    timers.current.forEach(clearTimeout)
    timers.current = []
    const events = sampleSongPlayEvents(tonic, song, tempo)
    const lines = sampleSongLineEvents(tonic, song, tempo)
    for (const [lineIndex, line] of lines.entries()) {
      timers.current.push(
        setTimeout(() => {
          if (gen !== playbackGen.current) return
          setSongLineIndex(lineIndex)
        }, Math.round(line.startSec * 1000)),
      )
    }
    try {
      await playSheetEvents(events, playbackHandlers)
    } finally {
      if (gen !== playbackGen.current) return
      setPlaying(false)
      setActiveIndexes(new Set())
      setPlaybackIndex(null)
      setSongLineIndex(null)
    }
  }

  return (
    <View style={styles.wrap}>
      {keyboardOnly && !captureMode ? (
        <>
          <Text style={styles.eyebrow}>Line capture</Text>
          <Text style={styles.title}>Virtual harmonium</Text>
          <Text style={styles.lead}>Hold keys to record · Sa below</Text>
        </>
      ) : (
        <>
          <Text style={styles.eyebrow}>{captureMode ? "Capture studio" : "Classic harmonium"}</Text>
          <Text style={styles.title}>{captureMode ? "Real reed samples" : "Two-octave keyboard"}</Text>
          <Text style={styles.lead}>
            {captureMode
              ? "Same reed engine as learner practice · tune Sa, voice, and tempo before you record"
              : "Hold keys to sustain, like bellows feeding the reeds. Play more than one key at a time."}
          </Text>
        </>
      )}

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

      {showPlayerTools ? (
        <>
          <Text style={styles.inputLabel}>Voice</Text>
          <View style={styles.tempoRow}>
            {HARMONIUM_VOICE_REGISTERS.map((register) => (
              <Pressable
                key={register.id}
                onPress={() => setVoiceRegister(register.id)}
                style={[styles.tonicChip, voiceRegister === register.id && styles.tonicActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: voiceRegister === register.id }}
                accessibilityLabel={register.label}
              >
                <Text style={[styles.tonicText, voiceRegister === register.id && styles.tonicTextActive]}>
                  {register.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.keyHint}>
        Auto-play lights keys in amber. PS 1–2 use middle octave; PS 4 uses taar (Sa′); black keys light for komal swaras.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.keyboard}>
          <View style={styles.whiteRow}>
            {whiteKeys.map((key) => {
              const index = keys.indexOf(key)
              const active = activeIndexes.has(index) || playbackIndex === index
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
            const active = activeIndexes.has(index) || playbackIndex === index
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

      {showSampleSong ? (
        <>
          <Text style={styles.inputLabel}>{song.id === BANDHU_HE_NIYE_CALO_SONG.id ? "Sample song" : "Full sargam"}</Text>
          <Text style={styles.songTitle}>{song.title}</Text>
          <Text style={styles.songHi}>{song.titleHi}</Text>
          <Text style={styles.lead}>Set Sa, then play each sargam beat on the matching key. Lines flow with a quick breath between them.</Text>
          <Pressable
            onPress={() => void playSampleSong()}
            disabled={playing}
            style={[styles.playBtn, playing && styles.playBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Play on keys"
          >
            <Text style={styles.playBtnText}>{playing && songLineIndex != null ? "Playing…" : "▶ Play on keys"}</Text>
          </Pressable>
          <View style={styles.controlRow}>
            <Pressable
              onPress={stopPlayback}
              disabled={!playing}
              style={[styles.outlineBtn, !playing && styles.outlineBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Stop song"
            >
              <Text style={styles.outlineBtnText}>Stop</Text>
            </Pressable>
            <Pressable
              onPress={resetSongPlayback}
              style={styles.outlineBtn}
              accessibilityRole="button"
              accessibilityLabel="Reset song"
            >
              <Text style={styles.outlineBtnText}>Reset</Text>
            </Pressable>
          </View>
          {song.lines.map((line, index) => (
            <View key={`${index}-${line.sargam}`} style={[styles.songLineBlock, songLineIndex === index && styles.songLineActive]}>
              {line.bookletMarker ? (
                <Text style={styles.bookletMarker}>{line.bookletMarker}</Text>
              ) : null}
              {splitBookletLyric(line.lyric).map((part) => (
                <Text
                  key={part}
                  style={[styles.songLine, songLineIndex === index && { color: colors.spiritualGold, fontFamily: "Inter_600SemiBold" }]}
                >
                  {part}
                </Text>
              ))}
              {splitBookletLyric(line.lyricHi).map((part) => (
                <Text key={`${part}-hi`} style={styles.songLineHi}>
                  {part}
                </Text>
              ))}
              <Text style={styles.songSargam}>{line.sargam}</Text>
            </View>
          ))}
        </>
      ) : null}

      {showPlayerTools ? (
        <>
          <Text style={styles.inputLabel}>Reed & tempo tuner</Text>
          <View style={styles.tempoRow}>
            {HARMONIUM_PLAY_TEMPO_ORDER.map((id) => (
              <Pressable
                key={id}
                onPress={() => setTempo(id)}
                style={[styles.tonicChip, tempo === id && styles.tonicActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: tempo === id }}
                accessibilityLabel={HARMONIUM_PLAY_TEMPOS[id].label}
              >
                <Text style={[styles.tonicText, tempo === id && styles.tonicTextActive]}>
                  {HARMONIUM_PLAY_TEMPOS[id].label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.songHi}>
            {tempoPreset.label} · {tempoPreset.bpm} BPM · note {tempoPreset.noteSec.toFixed(2)}s
          </Text>

          {captureMode ? null : (
            <>
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
                accessibilityRole="button"
                accessibilityLabel="Play typed sargam"
              >
                <Text style={styles.playBtnText}>{playing ? "Playing…" : "▶ Play typed sargam"}</Text>
              </Pressable>
              <View style={styles.controlRow}>
                <Pressable
                  onPress={stopPlayback}
                  disabled={!playing}
                  style={[styles.outlineBtn, !playing && styles.outlineBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Stop typed sargam"
                >
                  <Text style={styles.outlineBtnText}>Stop</Text>
                </Pressable>
                <Pressable
                  onPress={resetTypedPlayback}
                  style={styles.outlineBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Reset typed sargam"
                >
                  <Text style={styles.outlineBtnText}>Reset</Text>
                </Pressable>
              </View>

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
            </>
          )}
        </>
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
  tempoRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
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
  keyHint: {
    ...typography.caption,
    color: colors.spiritualGold,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
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
  keyActive: {
    backgroundColor: "#fcd34d",
    borderColor: colors.primary,
    borderWidth: 2,
  },
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
  blackKeyActive: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    transform: [{ scale: 1.06 }],
  },
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
  songLineBlock: { marginBottom: spacing.xs },
  bookletMarker: {
    ...typography.caption,
    alignSelf: "flex-start",
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    color: colors.textMuted,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    textTransform: "uppercase",
  },
  songLine: { ...typography.bodySmall, color: colors.playerMuted },
  songLineHi: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  songSargam: { ...typography.caption, color: colors.textMuted, fontFamily: "SourceSerif4_400Regular", marginTop: spacing.xs },
  songLineActive: { borderLeftWidth: 2, borderLeftColor: colors.spiritualGold, paddingLeft: spacing.sm },
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
  controlRow: { flexDirection: "row", gap: spacing.sm },
  outlineBtn: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  outlineBtnDisabled: { opacity: 0.4 },
  outlineBtnText: { ...typography.label, color: colors.playerMuted, fontFamily: "Inter_600SemiBold" },
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
