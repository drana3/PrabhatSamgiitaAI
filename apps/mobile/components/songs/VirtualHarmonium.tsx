import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
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

import { HarmoniumTuningBar } from "@/components/songs/HarmoniumTuningBar"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { hitTestHarmoniumKey } from "@/lib/harmoniumHitTest"
import { harmoniumMetronomeBpm, startHarmoniumMetronome, stopHarmoniumMetronome } from "@/lib/harmoniumMetronome"
import { createMultiTouchKeyTracker } from "@/lib/multiTouchKeyTracker"
import {
  playSheetEvents,
  setHarmoniumBellows,
  setHarmoniumCoupler,
  setHarmoniumFineTune,
  setHarmoniumSheetHighlightListener,
  setHarmoniumVoiceRegister,
  startHarmoniumDrone,
  startWesternNote,
  stopActiveHarmoniumNote,
  stopHarmoniumDrone,
  stopHarmoniumSheetPlayback,
  warmHarmoniumCaptureAudio,
  type SheetPlaybackHandlers,
} from "@/lib/harmoniumPlayback"

type Props = {
  tonic: string
  onTonicChange?: (tonic: string) => void
  song?: HarmoniumSampleSong
  keyboardOnly?: boolean
  captureMode?: boolean
  layout?: "default" | "fullscreen"
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
  layout = "default",
  onTempoBpmChange,
  onPressKey,
  onReleaseKey,
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const fullscreen = layout === "fullscreen"
  const [keyboardArea, setKeyboardArea] = useState({ width: 0, height: 0 })
  const [bellows, setBellows] = useState(0.7)
  const [fineTune, setFineTune] = useState(0)
  const [droneOn, setDroneOn] = useState(false)
  const [couplerOn, setCouplerOn] = useState(false)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [keyboardZoom, setKeyboardZoom] = useState(1)
  const [typed, setTyped] = useState("")
  const [activeIndexes, setActiveIndexes] = useState<Set<number>>(new Set())
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [songLineIndex, setSongLineIndex] = useState<number | null>(null)
  const [tempo, setTempo] = useState<HarmoniumPlayTempo>("medium")
  const [voiceRegister, setVoiceRegister] = useState<HarmoniumVoiceRegister>("male")
  const stopsRef = useRef(new Map<number, () => void>())
  const touchTracker = useRef(createMultiTouchKeyTracker())
  const keyboardLayoutRef = useRef({
    width: 0,
    height: 0,
    blackKeyWidth: 28,
    blackKeyHeight: 96,
  })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const playbackGen = useRef(0)
  const keys = useMemo(() => harmoniumKeyboardLayout(tonic), [tonic])
  const whiteKeys = useMemo(() => keys.filter((key) => !key.isBlack), [keys])
  const blackKeys = useMemo(() => keys.filter((key) => key.isBlack), [keys])
  const parsedPreview = useMemo(() => parseSargamInput(typed, tonic), [typed, tonic])
  const tempoPreset = sampleSongTiming(tempo)
  const showSampleSong = !keyboardOnly && !captureMode
  const showPlayerTools = !keyboardOnly || captureMode
  const whiteKeyCount = whiteKeys.length
  const zoomFactor = fullscreen || captureMode ? keyboardZoom : 1
  const measuredWidth = keyboardArea.width > 0 ? keyboardArea.width : Math.max(320, windowWidth - spacing.sm * 2)
  const measuredHeight = keyboardArea.height > 0 ? keyboardArea.height : Math.max(220, windowHeight * 0.55)
  const keyboardWidth = (fullscreen ? measuredWidth : KEYBOARD_WIDTH) * zoomFactor
  const keyboardHeight = (fullscreen ? measuredHeight : 168) * zoomFactor
  const whiteKeyWidth = whiteKeyCount > 0 ? keyboardWidth / whiteKeyCount : 48
  const blackKeyWidth = Math.max(28, Math.min(52, whiteKeyWidth * 0.58))
  const blackKeyHeight = Math.max(96, Math.round(keyboardHeight * 0.64))
  const keyDevanagariSize = fullscreen ? Math.max(16, Math.min(24, whiteKeyWidth * 0.34)) : 14
  const keyLatinSize = fullscreen ? Math.max(11, Math.min(15, whiteKeyWidth * 0.22)) : undefined
  const layoutStyles = fullscreen ? fullscreenStyles : styles

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
    if (!captureMode) return
    void warmHarmoniumCaptureAudio(tonic)
  }, [captureMode, tonic])

  useEffect(() => {
    setHarmoniumBellows(bellows)
  }, [bellows])

  useEffect(() => {
    setHarmoniumFineTune(fineTune)
  }, [fineTune])

  useEffect(() => {
    setHarmoniumCoupler(couplerOn)
  }, [couplerOn])

  useEffect(() => {
    if (!droneOn) {
      void stopHarmoniumDrone()
      return
    }
    void startHarmoniumDrone(tonic)
    return () => {
      void stopHarmoniumDrone()
    }
  }, [droneOn, tonic, voiceRegister])

  useEffect(() => {
    if (!metronomeOn) {
      stopHarmoniumMetronome()
      return
    }
    startHarmoniumMetronome(tempoPreset.bpm)
    return () => stopHarmoniumMetronome()
  }, [metronomeOn, tempoPreset.bpm])

  useEffect(() => {
    keyboardLayoutRef.current = {
      width: keyboardWidth,
      height: keyboardHeight,
      blackKeyWidth,
      blackKeyHeight,
    }
  }, [keyboardWidth, keyboardHeight, blackKeyWidth, blackKeyHeight])

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
      touchTracker.current.reset()
      stopHarmoniumMetronome()
      void stopHarmoniumDrone()
      void stopActiveHarmoniumNote()
      timers.current.forEach(clearTimeout)
    }
  }, [])

  function pressKey(key: HarmoniumKeyboardKey | undefined, index: number) {
    if (!key || stopsRef.current.has(index)) return
    stopsRef.current.set(index, () => undefined)
    setActiveIndexes((current) => new Set(current).add(index))
    onPressKey?.(key)
    void startWesternNote(key.western).then((stop) => {
      if (!stopsRef.current.has(index)) {
        stop()
        return
      }
      stopsRef.current.set(index, stop)
    })
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

  function processKeyboardTouches(event: GestureResponderEvent, phase: "start" | "move" | "end") {
    const touches = event.nativeEvent.changedTouches
    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches[index]
      if (!touch) continue
      const touchId = touch.identifier
      if (phase === "end") {
        const result = touchTracker.current.touchUp(touchId)
        if (result?.lastOnKey) releaseKey(result.keyIndex)
        continue
      }
      const keyIndex = hitTestHarmoniumKey(
        touch.locationX,
        touch.locationY,
        keyboardLayoutRef.current,
        keys,
        whiteKeys,
        blackKeys,
      )
      if (keyIndex < 0) continue
      const key = keys[keyIndex]
      if (!key) continue
      if (phase === "start") {
        if (touchTracker.current.touchDown(touchId, keyIndex)) pressKey(key, keyIndex)
        continue
      }
      const moved = touchTracker.current.touchMove(touchId, keyIndex)
      if (!moved) continue
      if (moved.releasedLast) releaseKey(moved.releasedKey)
      if (moved.pressedFirst) pressKey(keys[moved.pressedKey], moved.pressedKey)
    }
  }

  function stopPlayback() {
    playbackGen.current += 1
    timers.current.forEach(clearTimeout)
    timers.current = []
    stopHarmoniumSheetPlayback()
    setPlaying(false)
    stopsRef.current.forEach((stop) => stop())
    stopsRef.current.clear()
    touchTracker.current.reset()
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
    <View style={[layoutStyles.wrap, fullscreen && layoutStyles.wrapFullscreen]}>
      {!fullscreen && keyboardOnly && !captureMode ? (
        <>
          <Text style={styles.eyebrow}>Line capture</Text>
          <Text style={styles.title}>Virtual harmonium</Text>
          <Text style={styles.lead}>Hold keys to record · Sa below</Text>
        </>
      ) : !fullscreen ? (
        <>
          <Text style={styles.eyebrow}>{captureMode ? "Capture studio" : "Classic harmonium"}</Text>
          <Text style={styles.title}>{captureMode ? "Real reed samples" : "Two-octave keyboard"}</Text>
          <Text style={styles.lead}>
            {captureMode
              ? "Drone, bellows, coupler, and glissando — same reed engine as learner practice"
              : "Hold keys to sustain, like bellows feeding the reeds. Play more than one key at a time."}
          </Text>
        </>
      ) : null}

      {onTonicChange ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tonicRow, fullscreen && styles.tonicRowFullscreen]}
        >
          {HARMONIUM_TONICS.map((value) => (
            <Pressable
              key={value}
              onPress={() => onTonicChange(value)}
              style={[styles.tonicChip, fullscreen && styles.tonicChipFullscreen, tonic === value && styles.tonicActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: tonic === value }}
            >
              <Text style={[styles.tonicText, fullscreen && styles.tonicTextFullscreen, tonic === value && styles.tonicTextActive]}>
                Sa {value}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={[styles.tonicLabel, fullscreen && styles.tonicLabelFullscreen]}>Sa = {tonic}</Text>
      )}

      {showPlayerTools ? (
        <>
          {!fullscreen ? <Text style={styles.inputLabel}>Voice</Text> : null}
          <HarmoniumTuningBar
            compact={fullscreen || captureMode}
            bellows={bellows}
            onBellowsChange={setBellows}
            fineTune={fineTune}
            onFineTuneChange={setFineTune}
            droneOn={droneOn}
            onDroneToggle={() => setDroneOn((current) => !current)}
            couplerOn={couplerOn}
            onCouplerToggle={() => setCouplerOn((current) => !current)}
            metronomeOn={metronomeOn}
            onMetronomeToggle={() => setMetronomeOn((current) => !current)}
            metronomeBpm={metronomeOn ? harmoniumMetronomeBpm() || tempoPreset.bpm : tempoPreset.bpm}
            keyboardZoom={keyboardZoom}
            onKeyboardZoomChange={setKeyboardZoom}
            showZoom={fullscreen || captureMode}
          />
          <View style={[styles.tempoRow, fullscreen && styles.compactRow]}>
            {HARMONIUM_VOICE_REGISTERS.map((register) => (
              <Pressable
                key={register.id}
                onPress={() => setVoiceRegister(register.id)}
                style={[
                  styles.tonicChip,
                  fullscreen && styles.tonicChipFullscreen,
                  voiceRegister === register.id && styles.tonicActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: voiceRegister === register.id }}
                accessibilityLabel={register.label}
              >
                <Text
                  style={[
                    styles.tonicText,
                    fullscreen && styles.tonicTextFullscreen,
                    voiceRegister === register.id && styles.tonicTextActive,
                  ]}
                >
                  {register.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {fullscreen && captureMode ? (
            <View style={[styles.tempoRow, styles.compactRow]}>
              {HARMONIUM_PLAY_TEMPO_ORDER.map((id) => (
                <Pressable
                  key={id}
                  onPress={() => setTempo(id)}
                  style={[
                    styles.tonicChip,
                    fullscreen && styles.tonicChipFullscreen,
                    tempo === id && styles.tonicActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tempo === id }}
                  accessibilityLabel={HARMONIUM_PLAY_TEMPOS[id].label}
                >
                  <Text
                    style={[
                      styles.tonicText,
                      fullscreen && styles.tonicTextFullscreen,
                      tempo === id && styles.tonicTextActive,
                    ]}
                  >
                    {HARMONIUM_PLAY_TEMPOS[id].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {!fullscreen ? (
        <Text style={styles.keyHint}>
          Auto-play lights keys in amber. PS 1–2 use middle octave; black keys light for komal swaras.
        </Text>
      ) : null}
      <View
        style={fullscreen ? layoutStyles.keyboardHost : undefined}
        onLayout={
          fullscreen
            ? (event) => {
                const { width, height } = event.nativeEvent.layout
                if (width < 1 || height < 1) return
                setKeyboardArea((current) =>
                  Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
                    ? current
                    : { width, height },
                )
              }
            : undefined
        }
      >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!fullscreen && !captureMode}
        style={fullscreen ? layoutStyles.keyboardScroll : undefined}
        contentContainerStyle={fullscreen ? layoutStyles.keyboardScrollContent : undefined}
        keyboardShouldPersistTaps="always"
      >
        <View
          style={[layoutStyles.keyboard, { width: keyboardWidth, height: keyboardHeight }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onTouchStart={(event) => processKeyboardTouches(event, "start")}
          onTouchMove={(event) => processKeyboardTouches(event, "move")}
          onTouchEnd={(event) => processKeyboardTouches(event, "end")}
          onTouchCancel={(event) => processKeyboardTouches(event, "end")}
        >
          <View style={styles.whiteRow} pointerEvents="none">
            {whiteKeys.map((key) => {
              const index = keys.indexOf(key)
              const active = activeIndexes.has(index) || playbackIndex === index
              return (
                <View
                  key={key.western}
                  style={[
                    styles.whiteKey,
                    fullscreen && styles.whiteKeyFullscreen,
                    active && styles.keyActive,
                    key.isSa && styles.saKey,
                  ]}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`${key.latin} ${key.keyLabel}`}
                  accessibilityState={{ selected: active }}
                >
                  {key.isSa ? <View style={[styles.saDot, fullscreen && styles.saDotFullscreen]} /> : null}
                  <Text style={[styles.keyDevanagari, { fontSize: keyDevanagariSize }]} pointerEvents="none">
                    {key.devanagari}
                  </Text>
                  <Text
                    style={[styles.keyLatin, keyLatinSize ? { fontSize: keyLatinSize } : null]}
                    pointerEvents="none"
                  >
                    {key.latin}
                  </Text>
                </View>
              )
            })}
          </View>
          {blackKeys.map((key) => {
            const index = keys.indexOf(key)
            const active = activeIndexes.has(index) || playbackIndex === index
            return (
              <View
                key={key.western}
                pointerEvents="none"
                style={[
                  styles.blackKey,
                  fullscreen && styles.blackKeyFullscreen,
                  {
                    left: `${key.blackLeftPercent}%`,
                    width: blackKeyWidth,
                    height: blackKeyHeight,
                    marginLeft: -blackKeyWidth / 2,
                  },
                  active && styles.blackKeyActive,
                ]}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${key.latin} ${key.keyLabel}`}
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.blackLabel, fullscreen && { fontSize: Math.max(10, keyLatinSize ?? 10) }]}
                  pointerEvents="none"
                >
                  {key.devanagari}
                </Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
      </View>

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

      {showPlayerTools && !fullscreen ? (
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
  tonicRowFullscreen: { gap: spacing.xs, paddingVertical: 0 },
  tempoRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
  tonicChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  tonicChipFullscreen: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minHeight: 28,
    justifyContent: "center",
  },
  tonicActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tonicText: { ...typography.caption, color: colors.textPrimary },
  tonicTextFullscreen: { fontSize: 11, lineHeight: 14 },
  tonicTextActive: { color: colors.primaryDark, fontFamily: "Inter_600SemiBold" },
  tonicLabel: { ...typography.caption, color: colors.playerMuted },
  tonicLabelFullscreen: { fontSize: 11, lineHeight: 14, marginBottom: 2 },
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
  whiteKeyFullscreen: { paddingBottom: spacing.md, minWidth: 48 },
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
  saDotFullscreen: { top: 10, width: 10, height: 10, borderRadius: 5 },
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
  blackKeyFullscreen: {},
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
  compactRow: { paddingVertical: 0 },
  keyboardScroll: { flexGrow: 0 },
})

const fullscreenStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.playerBackground,
    padding: spacing.xs,
    gap: 4,
  },
  wrapFullscreen: {},
  keyboardHost: { flex: 1, minHeight: 180 },
  keyboardScroll: { flex: 1 },
  keyboardScrollContent: { flexGrow: 1, justifyContent: "flex-end" },
  keyboard: { position: "relative", alignSelf: "stretch" },
})
