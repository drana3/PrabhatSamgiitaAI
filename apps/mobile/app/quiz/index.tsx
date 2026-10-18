import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Award, Check, Lock, X } from "lucide-react-native"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { SecondaryButton } from "@/components/common/SecondaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import { HOME_FEED_KEYS, writeHomeFeedCache } from "@/lib/homeFeedCache"
import { memberAuthAvailable } from "@/lib/memberAuth"
import {
  QUIZ_LEVEL_COPY,
  type QuizLevel,
  type QuizStart,
  type QuizStatus,
  type QuizSubmitResult,
} from "@/lib/quiz"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

const levels = (Object.keys(QUIZ_LEVEL_COPY) as QuizLevel[]).map((id) => ({
  id,
  title: QUIZ_LEVEL_COPY[id].title,
  detail: QUIZ_LEVEL_COPY[id].description,
}))

export default function QuizScreen() {
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const [selected, setSelected] = useState<QuizLevel>("starter")
  const [status, setStatus] = useState<QuizStatus | null>(null)
  const [attempt, setAttempt] = useState<QuizStart | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<QuizSubmitResult | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mode !== "signed_in" || !memberAuthAvailable()) return
    let active = true
    void api.fetchQuizStatus().then((value) => {
      if (active && value) setStatus(value as QuizStatus)
    })
    return () => {
      active = false
    }
  }, [mode])

  useFocusEffect(
    useCallback(() => {
      if (mode !== "signed_in" || !memberAuthAvailable()) return
      void api.fetchQuizStatus().then((value) => {
        if (value) setStatus(value as QuizStatus)
      })
    }, [mode]),
  )

  const current = attempt?.questions[index]
  const progressLabel = useMemo(() => {
    if (!attempt) return ""
    return `Question ${index + 1} of ${attempt.questions.length}`
  }, [attempt, index])

  const start = async () => {
    if (!memberAuthAvailable()) {
      Alert.alert(
        "Member sync needed",
        "The live quiz is not available on this build yet. Please try again after the team shares an updated app build.",
      )
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const started = (await api.startQuiz(selected)) as QuizStart | null
      if (!started?.questions?.length) {
        Alert.alert("Quiz unavailable", "Could not start the quiz. Please try again shortly.")
        return
      }
      setAttempt(started)
      setAnswers({})
      setIndex(0)
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!attempt) return
    const payload = {
      attempt_id: attempt.attempt_id,
      answers: attempt.questions.map((question) => ({
        question_id: question.id,
        selected_option_id: answers[question.id] || "",
      })),
    }
    if (payload.answers.some((item) => !item.selected_option_id)) {
      Alert.alert("Almost there", "Please answer every question before submitting.")
      return
    }
    setBusy(true)
    try {
      const submitted = (await api.submitQuiz(payload)) as QuizSubmitResult | null
      if (!submitted) {
        Alert.alert("Submit failed", "Could not grade this attempt. Please try again.")
        return
      }
      setResult(submitted)
      setAttempt(null)
      const refreshed = (await api.fetchQuizStatus()) as QuizStatus | null
      if (refreshed) {
        setStatus(refreshed)
        await writeHomeFeedCache(HOME_FEED_KEYS.quizStatus, refreshed)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenContainer edges={["top"]} padded={false} title="Quiz" subtitle="Certificates">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Award size={22} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Walk with the songs</Text>
          <Text style={styles.heroSub}>
            A calm, member-only journey across three levels. Pass at 70% to earn a certificate —
            same experience as the website Quiz.
          </Text>
        </View>

        {mode === "guest" ? (
          <View style={styles.lockCard}>
            <Lock size={18} color={colors.secondary} />
            <Text style={styles.lockText}>
              Sign in to start the quiz and sync certificates across devices.
            </Text>
            <PrimaryButton
              label="Login / Sign Up"
              onPress={() => router.push(href("/signin"))}
            />
          </View>
        ) : result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {result.passed ? "Passed" : "Keep walking"} · {result.score}/{result.total}
            </Text>
            <Text style={styles.resultBody}>
              Pass score {result.pass_score}.{" "}
              {result.certification
                ? `Certificate ${result.certification.certificate_code}`
                : "No new certificate this time."}
            </Text>
            {result.review.slice(0, 3).map((item) => (
              <View key={item.question_id} style={styles.reviewRow}>
                {item.is_correct ? (
                  <Check size={16} color={colors.success} />
                ) : (
                  <X size={16} color={colors.error} />
                )}
                <Text style={styles.reviewText} numberOfLines={2}>
                  {item.prompt}
                </Text>
              </View>
            ))}
            <PrimaryButton
              label="Choose another level"
              onPress={() => {
                setResult(null)
              }}
            />
          </View>
        ) : attempt && current ? (
          <View style={styles.questionCard}>
            <Text style={styles.progress}>{progressLabel}</Text>
            <Text style={styles.prompt}>{current.prompt}</Text>
            {current.options.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setAnswers((prev) => ({ ...prev, [current.id]: option.id }))}
                style={[
                  styles.option,
                  answers[current.id] === option.id && styles.optionActive,
                ]}
              >
                <Text style={styles.optionText}>{option.text}</Text>
              </Pressable>
            ))}
            <View style={styles.navRow}>
              <SecondaryButton
                label="Back"
                onPress={() => setIndex((value) => Math.max(0, value - 1))}
                fullWidth={false}
              />
              {index < attempt.questions.length - 1 ? (
                <PrimaryButton
                  label="Next"
                  onPress={() => setIndex((value) => Math.min(attempt.questions.length - 1, value + 1))}
                  fullWidth={false}
                />
              ) : (
                <PrimaryButton
                  label={busy ? "Submitting…" : "Submit"}
                  onPress={() => void submit()}
                  disabled={busy}
                  fullWidth={false}
                />
              )}
            </View>
          </View>
        ) : (
          <>
            {levels.map((level) => (
              <Pressable
                key={level.id}
                onPress={() => setSelected(level.id)}
                style={[styles.level, selected === level.id && styles.levelActive]}
              >
                <Text style={styles.levelTitle}>{level.title}</Text>
                <Text style={styles.levelDetail}>{level.detail}</Text>
                {status?.certifications.some((item) => item.level === level.id) ? (
                  <Text style={styles.earned}>Certificate earned</Text>
                ) : null}
              </Pressable>
            ))}

            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <PrimaryButton label={`Start ${selected} quiz`} onPress={() => void start()} />
            )}

            {!memberAuthAvailable() ? (
              <Text style={styles.hint}>
                The live quiz is not available on this build yet. Install the latest app update to
                sync certificates with the website.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section, gap: spacing.md },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontFamily: "Lora_700Bold",
    fontSize: 24,
    color: colors.textPrimary,
  },
  heroSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm },
  lockCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockText: { ...typography.bodySmall, color: colors.textSecondary },
  level: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  levelTitle: { ...typography.label, fontSize: 16, color: colors.textPrimary },
  levelDetail: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  earned: { ...typography.caption, color: colors.success, marginTop: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
  questionCard: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progress: { ...typography.caption, color: colors.primaryDark },
  prompt: { fontFamily: "Lora_700Bold", fontSize: 20, color: colors.textPrimary, lineHeight: 28 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceSoft,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionText: { ...typography.bodySmall, color: colors.textPrimary },
  navRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.sm },
  resultCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  resultTitle: { ...typography.h3, color: colors.textPrimary },
  resultBody: { ...typography.bodySmall, color: colors.textSecondary },
  reviewRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  reviewText: { ...typography.caption, color: colors.textPrimary, flex: 1 },
})
