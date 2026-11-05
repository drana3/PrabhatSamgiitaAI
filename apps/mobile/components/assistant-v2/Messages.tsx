import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Markdown from "react-native-markdown-display"
import * as Clipboard from "expo-clipboard"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { BookOpen, Check, Copy, Info } from "lucide-react-native"

import { assistantMarkdownStyles } from "@/components/assistant-v2/markdownStyles"
import { PressScale, Reveal } from "@/components/today/motion"
import { amColors, amLight, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { type AnswerSource } from "@/lib/assistantAnswer"
import { useT } from "@/lib/i18n"

type ThemeProps = { theme: AmTheme }

/** Olive surface for notices; in the dark theme the inner surface stands in for it. */
export function noticeSurface(theme: AmTheme): string {
  return theme.page === amLight.page ? amColors.sage200 : theme.inner
}

/** The reader's question: an orange pill on the right, white text. */
export function QuestionPill({ theme, text, index }: ThemeProps & { text: string; index: number }) {
  return (
    <Reveal index={index} style={styles.questionWrap}>
      <View style={[styles.question, { backgroundColor: theme.brand }]}>
        <Text style={[styles.questionText, { color: theme.onBrand }]} selectable>
          {text}
        </Text>
      </View>
    </Reveal>
  )
}

/** Three dots that breathe while the first words are on their way. */
export function TypingDots({ theme }: ThemeProps) {
  const t = useT()
  const reduce = useReducedMotion()
  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel={t("assistant.typing")}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} color={theme.textMuted} index={i} still={Boolean(reduce)} />
      ))}
    </View>
  )
}

function Dot({ color, index, still }: { color: string; index: number; still: boolean }) {
  const opacity = useSharedValue(still ? 0.6 : 0.25)
  useEffect(() => {
    if (still) return
    opacity.value = withDelay(
      index * 160,
      withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0.25, { duration: 360 })), -1),
    )
  }, [index, opacity, still])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
}

function shortTitle(title: string): string {
  return title.length > 26 ? `${title.slice(0, 24).trim()}…` : title
}

function SourceChip({
  theme,
  source,
  title,
  onPress,
}: ThemeProps & { source: AnswerSource; title: string | null; onPress: () => void }) {
  const t = useT()
  const grounded = source.role === "grounded"
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${grounded ? t("assistant.source.grounded") : t("assistant.source.mentioned")}: PS ${source.number}${title ? `, ${title}` : ""}`}
      onPress={onPress}
      pressedScale={0.96}
      style={[
        styles.chip,
        {
          backgroundColor: grounded ? theme.inner : "transparent",
          borderColor: grounded ? theme.brand : theme.line,
        },
      ]}
    >
      <BookOpen size={16} color={theme.eyebrow} />
      <Text style={[styles.chipText, { color: theme.textHeading }]} numberOfLines={1}>
        PS {source.number}
        {grounded && title ? `  ${shortTitle(title)}` : ""}
      </Text>
    </PressScale>
  )
}

/**
 * A real answer. Every answer ends with the songs it can point to and the one
 * line that says it was written by AI. An answer with nothing to cite says so.
 */
export function AnswerCard({
  theme,
  index,
  text,
  sources,
  noSourceCaution,
  groundedTitle,
  onOpenSong,
}: ThemeProps & {
  index: number
  text: string
  sources: AnswerSource[]
  noSourceCaution: boolean
  groundedTitle: string | null
  onOpenSong: (number: number) => void
}) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text.trim())
      setCopied(true)
    } catch {
      /* clipboard can be unavailable; nothing to tell the reader */
    }
  }

  return (
    <Reveal index={index}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
        <Markdown style={assistantMarkdownStyles(theme)}>{text}</Markdown>

        {sources.length ? (
          <View style={styles.sources}>
            <Text style={[amType.label, { color: theme.eyebrow }]}>{t("assistant.sources")}</Text>
            <View style={styles.chips}>
              {sources.map((source) => (
                <SourceChip
                  key={`${source.role}-${source.number}`}
                  theme={theme}
                  source={source}
                  title={source.role === "grounded" ? groundedTitle : null}
                  onPress={() => onOpenSong(source.number)}
                />
              ))}
            </View>
          </View>
        ) : noSourceCaution ? (
          <View style={[styles.caution, { backgroundColor: noticeSurface(theme) }]}>
            <Info size={18} color={theme.eyebrow} />
            <Text style={[styles.cautionText, { color: theme.textHeading }]}>
              {t("assistant.noSource")}
            </Text>
          </View>
        ) : null}

        <View style={[styles.footer, { borderTopColor: theme.line }]}>
          <Text style={[styles.disclosure, { color: theme.textBody }]}>{t("assistant.disclosure")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copied ? t("assistant.copied") : t("assistant.copy")}
            onPress={copy}
            hitSlop={8}
            style={styles.copy}
          >
            {copied ? <Check size={18} color={theme.eyebrow} /> : <Copy size={18} color={theme.textBody} />}
          </Pressable>
        </View>
      </View>
    </Reveal>
  )
}

/**
 * A reply that is not an answer: a guard, a missing song, a network failure or
 * the daily limit. Olive, plain words, no sources, and a next step when there is one.
 */
export function NoticeCard({
  theme,
  index,
  text,
  help,
  actionLabel,
  onAction,
}: ThemeProps & {
  index: number
  text: string
  help?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <Reveal index={index}>
      <View style={[styles.notice, { backgroundColor: noticeSurface(theme) }]}>
        <Info size={20} color={theme.eyebrow} style={styles.noticeIcon} />
        <View style={styles.noticeBody}>
          <Text style={[styles.noticeText, { color: theme.textHeading }]} selectable>
            {text}
          </Text>
          {help ? <Text style={[styles.noticeHelp, { color: theme.textBody }]}>{help}</Text> : null}
          {actionLabel && onAction ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              onPress={onAction}
              style={[styles.action, { backgroundColor: theme.brand }]}
            >
              <Text style={[styles.actionText, { color: theme.onBrand }]}>{actionLabel}</Text>
            </PressScale>
          ) : null}
        </View>
      </View>
    </Reveal>
  )
}

/** Tappable starter question, a full-width white row. */
export function SuggestionRow({
  theme,
  label,
  onPress,
}: ThemeProps & { label: string; onPress: () => void }) {
  const t = useT()
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={t("assistant.suggestion", { label })}
      onPress={onPress}
      pressedScale={0.985}
      style={[styles.suggestion, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Text style={[styles.suggestionText, { color: theme.textHeading }]}>{label}</Text>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  questionWrap: { alignItems: "flex-end" },
  question: {
    maxWidth: "86%",
    borderRadius: amRadius.md,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  questionText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
  dots: { flexDirection: "row", gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { borderRadius: amRadius.card, borderWidth: 1, padding: amGap.padCard },
  sources: { gap: 10, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: amTouchTarget,
    maxWidth: "100%",
    borderRadius: amRadius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  chipText: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 14 },
  caution: { borderRadius: amRadius.sm, flexDirection: "row", gap: 10, padding: 12, marginTop: 4 },
  cautionText: { flex: 1, fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disclosure: { flex: 1, fontFamily: amFonts.regular, fontSize: 13, lineHeight: 18 },
  copy: { width: amTouchTarget, height: amTouchTarget, alignItems: "center", justifyContent: "center" },
  notice: { borderRadius: amRadius.card, flexDirection: "row", gap: 12, padding: amGap.padCard },
  noticeIcon: { marginTop: 2 },
  noticeBody: { flex: 1, gap: 8 },
  noticeText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
  noticeHelp: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  action: {
    alignSelf: "flex-start",
    height: 48,
    borderRadius: amRadius.pill,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  actionText: { fontFamily: amFonts.semi, fontSize: 16 },
  suggestion: {
    minHeight: 56,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    paddingVertical: 14,
    justifyContent: "center",
  },
  suggestionText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
})
