import { StyleSheet, Text, View } from "react-native"
import { ChevronRight, Lock } from "lucide-react-native"

import { GreenPanel } from "@/components/learn-v2/GreenPanel"
import { PressBox } from "@/components/learn-v2/PressBox"
import { Overline, PillButton, ProgressBar, StepDots } from "@/components/learn-v2/ui"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import type { LevelStatus } from "@/lib/learn/quiz"
import type { LearnProgress, PracticeSummary, SongLibraryState } from "@/lib/learn/progress"
import type { LearnWord } from "@/lib/learn/words"

type ThemeProps = { theme: AmTheme }

const ON_GREEN_BODY = "rgba(255, 255, 255, 0.86)"

/** Slim strip under the tabs (SCR-40): songs learned, learning now, words learned. */
export function StatsStrip({
  theme,
  learned,
  total,
  learning,
  words,
}: ThemeProps & { learned: number; total: number; learning: number; words: number }) {
  return (
    <View
      accessibilityLabel={`${learned} of ${total} songs learned, ${learning} learning now, ${words} words learned`}
      style={[styles.strip, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <StripCell value={`${learned}/${total}`} label="Songs learned" color={amColors.sage700} theme={theme} />
      <View style={[styles.stripRule, { backgroundColor: theme.line }]} />
      <StripCell value={String(learning)} label="Learning now" color={theme.eyebrow} theme={theme} />
      <View style={[styles.stripRule, { backgroundColor: theme.line }]} />
      <StripCell value={String(words)} label="Words learned" color={theme.textHeading} theme={theme} />
    </View>
  )
}

function StripCell({ value, label, color, theme }: ThemeProps & { value: string; label: string; color: string }) {
  return (
    <View style={styles.stripCell}>
      <Text style={[styles.stripValue, { color }]}>{value}</Text>
      <Text style={[styles.stripLabel, { color: theme.textBody }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

/** "Your progress": level name, bar, one line of counts, Continue with words. */
export function ProgressCard({
  theme,
  levelLabel,
  progress,
  line,
  onContinue,
  onQuiz,
}: ThemeProps & {
  levelLabel: string
  progress: LearnProgress
  line: string
  onContinue: () => void
  onQuiz: () => void
}) {
  return (
    <GreenPanel>
      <Overline color={amColors.gold300}>Your progress · {levelLabel}</Overline>
      <ProgressBar value={progress.fraction} trackColor="rgba(255,255,255,0.18)" fillColor={amColors.orange500} height={10} />
      <Text style={[amType.lead, { color: amColors.white }]}>{line}</Text>
      <View style={styles.buttonRow}>
        <PillButton theme={theme} label="Continue with words" onPress={onContinue} />
        <PillButton theme={theme} label="Take the quiz" onPress={onQuiz} variant="light" />
      </View>
    </GreenPanel>
  )
}

/** "Today's practice": one Start practice button for the due word cards. */
export function PracticeCard({
  theme,
  summary,
  onStart,
}: ThemeProps & { summary: PracticeSummary; onStart: () => void }) {
  return (
    <GreenPanel>
      <Overline color={amColors.gold300}>Today's practice</Overline>
      <Text style={[amType.title, { color: amColors.white }]}>{summary.headline}</Text>
      <Text style={[amType.body, { color: ON_GREEN_BODY }]}>{summary.detail}</Text>
      <PillButton theme={theme} label="Start practice" onPress={onStart} style={styles.selfStart} />
    </GreenPanel>
  )
}

/** Word of the day in a peach card. */
export function WordOfDayCard({
  theme,
  word,
  practiseCount,
  onPractise,
}: ThemeProps & { word: LearnWord; practiseCount: number; onPractise: () => void }) {
  return (
    <View style={[styles.peach, { backgroundColor: amColors.tintPeach }]}>
      <Overline color={amColors.orange700}>Word of the day · PS {word.songNumber}</Overline>
      <Text style={[amType.title, { color: amColors.ink800 }]}>{word.roman}</Text>
      <Text style={[styles.devanagari, { color: amColors.ink600 }]}>{word.devanagari}</Text>
      <Text style={[amType.lead, { color: amColors.ink800 }]}>{word.meaning}</Text>
      <PillButton
        theme={theme}
        label={`Practise ${practiseCount} ${practiseCount === 1 ? "word" : "words"}`}
        onPress={onPractise}
        style={styles.selfStart}
      />
    </View>
  )
}

/** Harmonium card (peach): the keyboard and the chords explainer. */
export function HarmoniumCard({
  theme,
  onKeyboard,
  onChords,
}: ThemeProps & { onKeyboard: () => void; onChords: () => void }) {
  return (
    <View style={[styles.peach, { backgroundColor: amColors.tintPeach }]}>
      <Overline color={amColors.orange700}>Harmonium</Overline>
      <Text style={[amType.heading, styles.caps, { color: amColors.ink800 }]}>Find the swaras on the keys</Text>
      <View style={styles.buttonRow}>
        <PillButton theme={theme} label="Open keyboard" onPress={onKeyboard} />
        <PillButton theme={theme} label="How chords work" onPress={onChords} variant="light" />
      </View>
    </View>
  )
}

const STATE_COPY: Record<SongLibraryState, string> = {
  learned: "Learned",
  learning: "Learning",
  notStarted: "Not started",
}

/** One row of "My songs": number and state, title, three dots, one button. */
export function LibraryRow({
  theme,
  number,
  title,
  state,
  due,
  dots,
  note,
  ctaLabel,
  onOpen,
  onCta,
}: ThemeProps & {
  number: number
  title: string
  state: SongLibraryState
  due: boolean
  dots: readonly [boolean, boolean, boolean]
  note: string
  ctaLabel: string
  onOpen: () => void
  onCta: () => void
}) {
  return (
    <View style={[styles.libRow, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel={`PS ${number}, ${title}, ${due ? "due today" : STATE_COPY[state]}`}
        onPress={onOpen}
        outerStyle={styles.libMain}
        style={styles.libMainInner}
        pressedScale={0.985}
      >
        <Overline color={due ? theme.eyebrow : state === "learned" ? amColors.sage700 : theme.textBody}>
          PS {number} · {due ? "Due today" : STATE_COPY[state]}
        </Overline>
        <Text style={[styles.libTitle, { color: theme.textHeading }]} numberOfLines={2}>
          {title}
        </Text>
        <StepDots done={dots} onColor={theme.brand} offColor={theme.line} />
        <Text style={[amType.body, { color: theme.textBody, fontSize: 14, lineHeight: 19 }]}>{note}</Text>
      </PressBox>
      <PillButton
        theme={theme}
        label={ctaLabel}
        onPress={onCta}
        variant={due || state !== "learned" ? "brand" : "sand"}
        style={styles.libCta}
      />
    </View>
  )
}

/** A filter chip, 44px touch target. */
export function Chip({
  theme,
  label,
  on,
  onPress,
}: ThemeProps & { label: string; on: boolean; onPress: () => void }) {
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      pressedScale={0.96}
      outerStyle={styles.chipOuter}
      style={[
        styles.chip,
        { backgroundColor: on ? theme.textHeading : theme.card, borderColor: on ? theme.textHeading : theme.line },
      ]}
    >
      <Text style={[styles.chipText, { color: on ? theme.card : theme.textHeading }]}>{label}</Text>
    </PressBox>
  )
}

/** A white row that leads somewhere, or says in one line why it does not yet. */
export function ToolRow({
  theme,
  eyebrow,
  title,
  note,
  onPress,
}: ThemeProps & { eyebrow: string; title: string; note?: string; onPress?: () => void }) {
  const live = Boolean(onPress)
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}. ${title}${note ? `. ${note}` : ""}`}
      accessibilityState={{ disabled: !live }}
      disabled={!live}
      onPress={onPress}
      pressedScale={0.985}
      style={[styles.toolRow, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.toolCopy}>
        <Overline color={theme.eyebrow}>{eyebrow}</Overline>
        <Text style={[styles.libTitle, { color: theme.textHeading }]}>{title}</Text>
        {note ? <Text style={[amType.body, { color: theme.textBody, fontSize: 14, lineHeight: 19 }]}>{note}</Text> : null}
      </View>
      {live ? <ChevronRight size={20} color={theme.textBody} /> : null}
    </PressBox>
  )
}

/** Quiz level row. Locked levels are half opacity and say how to unlock them. */
export function QuizLevelRow({
  theme,
  status,
  best,
  onPress,
}: ThemeProps & { status: LevelStatus; best: string | null; onPress: () => void }) {
  const open = status.open
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={`Level ${status.level}, ${status.title}. ${open ? best ?? "Open" : status.unlockRule}`}
      accessibilityState={{ disabled: !open }}
      disabled={!open}
      onPress={onPress}
      pressedScale={0.985}
      style={[
        styles.toolRow,
        { backgroundColor: theme.card, borderColor: theme.line, opacity: open ? 1 : 0.5 },
      ]}
    >
      <View style={styles.toolCopy}>
        <Overline color={theme.eyebrow}>Level {status.level}</Overline>
        <Text style={[styles.libTitle, { color: theme.textHeading }]}>{status.title}</Text>
        <Text style={[amType.body, { color: theme.textBody, fontSize: 14, lineHeight: 19 }]}>
          {open ? best ?? "10 questions, pass mark 7" : status.unlockRule}
        </Text>
      </View>
      {open ? <ChevronRight size={20} color={theme.textBody} /> : <Lock size={18} color={theme.textBody} />}
    </PressBox>
  )
}

/** Plain sentence with a button, for an empty list. */
export function EmptyBlock({
  theme,
  title,
  text,
  actionLabel,
  onAction,
}: ThemeProps & { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Text style={[styles.libTitle, { color: theme.textHeading }]}>{title}</Text>
      <Text style={[amType.body, { color: theme.textBody }]}>{text}</Text>
      {actionLabel && onAction ? (
        <PillButton theme={theme} label={actionLabel} onPress={onAction} style={styles.selfStart} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.grid,
  },
  stripCell: { flex: 1, alignItems: "center", gap: 2 },
  stripRule: { width: 1, height: 36 },
  stripValue: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 28 },
  stripLabel: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16 },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: amGap.grid, marginTop: 6 },
  selfStart: { alignSelf: "flex-start", marginTop: 6 },
  peach: {
    borderRadius: amRadius.panel,
    padding: amGap.padPanel,
    gap: amGap.grid,
  },
  caps: { textTransform: "uppercase", fontFamily: amFonts.display },
  devanagari: { fontFamily: amFonts.devanagari, fontSize: 20, lineHeight: 28 },
  libRow: {
    borderRadius: amRadius.card,
    borderWidth: 1,
    padding: amGap.padCard,
    gap: amGap.grid,
  },
  libMain: { alignSelf: "stretch" },
  libMainInner: { gap: 6 },
  libTitle: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24 },
  libCta: { alignSelf: "flex-start" },
  chipOuter: { minHeight: amTouchTarget, justifyContent: "center" },
  chip: {
    minHeight: 40,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: amGap.grid,
    borderRadius: amRadius.card,
    borderWidth: 1,
    padding: amGap.padCard,
    minHeight: amTouchTarget,
  },
  toolCopy: { flex: 1, gap: 4 },
  empty: {
    borderRadius: amRadius.card,
    borderWidth: 1,
    padding: amGap.padCard,
    gap: amGap.grid,
  },
})
