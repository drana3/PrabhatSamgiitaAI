import { useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ChoiceSheet } from "@/components/kirtan/sets/ChoiceSheet"
import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { eventYears, monthsOf } from "@/lib/kirtan/setDate"

/**
 * "When was it?": the approximate date of an event, all optional: a YEAR and, once there is a year, a MONTH ("not known" is
 * fine), each chosen from a sheet. No days. Holds no state beyond which sheet is open: the caller passes the value and takes the change.
 */

type Props = { theme: SongsTheme; year: number | null; month: number | null; onYear: (year: number | null) => void; onMonth: (month: number | null) => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }

export function EventDateField({ theme, year, month, onYear, onMonth, invalid, errorText, disabled }: Props) {
  const t = useT()
  const [open, setOpen] = useState<"year" | "month" | null>(null)
  const monthName = (m: number) => (t as (key: string) => string)(`set.month.${m}`)
  const years = useMemo(() => eventYears().map((y) => ({ key: String(y), label: String(y) })), [])
  const months = useMemo(() => monthsOf(year).map((m) => ({ key: String(m), label: monthName(m) })), [year]) // eslint-disable-line react-hooks/exhaustive-deps
  const box = (label: string, text: string, chosen: boolean, which: "year" | "month", bad: boolean, blocked: boolean) => (
    <View style={styles.col}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textHeading }]}>{label}</Text>
        <RequiredMark theme={theme} required={false} invalid={bad} />
      </View>
      <KPress
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}`}
        accessibilityState={{ disabled: !!disabled || blocked }}
        onPress={() => !disabled && !blocked && setOpen(which)}
        pressedScale={0.99}
        style={[styles.box, { backgroundColor: theme.card, borderColor: bad ? amColors.danger : theme.line, opacity: blocked ? 0.5 : 1 }]}
      >
        <Text style={[styles.boxText, { color: chosen ? theme.textHeading : theme.textBody }]} numberOfLines={1}>
          {text}
        </Text>
      </KPress>
    </View>
  )
  return (
    <View style={styles.field}>
      <Text style={[styles.title, { color: theme.textHeading }]}>{t("set.d.when")}</Text>
      <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.d.whenHint")}</Text>
      <View style={styles.row}>
        {box(t("set.d.year"), year ? String(year) : t("set.d.yearNone"), year !== null, "year", !!invalid, false)}
        {box(t("set.d.month"), month ? monthName(month) : t("set.d.monthNone"), month !== null, "month", false, year === null)}
      </View>
      <FieldError theme={theme} text={errorText ?? null} />
      <ChoiceSheet visible={open === "year"} title={t("set.d.yearTitle")} choices={years} value={year ? String(year) : null} clearLabel={t("set.d.yearNone")} onPick={(key) => { setOpen(null); onYear(key ? Number(key) : null) }} onClose={() => setOpen(null)} />
      <ChoiceSheet visible={open === "month"} title={t("set.d.monthTitle")} choices={months} value={month ? String(month) : null} clearLabel={t("set.d.monthNone")} onPick={(key) => { setOpen(null); onMonth(key ? Number(key) : null) }} onClose={() => setOpen(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  title: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  col: { flex: 1, gap: 8, minWidth: 0 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  label: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  box: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center" },
  boxText: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
})
