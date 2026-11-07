import { StyleSheet, Text, View } from "react-native"

import { PressBox } from "@/components/learn-v2/PressBox"
import { CardTitle, ICON_CHEVRON, Icon, Over, Pill, toneOf } from "@/components/learn-v2/ui"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { LearnWord } from "@/lib/learn/words"
import { GRADES, type Grade, type QueueCounts, type QueueKind } from "@/lib/learn/srs"

/** `.counts`: New, Learning and Due, the kind of the card on screen underlined. */
export function QueueCounters({ theme, counts, active }: { theme: AmTheme; counts: QueueCounts; active: QueueKind | null }) {
  const t = useT()
  const tone = toneOf(theme)
  const cells: Array<{ kind: QueueKind; value: number; label: string; color: string }> = [
    { kind: "new", value: counts.newCount, label: t("learn.cards.new"), color: theme.textHeading },
    { kind: "learning", value: counts.learningCount, label: t("learn.cards.learning"), color: theme.eyebrow },
    { kind: "due", value: counts.dueCount, label: t("learn.cards.due"), color: tone.dark ? "#B7D08F" : amColors.sage700 },
  ]
  return (
    <View accessibilityRole="summary" accessibilityLabel={t("learn.cards.waiting")} style={styles.counts}>
      {cells.map((cell) => (
        <View
          key={cell.kind}
          accessible
          accessibilityLabel={`${cell.value} ${cell.label}`}
          style={[styles.cn, active === cell.kind && { borderBottomColor: theme.textHeading }]}
        >
          <Text style={[styles.cnValue, { color: cell.color }]}>{cell.value}</Text>
          <Text style={[styles.cnLabel, { color: theme.textBody }]}>{cell.label}</Text>
        </View>
      ))}
    </View>
  )
}

/** `.srsbar`: "Review style  Simple steps  >" opens the sheet. */
export function ReviewStyleBar({ theme, name, onPress }: { theme: AmTheme; name: string; onPress: () => void }) {
  const t = useT()
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={t("learn.cards.reviewStyleA11y", { name })}
      onPress={onPress}
      pressedScale={0.98}
      style={styles.srsbar}
    >
      <Over color={theme.eyebrow}>{t("learn.cards.reviewStyle")}</Over>
      <Text style={[styles.srsName, { color: theme.textHeading }]}>{name}</Text>
      <View style={styles.srsChevron}>
        <Icon d={ICON_CHEVRON} size={16} color={theme.textBody} />
      </View>
    </PressBox>
  )
}

/** `.fcard`: forest card, the word on the front, the meaning under a line on the back. */
export function FlashCard({
  word,
  kindLabel,
  flipped,
  onShow,
}: {
  word: LearnWord
  kindLabel: string
  flipped: boolean
  onShow: () => void
}) {
  const t = useT()
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={flipped ? `${word.roman}, ${word.meaning}` : t("learn.cards.showAnswerA11y", { word: word.roman })}
      onPress={onShow}
      pressedScale={0.99}
      outerStyle={styles.fcardOuter}
      style={styles.fcard}
    >
      <Text style={styles.tap}>{kindLabel}</Text>
      <Text style={styles.big}>{word.roman}</Text>
      <Text style={styles.dv}>{word.devanagari}</Text>
      {flipped ? (
        <>
          <View style={styles.ansline} />
          <Text style={[styles.big, styles.ansText]}>{word.meaning}</Text>
          <Text style={styles.srcl}>{t("learn.cards.fromSong", { number: word.songNumber })}</Text>
        </>
      ) : null}
    </PressBox>
  )
}

/** `.answers`: four buttons, each with the time you will see the card again. */
export function GradeButtons({
  theme,
  intervals,
  onGrade,
}: {
  theme: AmTheme
  intervals: Record<Grade, string>
  onGrade: (grade: Grade) => void
}) {
  const t = useT()
  const tone = toneOf(theme)
  const look = (grade: Grade) => {
    switch (grade) {
      case "again":
        return { bg: tone.peach, fg: theme.dangerText, border: "transparent" }
      case "good":
        return { bg: theme.brand, fg: theme.onBrand, border: "transparent" }
      case "easy":
        return { bg: tone.dark ? "rgba(229,228,212,0.92)" : amColors.sage200, fg: amColors.sage900, border: "transparent" }
      default:
        return { bg: theme.card, fg: theme.textHeading, border: theme.line }
    }
  }
  return (
    <View style={styles.answers}>
      {GRADES.map((grade) => {
        const c = look(grade)
        return (
          <PressBox
            key={grade}
            accessibilityRole="button"
            accessibilityLabel={t("learn.cards.gradeA11y", { grade: t(`learn.cards.grade.${grade}`), delay: intervals[grade].startsWith("<") ? t("learn.cards.lessThan", { delay: intervals[grade].slice(1) }) : intervals[grade] })}
            onPress={() => onGrade(grade)}
            pressedScale={0.96}
            outerStyle={styles.abOuter}
            style={[styles.ab, { backgroundColor: c.bg, borderColor: c.border }]}
          >
            <Text style={[styles.abLabel, { color: c.fg }]}>{t(`learn.cards.grade.${grade}`)}</Text>
            <Text style={[styles.abTime, { color: c.fg }]}>{intervals[grade]}</Text>
          </PressBox>
        )
      })}
    </View>
  )
}

/** The "Done for today" card (`.lcard.dark`) and the Back button under it. */
export function DoneCard({
  theme,
  text,
  onAgain,
  onBack,
}: {
  theme: AmTheme
  text: string
  onAgain: () => void
  onBack: () => void
}) {
  const t = useT()
  return (
    <>
      <View style={styles.done}>
        <Over color={amColors.gold300}>{t("learn.cards.doneEyebrow")}</Over>
        <CardTitle color={amColors.white} size={28}>
          {t("learn.cards.doneTitle")}
        </CardTitle>
        <Text style={styles.doneText}>{text}</Text>
        <Pill theme={theme} go label={t("learn.cards.studyAgain")} onPress={onAgain} />
      </View>
      <Pill theme={theme} variant="sand" full label={t("common.back")} onPress={onBack} />
    </>
  )
}

const styles = StyleSheet.create({
  counts: { flexDirection: "row", gap: 14 },
  cn: { alignItems: "center", minWidth: 44, paddingBottom: 2, borderBottomWidth: 2, borderBottomColor: "transparent" },
  cnValue: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 24 },
  cnLabel: { fontFamily: amFonts.semi, fontSize: 11, lineHeight: 15, letterSpacing: 0.44, textTransform: "uppercase" },
  srsbar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 6, height: 36 },
  srsName: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  srsChevron: { marginLeft: "auto" },
  fcardOuter: { width: "100%" },
  fcard: {
    minHeight: 300,
    borderRadius: 30,
    backgroundColor: amColors.sage700,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    gap: 8,
    padding: 24,
    width: "100%",
  },
  tap: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", color: amColors.gold300 },
  big: { fontFamily: amFonts.display, fontSize: 44, lineHeight: 44, letterSpacing: -0.88, textTransform: "uppercase", color: amColors.white },
  dv: { fontFamily: amFonts.devanagari, fontSize: 26, lineHeight: 40, color: "rgba(255,255,255,0.82)" },
  ansline: { alignSelf: "stretch", height: 1, backgroundColor: "rgba(255,255,255,0.3)", marginTop: 8, marginBottom: 2 },
  ansText: { fontSize: 32, lineHeight: 32, letterSpacing: -0.64, color: amColors.gold300 },
  srcl: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 16, marginTop: 2, marginBottom: 2, color: "rgba(255,255,255,0.7)" },
  answers: { flexDirection: "row", gap: 8 },
  abOuter: { flex: 1 },
  ab: { height: 68, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  abLabel: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 18 },
  abTime: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 14, opacity: 0.75 },
  done: { padding: 25, borderRadius: 30, gap: 12, backgroundColor: amColors.sage900, overflow: "hidden", width: "100%" },
  doneText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 21.6, color: "rgba(255,255,255,0.82)", maxWidth: 252 },
})
