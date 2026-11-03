import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { ChordDiagram } from "@/components/song-v2/ChordDiagram"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"
import { fingeringFor } from "@/lib/songPage/chords"

/**
 * Small popover with the fretboard of the tapped chord letter. It grows from
 * 92% and fades in on a spring that starts from wherever it is; closing runs
 * the same path backwards. Reduced motion: a plain fade.
 */
export function ChordPopover({
  theme,
  shape,
  sounding,
  onClose,
}: {
  theme: AmTheme
  /** what the fingers play, or null when closed */
  shape: string | null
  sounding: string | null
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState<{ shape: string; sounding: string } | null>(null)
  const progress = useSharedValue(0)

  useEffect(() => {
    if (shape && sounding) {
      setShown({ shape, sounding })
      progress.value = reduce ? withTiming(1, { duration: 150 }) : withSpring(1, amSpring.default)
      return
    }
    cancelAnimation(progress)
    const finish = (done?: boolean) => {
      "worklet"
      if (done) runOnJS(setShown)(null)
    }
    progress.value = reduce ? withTiming(0, { duration: 150 }, finish) : withSpring(0, amSpring.default, finish)
  }, [shape, sounding, reduce, progress])

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reduce ? 1 : 0.92 + 0.08 * progress.value }],
  }))

  if (!shown) return null
  const hasDiagram = Boolean(fingeringFor(shown.shape))
  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close chord"
      />
      <Animated.View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }, style]}>
        <Text style={[styles.name, { color: theme.textHeading }]}>{shown.shape}</Text>
        {shown.shape !== shown.sounding ? (
          <Text style={[amType.body, { color: theme.textBody }]}>{`Sounds as ${shown.sounding}`}</Text>
        ) : null}
        {hasDiagram ? (
          <ChordDiagram theme={theme} chord={shown.shape} />
        ) : (
          <Text style={[amType.body, { color: theme.textBody }]}>No fingering chart for this chord yet.</Text>
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  card: {
    minWidth: 200,
    borderRadius: amRadius.panel,
    borderWidth: 1,
    padding: amSpace.s6,
    alignItems: "center",
    gap: amSpace.s2,
  },
  name: { fontFamily: amFonts.display, fontSize: amFontSize.heading },
})
