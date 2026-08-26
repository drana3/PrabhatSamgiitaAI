import { useRef, useState } from "react"
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Audio } from "expo-av"
import {
  buildNotationSheetLine,
  formatTalaHeader,
  reedWavDataUri,
  sheetPlayEvents,
  westernToSampleStem,
  type SheetTala,
} from "@prabhat/core"
import type { NotationLine } from "@/lib/sargamDisplay"
import { HARMONIUM_SAMPLE_MODULES } from "@/lib/harmoniumSamples"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  songNumber: number
  line: NotationLine
  lineIndex: number
  tala?: SheetTala | null
  tempoBpm?: number | null
  expertVerified?: boolean
}

export function NotationMatraSheet({
  songNumber,
  line,
  lineIndex,
  tala,
  tempoBpm,
  expertVerified = false,
}: Props) {
  const sheet = buildNotationSheetLine(line, tala)
  const [playing, setPlaying] = useState(false)
  const soundsRef = useRef<Audio.Sound[]>([])

  if (!sheet.cells.length) return null

  const stopAll = async () => {
    const sounds = soundsRef.current
    soundsRef.current = []
    await Promise.all(
      sounds.map(async (sound) => {
        try {
          await sound.stopAsync()
          await sound.unloadAsync()
        } catch {
          /* ignore */
        }
      }),
    )
  }

  const playHarmonium = async () => {
    if (playing) {
      await stopAll()
      setPlaying(false)
      return
    }
    setPlaying(true)
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })
      const events = sheetPlayEvents(sheet.cells, 0.55, tempoBpm)
      const loaded: Audio.Sound[] = []
      const stopTimers: ReturnType<typeof setTimeout>[] = []

      for (const event of events) {
        const stem = westernToSampleStem(event.western)
        const moduleId = stem ? HARMONIUM_SAMPLE_MODULES[stem] : undefined
        const source = moduleId
          ? moduleId
          : { uri: reedWavDataUri(event.frequencyHz, Math.max(0.18, event.durationSec)) }
        const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: false, volume: 0.9 })
        loaded.push(sound)
      }
      soundsRef.current = loaded

      await Promise.all(
        loaded.map((sound, index) => {
          const event = events[index]
          if (!event) return Promise.resolve()
          const delay = Math.round(event.startSec * 1000)
          const playMs = Math.max(120, Math.round(event.durationSec * 1000))
          return new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              void sound.playAsync().then(() => {
                const stopTimer = setTimeout(() => {
                  void sound.stopAsync().catch(() => undefined)
                }, playMs)
                stopTimers.push(stopTimer)
                resolve()
              })
            }, delay)
            stopTimers.push(timer)
          })
        }),
      )
      const totalMs = Math.ceil(
        ((events[events.length - 1]?.startSec ?? 0) +
          (events[events.length - 1]?.durationSec ?? 0) +
          0.2) *
          1000,
      )
      setTimeout(() => {
        stopTimers.forEach((timer) => clearTimeout(timer))
        void stopAll().then(() => setPlaying(false))
      }, totalMs)
    } catch {
      await stopAll()
      setPlaying(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {formatTalaHeader(tala, songNumber)} · पंक्ति {lineIndex + 1}
          {expertVerified ? " · Expert" : ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play harmonium for line ${lineIndex + 1}`}
          onPress={() => void playHarmonium()}
          style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.playText}>{playing ? "Stop" : "▶ Harmonium"}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {sheet.cells.map((cell, index) => (
            <View
              key={`${sheet.lineNumber}-${index}`}
              style={[styles.cell, cell.barStart && index > 0 ? styles.barStart : styles.cellBorder]}
            >
              <Text style={styles.sargam}>{cell.sargam}</Text>
              <Text style={styles.lyric}>{cell.lyric}</Text>
              <Text style={styles.matra}>{cell.matra}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.legend}>
        ऊपर: सारगम · मध्य: अक्षर · नीचे: मात्रा (X = सम)
        {expertVerified ? " · reed samples" : ""}
      </Text>
    </View>
  )
}

export function ExpertSheetImage({ songNumber }: { songNumber: number }) {
  if (songNumber !== 4961) return null
  return (
    <View style={styles.scanWrap}>
      <Text style={styles.scanLabel}>Expert handwritten sheet</Text>
      <Image
        source={require("../../assets/notation/expert/4961.png")}
        style={styles.scanImage}
        resizeMode="contain"
        accessibilityLabel={`Expert notation scan for PS ${songNumber}`}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FBF7EF",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700",
    flex: 1,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  playBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.spiritualGold,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  playText: { ...typography.caption, color: colors.textPrimary, fontWeight: "700" },
  row: { flexDirection: "row", paddingVertical: spacing.sm },
  cell: {
    minWidth: 42,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  cellBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  barStart: { borderLeftWidth: 2, borderLeftColor: colors.textPrimary },
  sargam: { ...typography.label, color: colors.textPrimary, fontWeight: "700", minHeight: 22 },
  lyric: { ...typography.caption, color: colors.textPrimary, minHeight: 18, marginTop: 4 },
  matra: { ...typography.caption, color: colors.textMuted, fontWeight: "700", marginTop: 4 },
  legend: {
    ...typography.caption,
    color: colors.textMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  scanWrap: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  scanLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  scanImage: { width: "100%", height: 220, marginTop: spacing.xs },
})
