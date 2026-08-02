"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { QuizCertificate } from "@/components/quiz-certificate"
import { useMember } from "@/components/member-provider"
import {
  QUIZ_LEVEL_COPY,
  fetchQuizStatus,
  startQuiz,
  submitQuiz,
  type QuizLevel,
  type QuizQuestion,
  type QuizStart,
  type QuizSubmitResult,
  type QuizStatus,
} from "@/lib/quiz"

type Step = "levels" | "quiz" | "results"

export function QuizBoard() {
  const { loading, session } = useMember()
  const [step, setStep] = useState<Step>("levels")
  const [status, setStatus] = useState<QuizStatus | null>(null)
  const [activeQuiz, setActiveQuiz] = useState<QuizStart | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState<QuizSubmitResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!session.authenticated) return
    void fetchQuizStatus().then((next) => {
      if (next) setStatus(next)
    })
  }, [session.authenticated])

  const certifiedLevels = useMemo(
    () => new Set(status?.certifications.map((item) => item.level) ?? []),
    [status],
  )

  async function begin(level: QuizLevel) {
    setBusy(true)
    setError("")
    const quiz = await startQuiz(level)
    setBusy(false)
    if (!quiz) {
      setError("Could not start the quiz. Please sign in and try again.")
      return
    }
    setActiveQuiz(quiz)
    setAnswers({})
    setCurrentIndex(0)
    setResult(null)
    setStep("quiz")
  }

  async function finish() {
    if (!activeQuiz) return
    const unanswered = activeQuiz.questions.filter((question) => !answers[question.id])
    if (unanswered.length) {
      setError(`Please answer all ${activeQuiz.questions.length} questions before submitting.`)
      return
    }
    setBusy(true)
    setError("")
    const payload = {
      attempt_id: activeQuiz.attempt_id,
      answers: activeQuiz.questions.map((question) => ({
        question_id: question.id,
        selected_option_id: answers[question.id],
      })),
    }
    const next = await submitQuiz(payload)
    setBusy(false)
    if (!next) {
      setError("Could not submit your quiz. Please try again.")
      return
    }
    setResult(next)
    setStep("results")
    const refreshed = await fetchQuizStatus()
    if (refreshed) setStatus(refreshed)
  }

  if (loading) {
    return <p className="text-center text-stone-600">Preparing quiz…</p>
  }

  if (!session.authenticated) {
    return (
      <div className="rounded-3xl border border-navy-900/10 bg-white p-8 text-center">
        <h2 className="font-serif text-3xl text-navy-950">Sign in to take the quiz</h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Quizzes, retries, answer review, and certificates are available for signed-in members.
        </p>
        <Link href="/signin" className="gold-button mt-6 px-6 py-3">Sign in</Link>
      </div>
    )
  }

  if (step === "results" && result) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
          <p className="eyebrow">Quiz results</p>
          <h2 className="mt-2 font-serif text-4xl text-navy-950">
            {result.passed ? "Namaskar — you passed!" : "Keep going — retry anytime"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Score: <span className="font-semibold text-navy-950">{result.score}/{result.total}</span>
            {" · "}Pass mark: {result.pass_score}/{result.total} (70%)
          </p>
          {result.passed && result.certification ? (
            <div className="mt-6">
              <QuizCertificate certification={result.certification} displayName={session.display_name} />
              {!result.newly_earned ? (
                <p className="mt-3 text-sm text-stone-600">You already held this level certificate — your original award stands.</p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => void begin(result.level)} className="gold-button px-5 py-2.5">
              Retry {result.level_label}
            </button>
            <button type="button" onClick={() => setStep("levels")} className="outline-button">
              Choose another level
            </button>
            <Link href="/account" className="outline-button">View profile certificates</Link>
          </div>
        </section>

        <section className="rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
          <h3 className="font-serif text-2xl text-navy-950">Your answers vs correct answers</h3>
          <div className="mt-5 space-y-4">
            {result.review.map((item, index) => (
              <ReviewCard key={item.question_id} index={index} item={item} />
            ))}
          </div>
        </section>
      </div>
    )
  }

  if (step === "quiz" && activeQuiz) {
    const question = activeQuiz.questions[currentIndex]
    const progress = `${currentIndex + 1}/${activeQuiz.questions.length}`
    return (
      <section className="rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{activeQuiz.level_label} quiz</p>
            <h2 className="mt-2 font-serif text-3xl text-navy-950">Question {progress}</h2>
          </div>
          <p className="text-sm font-semibold text-stone-600">Pass: {activeQuiz.pass_score}/10 (70%)</p>
        </div>
        <QuestionCard
          question={question}
          selected={answers[question.id]}
          onSelect={(optionId) => setAnswers((current) => ({ ...current, [question.id]: optionId }))}
        />
        {error ? <p role="status" className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((value) => value - 1)}
            className="outline-button disabled:opacity-40"
          >
            Previous
          </button>
          {currentIndex < activeQuiz.questions.length - 1 ? (
            <button
              type="button"
              disabled={!answers[question.id]}
              onClick={() => setCurrentIndex((value) => value + 1)}
              className="gold-button px-5 py-2.5 disabled:opacity-40"
            >
              Next question
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void finish()}
              className="gold-button px-5 py-2.5 disabled:opacity-40"
            >
              {busy ? <LoadingIndicator label="Submitting" compact /> : "Submit quiz"}
            </button>
          )}
          <button type="button" onClick={() => setStep("levels")} className="text-sm font-semibold text-stone-500">
            Cancel
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
        <p className="eyebrow">Prabhat Samgiita quiz</p>
        <h2 className="mt-2 font-serif text-4xl text-navy-950">Choose your level</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          Each attempt has 10 random questions. Score at least 7/10 (70%) to earn your certificate. Retries are always welcome.
        </p>
        {error ? <p role="status" className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {(Object.keys(QUIZ_LEVEL_COPY) as QuizLevel[]).map((level) => {
            const copy = QUIZ_LEVEL_COPY[level]
            const certified = certifiedLevels.has(level)
            return (
              <article key={level} className="rounded-2xl border border-navy-900/10 bg-ivory-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-2xl text-navy-950">{copy.title}</h3>
                  {certified ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
                      Certified
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{copy.description}</p>
                <p className="mt-3 text-xs text-stone-500">
                  Pool: {status?.levels.find((item) => item.level === level)?.question_pool_size ?? 12} questions
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void begin(level)}
                  className="gold-button mt-5 w-full justify-center py-2.5"
                >
                  {busy ? "Starting…" : certified ? "Retry level" : "Start quiz"}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      {status?.certifications.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {status.certifications.map((certification) => (
            <QuizCertificate
              key={certification.certificate_code}
              certification={certification}
              displayName={session.display_name}
              compact
            />
          ))}
        </section>
      ) : null}
    </div>
  )
}

function QuestionCard({
  question,
  selected,
  onSelect,
}: {
  question: QuizQuestion
  selected?: string
  onSelect: (optionId: string) => void
}) {
  return (
    <fieldset className="mt-6">
      <legend className="font-serif text-xl leading-8 text-navy-950">{question.prompt}</legend>
      <div className="mt-4 space-y-3">
        {question.options.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${
              selected === option.id
                ? "border-gold-500 bg-gold-50 text-navy-950"
                : "border-navy-900/10 bg-white text-stone-700"
            }`}
          >
            <input
              type="radio"
              name={question.id}
              value={option.id}
              checked={selected === option.id}
              onChange={() => onSelect(option.id)}
              className="mt-1"
            />
            <span>{option.text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ReviewCard({ index, item }: { index: number; item: QuizSubmitResult["review"][number] }) {
  const selected = item.options.find((option) => option.id === item.selected_option_id)
  const correct = item.options.find((option) => option.id === item.correct_option_id)
  return (
    <article className={`rounded-2xl border p-4 ${item.is_correct ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/50"}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Question {index + 1}</p>
      <h4 className="mt-2 font-serif text-lg text-navy-950">{item.prompt}</h4>
      <p className="mt-3 text-sm"><span className="font-semibold">Your answer:</span> {selected?.text ?? "Not answered"}</p>
      {!item.is_correct ? (
        <p className="mt-1 text-sm"><span className="font-semibold">Correct answer:</span> {correct?.text}</p>
      ) : null}
      {item.explanation ? <p className="mt-3 text-sm leading-6 text-stone-700">{item.explanation}</p> : null}
    </article>
  )
}
