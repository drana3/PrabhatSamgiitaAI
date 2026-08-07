import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { SecondaryButton } from "@/components/common/SecondaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import { memberAuthAvailable } from "@/lib/memberAuth"
import {
  formatCountdown,
  type QuizEventStart,
  type QuizEventSubmitResult,
  type QuizEventSummary,
} from "@/lib/quizEvent"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

export default function QuizEventScreen() {
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const mode = useAuthStore((s) => s.mode)
  const [meta, setMeta] = useState<QuizEventSummary | null>(null)
  const [attempt, setAttempt] = useState<QuizEventStart | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<QuizEventSubmitResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(0)

  const loadMeta = useCallback(async () => {
    if (!slug || mode !== "signed_in" || !memberAuthAvailable()) return
    const value = (await api.fetchQuizEvent(String(slug))) as QuizEventSummary | null
    if (value) {
      setMeta(value)
      setSecondsRemaining(value.seconds_remaining ?? 0)
    }
  }, [mode, slug])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  useEffect(() => {
    if (!secondsRemaining) return
    const timer = setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [secondsRemaining])

  const current = attempt?.questions[index]
  const progressLabel = useMemo(() => {
    if (!attempt) return ""
    return `Question ${index + 1} of ${attempt.questions.length}`
  }, [attempt, index])

  const start = async () => {
    if (!slug) return
    if (mode !== "signed_in") {
      router.push(href("/signin"))
      return
    }
    if (!memberAuthAvailable()) {
      Alert.alert("Member sync needed", "Sign in with member sync enabled to join live quizzes.")
      return
    }
    setBusy(true)
    try {
      const started = (await api.startQuizEvent(String(slug))) as QuizEventStart | null
      if (!started?.questions?.length) {
        Alert.alert("Quiz unavailable", "This event may be closed or you may have already submitted.")
        return
      }
      setAttempt(started)
      setSecondsRemaining(started.seconds_remaining)
      setAnswers({})
      setIndex(0)
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!attempt || !slug) return
    const payload = attempt.questions.map((question) => ({
      question_id: question.id,
      selected_option_id: answers[question.id] || "",
    }))
    if (payload.some((item) => !item.selected_option_id)) {
      Alert.alert("Almost there", "Please answer every question before submitting.")
      return
    }
    setBusy(true)
    try {
      const submitted = (await api.submitQuizEvent(String(slug), payload)) as QuizEventSubmitResult | null
      if (!submitted) {
        Alert.alert("Submit failed", "Could not submit your answers. Please try again.")
        return
      }
      setResult(submitted)
      setAttempt(null)
      await loadMeta()
    } finally {
      setBusy(false)
    }
  }

  if (mode !== "signed_in") {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Sign in to join</Text>
        <Text style={styles.subtitle}>Live quiz events require a signed-in member account.</Text>
        <PrimaryButton label="Sign in" onPress={() => router.push(href("/signin"))} />
      </ScreenContainer>
    )
  }

  if (!meta && !result) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.primary} />
      </ScreenContainer>
    )
  }

  if (result) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>{meta?.title ?? "Quiz submitted"}</Text>
          <Text style={styles.score}>
            {result.score}/{result.total} correct
          </Text>
          <Text style={styles.subtitle}>
            {result.pending_verification
              ? "Your answers are recorded. Results will be verified after the deadline."
              : "Results are now final."}
          </Text>
          <PrimaryButton label="Back to home" onPress={() => router.replace(href("/"))} />
        </ScrollView>
      </ScreenContainer>
    )
  }

  if (!attempt) {
    return (
      <ScreenContainer>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{meta?.title}</Text>
        {meta?.description ? <Text style={styles.subtitle}>{meta.description}</Text> : null}
        <View style={styles.deadlineCard}>
          <Text style={styles.deadlineLabel}>Time remaining</Text>
          <Text style={styles.deadlineValue}>{formatCountdown(secondsRemaining)}</Text>
        </View>
        {meta?.has_submission ? (
          <Text style={styles.subtitle}>
            You already submitted this quiz{meta.score != null ? ` with ${meta.score}/10 correct` : ""}.
          </Text>
        ) : meta?.is_open ? (
          <PrimaryButton label={busy ? "Starting…" : "Start quiz"} onPress={() => void start()} />
        ) : (
          <Text style={styles.subtitle}>This quiz event is closed.</Text>
        )}
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <View style={styles.topRow}>
        <Pressable onPress={() => setAttempt(null)}>
          <Text style={styles.back}>Exit</Text>
        </Pressable>
        <Text style={styles.progress}>{progressLabel}</Text>
        <Text style={styles.timer}>{formatCountdown(secondsRemaining)}</Text>
      </View>
      {current ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.question}>{current.prompt}</Text>
          {current.options.map((option) => {
            const selected = answers[current.id] === option.id
            return (
              <Pressable
                key={option.id}
                onPress={() => setAnswers((state) => ({ ...state, [current.id]: option.id }))}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option.id.toUpperCase()}. {option.text}
                </Text>
              </Pressable>
            )
          })}
          <View style={styles.actions}>
            <SecondaryButton
              label="Previous"
              onPress={() => setIndex((value) => Math.max(0, value - 1))}
              fullWidth={false}
            />
            {index < attempt.questions.length - 1 ? (
              <PrimaryButton label="Next" onPress={() => setIndex((value) => value + 1)} />
            ) : (
              <PrimaryButton label={busy ? "Submitting…" : "Submit"} onPress={() => void submit()} />
            )}
          </View>
        </ScrollView>
      ) : null}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  back: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  score: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  deadlineCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  deadlineLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  deadlineValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  progress: {
    ...typography.caption,
    color: colors.textMuted,
  },
  timer: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  question: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  option: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
})
