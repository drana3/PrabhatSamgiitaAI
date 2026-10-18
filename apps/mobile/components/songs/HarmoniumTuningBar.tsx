import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import Slider from "@react-native-community/slider"
import { Minus, Plus } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  compact?: boolean
  bellows: number
  onBellowsChange: (value: number) => void
  fineTune: number
  onFineTuneChange: (value: number) => void
  droneOn: boolean
  onDroneToggle: () => void
  couplerOn: boolean
  onCouplerToggle: () => void
  metronomeOn: boolean
  onMetronomeToggle: () => void
  metronomeBpm: number
  keyboardZoom: number
  onKeyboardZoomChange: (value: number) => void
  showZoom?: boolean
}

function chip(active: boolean, compact?: boolean) {
  return [styles.chip, compact && styles.chipCompact, active && styles.chipActive]
}

function chipText(active: boolean, compact?: boolean) {
  return [styles.chipText, compact && styles.chipTextCompact, active && styles.chipTextActive]
}

export function HarmoniumTuningBar({
  compact,
  bellows,
  onBellowsChange,
  fineTune,
  onFineTuneChange,
  droneOn,
  onDroneToggle,
  couplerOn,
  onCouplerToggle,
  metronomeOn,
  onMetronomeToggle,
  metronomeBpm,
  keyboardZoom,
  onKeyboardZoomChange,
  showZoom = false,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, compact && styles.rowCompact]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.sliderBlock, compact && styles.sliderBlockCompact]}>
        <Text style={styles.sliderLabel}>Bellows</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.15}
          maximumValue={1}
          step={0.01}
          value={bellows}
          onValueChange={onBellowsChange}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primaryDark}
          accessibilityLabel="Bellows volume"
        />
      </View>

      <View style={[styles.sliderBlock, compact && styles.sliderBlockCompact]}>
        <Text style={styles.sliderLabel}>Tune {fineTune > 0 ? `+${fineTune}` : fineTune}¢</Text>
        <Slider
          style={styles.slider}
          minimumValue={-50}
          maximumValue={50}
          step={1}
          value={fineTune}
          onValueChange={onFineTuneChange}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primaryDark}
          accessibilityLabel="Harmonium fine tune"
        />
      </View>

      <Pressable
        onPress={onDroneToggle}
        style={chip(droneOn, compact)}
        accessibilityRole="button"
        accessibilityState={{ selected: droneOn }}
        accessibilityLabel={droneOn ? "Turn off Sa Pa drone" : "Turn on Sa Pa drone"}
      >
        <Text style={chipText(droneOn, compact)}>{droneOn ? "Drone on" : "Drone"}</Text>
      </Pressable>

      <Pressable
        onPress={onCouplerToggle}
        style={chip(couplerOn, compact)}
        accessibilityRole="button"
        accessibilityState={{ selected: couplerOn }}
        accessibilityLabel={couplerOn ? "Turn off coupler" : "Turn on coupler"}
      >
        <Text style={chipText(couplerOn, compact)}>{couplerOn ? "Coupler on" : "Coupler"}</Text>
      </Pressable>

      <Pressable
        onPress={onMetronomeToggle}
        style={chip(metronomeOn, compact)}
        accessibilityRole="button"
        accessibilityState={{ selected: metronomeOn }}
        accessibilityLabel={metronomeOn ? "Stop metronome" : "Start metronome"}
      >
        <Text style={chipText(metronomeOn, compact)}>
          {metronomeOn ? `Metro ${metronomeBpm}` : "Metro"}
        </Text>
      </Pressable>

      {showZoom ? (
        <View style={styles.zoomRow}>
          <Pressable
            onPress={() => onKeyboardZoomChange(Math.max(0.75, Number((keyboardZoom - 0.08).toFixed(2))))}
            style={[styles.zoomBtn, compact && styles.zoomBtnCompact]}
            accessibilityRole="button"
            accessibilityLabel="Zoom out keyboard"
          >
            <Minus size={14} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.zoomLabel}>{Math.round(keyboardZoom * 100)}%</Text>
          <Pressable
            onPress={() => onKeyboardZoomChange(Math.min(1.35, Number((keyboardZoom + 0.08).toFixed(2))))}
            style={[styles.zoomBtn, compact && styles.zoomBtnCompact]}
            accessibilityRole="button"
            accessibilityLabel="Zoom in keyboard"
          >
            <Plus size={14} color={colors.textPrimary} />
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, alignItems: "center", paddingVertical: spacing.xs },
  rowCompact: { gap: spacing.xs, paddingVertical: 0 },
  sliderBlock: { width: 132, gap: 2 },
  sliderBlockCompact: { width: 108 },
  sliderLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 10, lineHeight: 12 },
  slider: { width: "100%", height: 28 },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    justifyContent: "center",
  },
  chipCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 32,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textPrimary, fontFamily: "Inter_600SemiBold" },
  chipTextCompact: { fontSize: 11, lineHeight: 14 },
  chipTextActive: { color: colors.primaryDark },
  zoomRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  zoomBtnCompact: { width: 28, height: 28 },
  zoomLabel: { ...typography.caption, color: colors.textSecondary, minWidth: 38, textAlign: "center" },
})
