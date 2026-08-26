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
  SARGAM_EXAMPLES,
  harmoniumKeyboardLayout,
  parseSargamInput,
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const keys = useMemo(() => harmoniumKeyboardLayout(tonic), [tonic])
  const parsedPreview = useMemo(() => parseSargamInput(typed, tonic), [typed, tonic])

  useEffect(() => {
    return () => {
      stopRef.current?.()
      void stopActiveHarmoniumNote()
    }
  }, [])

  async function pressKey(key: HarmoniumKeyboardKey | undefined, index: number) {
    if (!key) return
    setActiveIndex(index)
    stopRef.current?.()
    stopRef.current = await startWesternNote(key.western)
  }

  function releaseKey(index: number) {
    if (activeIndex !== index) return
    stopRef.current?.()
    stopRef.current = null
    void stopActiveHarmoniumNote()
    setActiveIndex(null)
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

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Live harmonium</Text>
      <Text style={styles.title}>Tap keys or type sargam</Text>
      <Text style={styles.lead}>Hold a key to sustain · Type Sa Re Ga Ma or सा रे ग म</Text>

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.keyboardRow}>
        {keys.map((key, index) => {
          const active = activeIndex === index
          return (
            <Pressable
              key={`${key.western}-${index}`}
              onPressIn={() => void pressKey(key, index)}
              onPressOut={() => releaseKey(index)}
              style={[styles.key, active && styles.keyActive]}
              accessibilityRole="button"
              accessibilityLabel={`${key.latin} ${key.keyLabel}`}
            >
              <Text style={styles.keyLabel}>{key.keyLabel}</Text>
              <Text style={styles.keyDevanagari}>{key.devanagari}</Text>
              <Text style={styles.keyLatin}>{key.latin}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

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
  keyboardRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  key: {
    minWidth: 52,
    minHeight: 112,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  keyActive: {
    backgroundColor: colors.primaryLight,
    transform: [{ translateY: 2 }],
  },
  keyLabel: {
    ...typography.caption,
    position: "absolute",
    top: spacing.sm,
    backgroundColor: colors.textPrimary,
    color: colors.white,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: "hidden",
    fontFamily: "Inter_600SemiBold",
  },
  keyDevanagari: { fontSize: 18, color: colors.textPrimary, fontFamily: "SourceSerif4_600SemiBold" },
  keyLatin: { ...typography.caption, color: colors.textSecondary },
  inputLabel: {
    ...typography.caption,
    color: colors.spiritualGold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.xs,
    fontFamily: "Inter_600SemiBold",
  },
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
