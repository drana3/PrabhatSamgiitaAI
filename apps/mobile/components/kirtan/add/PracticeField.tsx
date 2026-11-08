import { StyleSheet, Text, View } from "react-native"

import { RequiredMark } from "@/components/kirtan/add/KindFields"
import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

/**
 * "This is an Avarta Kiirtan": the optional tick of a Kiirtan that is meant for the special practice (lib/kirtan/practice.ts).
 * One line of plain explanation sits under it. Holds no state. Renders nothing for any other kind. `compact` is the per-row
 * version (a small chip on a queue row, which overrides the tick of the whole queue).
 */
export function PracticeField({ theme, kind, on, onChange, disabled }: { theme: SongsTheme; kind: string; on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  const t = useT()
  if (kind !== "kiirtan") return null
  return (
    <View style={s.root}>
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]}>{t("practice.field")}</Text>
        <RequiredMark theme={theme} required={false} />
      </View>
      <KPress
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled: !!disabled }}
        accessibilityLabel={t("practice.field.check")}
        disabled={disabled}
        onActivate={() => onChange(!on)}
        pressedScale={0.99}
        style={s.check}
      >
        <View style={[s.box, { borderColor: on ? amColors.orange700 : theme.textBody, backgroundColor: on ? amColors.orange700 : "transparent" }]}>{on ? <PlayerIcon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}</View>
        <Text style={[s.checkText, { color: theme.textHeading }]}>{t("practice.field.check")}</Text>
      </KPress>
      <Text style={[s.hint, { color: theme.textBody }]}>{t("practice.field.hint")}</Text>
    </View>
  )
}

/** The per-row switch of a queue: marks (or unmarks) this one file, whatever the whole queue says. */
export function PracticeRowToggle({ theme, on, onChange, disabled }: { theme: SongsTheme; on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  const t = useT()
  return (
    <KPress
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      accessibilityLabel={t("practice.queue.mark")}
      disabled={disabled}
      onActivate={() => onChange(!on)}
      pressedScale={0.97}
      style={[s.chip, { backgroundColor: on ? theme.brand : theme.card, borderColor: on ? theme.brand : theme.line }]}
    >
      <Text style={[s.chipText, { color: on ? theme.onBrand : theme.textHeading }]}>{t("practice.avarta")}</Text>
    </KPress>
  )
}

const s = StyleSheet.create({
  root: { gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 4 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  chip: { minHeight: 36, alignSelf: "flex-start", paddingHorizontal: 14, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
})
