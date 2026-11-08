import { StyleSheet, Text, View } from "react-native"

import { Sheet } from "@/components/player-v2/Sheet"
import { CheckRing, SheetGroup, SheetNote, SheetRow } from "@/components/player-v2/Rows"
import { PressScale } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { SPEED_FINE_STEP, SPEED_MAX, SPEED_MIN, SPEED_STEPS, clampRate, formatRateSign, stepRate } from "@/lib/playerV2/playbackSpeed"
import { useT } from "@/lib/i18n"

type Props = {
  visible: boolean
  theme: AmTheme
  rate: number
  onRate: (rate: number) => void
  keepPitch: boolean
  onKeepPitch: (keep: boolean) => void
  /** this recording has a speed of its own saved */
  remembered: boolean
  onRemember: (on: boolean) => void
  defaultRate: number
  onMakeDefault: () => void
  onClose: () => void
}

/**
 * Speed from 0.5x to 2x: a - and + button (0.05 per tap),
 * the quick choices, "keep the pitch", "remember for this recording" and "use for all recordings".
 * The engine keeps the tone at any speed by default; semitone steps need another engine (docs/playback-controls.md).
 */
export function SpeedSheet(props: Props) {
  const t = useT()
  const { theme, rate } = props
  const value = clampRate(rate)
  const nudge = (delta: number) => props.onRate(stepRate(value, delta))
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title={t("playback.speed.title")} theme={theme}>
      <View style={styles.hero}>
        <PlusMinus theme={theme} label={t("playback.speed.slower")} glyph="−" disabled={value <= SPEED_MIN} onPress={() => nudge(-SPEED_FINE_STEP)} />
        <View style={styles.valueBox}>
          <Text style={[styles.value, { color: theme.textHeading }]} accessibilityLiveRegion="polite">
            {formatRateSign(value)}
          </Text>
          <Text style={[styles.valueMeta, { color: theme.textBody }]}>{t("playback.speed.meta")}</Text>
        </View>
        <PlusMinus theme={theme} label={t("playback.speed.faster")} glyph="+" disabled={value >= SPEED_MAX} onPress={() => nudge(SPEED_FINE_STEP)} />
      </View>

      <View style={styles.chips}>
        {SPEED_STEPS.map((step) => {
          const on = Math.abs(step - value) < 1e-9
          return (
            <PressScale
              key={step}
              accessibilityRole="button"
              accessibilityLabel={formatRateSign(step)}
              accessibilityState={{ selected: on }}
              onPress={() => props.onRate(step)}
              pressedScale={0.94}
              style={[styles.chip, { borderColor: on ? amColors.orange500 : theme.line, backgroundColor: on ? amColors.orange700 : theme.card }]}
            >
              <Text style={[styles.chipText, { color: on ? amColors.white : theme.textHeading }]}>{formatRateSign(step)}</Text>
            </PressScale>
          )
        })}
      </View>

      <SheetGroup theme={theme}>
        <SheetRow
          theme={theme}
          title={t("playback.speed.keepPitch")}
          meta={t("playback.speed.keepPitch.sub")}
          accessibilityRole="checkbox"
          selected={props.keepPitch}
          trailing={<CheckRing theme={theme} on={props.keepPitch} />}
          onPress={() => props.onKeepPitch(!props.keepPitch)}
        />
        <SheetRow
          theme={theme}
          title={t("playback.speed.remember")}
          meta={t("playback.speed.remember.sub")}
          accessibilityRole="checkbox"
          selected={props.remembered}
          trailing={<CheckRing theme={theme} on={props.remembered} />}
          onPress={() => props.onRemember(!props.remembered)}
        />
        <SheetRow
          theme={theme}
          title={t("playback.speed.default")}
          meta={t("playback.speed.default.sub", { rate: formatRateSign(props.defaultRate) })}
          onPress={props.onMakeDefault}
          last
        />
      </SheetGroup>
      <SheetNote theme={theme}>{t("playback.speed.pitchNote")}</SheetNote>
    </Sheet>
  )
}

function PlusMinus({ theme, glyph, label, disabled, onPress }: { theme: AmTheme; glyph: string; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.92}
      style={[styles.round, { borderColor: theme.line, backgroundColor: theme.card }, disabled && styles.dim]}
    >
      <Text style={[styles.glyph, { color: theme.textHeading }]}>{glyph}</Text>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 16 },
  valueBox: { alignItems: "center", flex: 1 },
  value: { fontFamily: amFonts.display, fontSize: 48, lineHeight: 52 },
  valueMeta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  round: { width: 56, height: 56, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  glyph: { fontFamily: amFonts.bold, fontSize: 28, lineHeight: 32 },
  dim: { opacity: 0.35 },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 16 },
  chip: { minHeight: 44, minWidth: 56, paddingHorizontal: 12, borderRadius: amRadius.pill, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 15 },
})
