import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"

import { CardText, CardTitle, LCard, Meter, Over, Pill, StepBars, toneOf } from "@/components/learn-v2/ui"
import { PressBox } from "@/components/learn-v2/PressBox"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

/** The emblem of the prototype's `.logo` (36px high). */
export function LearnLogo() {
  return (
    <Image
      source={require("../../assets/learn-mark.png")}
      style={styles.logo}
      contentFit="contain"
      accessibilityLabel="Ananda Marga"
    />
  )
}

/** `.sstrip`: three numbers in one white 72px strip (songs learned, learning now, words learned). */
export function StatsStrip({
  theme,
  learned,
  total,
  learning,
  words,
}: {
  theme: AmTheme
  learned: number
  total: number
  learning: number
  words: number
}) {
  const tone = toneOf(theme)
  const cells: Array<{ key: string; value: string; suffix?: string; label: string; color: string }> = [
    { key: "learned", value: String(learned), suffix: `/${total}`, label: "Songs learned", color: tone.dark ? amColors.sage300 : amColors.sage700 },
    { key: "learning", value: String(learning), label: "Learning now", color: theme.eyebrow },
    { key: "words", value: String(words), label: "Words learned", color: tone.ink900 },
  ]
  return (
    <View accessibilityLabel="Your songs in numbers" style={[styles.strip, { backgroundColor: theme.card, borderColor: theme.line }]}>
      {cells.map((cell, index) => (
        <View
          key={cell.key}
          style={[styles.cell, index > 0 && { borderLeftWidth: 1, borderLeftColor: theme.line }]}
          accessible
          accessibilityLabel={`${cell.label}: ${cell.value}${cell.suffix ? ` of ${total}` : ""}`}
        >
          <Text style={[styles.stripNumber, { color: cell.color }]}>
            {cell.value}
            {cell.suffix ? <Text style={[styles.stripSuffix, { color: tone.ink300 }]}>{cell.suffix}</Text> : null}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.stripLabel, { color: theme.textBody }]}>
            {cell.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

export type LibraryRowData = {
  number: number
  title: string
  learned: boolean
  due: boolean
  strength?: number
  steps: readonly [boolean, boolean, boolean]
  note: string
}

/** `.card.cardbtn.lib`: song number and state, title, meter or step bars, a note, and a small button. */
export function LibraryRow({
  theme,
  row,
  onOpen,
  onCta,
}: {
  theme: AmTheme
  row: LibraryRowData
  onOpen: () => void
  onCta?: () => void
}) {
  const t = useT()
  const state = row.learned ? (row.due ? t("learn.state.dueToday") : t("learn.state.learned")) : t("learn.state.learning")
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel={`PS ${row.number}, ${row.title}, ${state}`}
        onPress={onOpen}
        pressedScale={0.98}
        outerStyle={styles.main}
      >
        <View style={styles.mainInner}>
          <Over color={theme.eyebrow} numeric>
            {`PS ${row.number} · ${state}`}
          </Over>
          <Text style={[styles.title, { color: theme.textHeading }]}>{row.title}</Text>
          {row.learned && row.strength !== undefined ? <Meter theme={theme} strength={row.strength} /> : <StepBars theme={theme} done={row.steps} />}
          {row.note ? <Text style={[styles.note, { color: theme.textBody }]}>{row.note}</Text> : null}
        </View>
      </PressBox>
      {onCta ? (
        <Pill theme={theme} small variant={row.due ? "brand" : "sand"} label={row.learned ? t("learn.row.repeat") : t("learn.row.continue")} onPress={onCta} />
      ) : null}
    </View>
  )
}

/** An empty or locked state: a white card with an eyebrow, a title, one line and one button. */
export function EmptyCard({
  theme,
  eyebrow,
  title,
  text,
  action,
  onAction,
}: {
  theme: AmTheme
  eyebrow: string
  title: string
  text: string
  action: string
  onAction: () => void
}) {
  return (
    <LCard theme={theme} tone="white">
      {(c) => (
        <>
          <Over color={c.over}>{eyebrow}</Over>
          <CardTitle color={c.text}>{title}</CardTitle>
          <CardText color={c.body}>{text}</CardText>
          <Pill theme={theme} go label={action} onPress={onAction} />
        </>
      )}
    </LCard>
  )
}

const styles = StyleSheet.create({
  logo: { height: 36, width: 30 },
  strip: { flexDirection: "row", marginTop: 12, height: 72, borderRadius: 30, borderWidth: 1, overflow: "hidden" },
  cell: { flex: 1, minWidth: 0, justifyContent: "center", gap: 3, paddingLeft: 14, paddingRight: 4 },
  stripNumber: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 28, height: 28, position: "relative", top: -1, letterSpacing: -0.84 },
  stripSuffix: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 28, letterSpacing: 0 },
  stripLabel: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 13, letterSpacing: 0.44, textTransform: "uppercase" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 16,
    borderRadius: 20,
    borderWidth: 1,
    width: "100%",
  },
  main: { flex: 1, minWidth: 0 },
  mainInner: { gap: 4 },
  title: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 18.2 },
})
