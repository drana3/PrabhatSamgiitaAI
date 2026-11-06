import { getActiveLanguage, t, translatorFor, type TranslateFn } from "@/lib/i18n"
/**
 * Spaced repetition for the Learn word cards (spec SCR-22 and SCR-27).
 *
 * Three review styles, chosen by the user:
 *  - steps    Simple steps: a fixed ladder 1, 3, 7, 14, 30 days. Again restarts it.
 *  - adaptive SM-2-like: every card has its own ease, easy words come back later.
 *  - daily    Daily practice: tomorrow until Easy, then once a week.
 *
 * Everything here is pure: the caller passes `now`, nothing reads the clock.
 * Exact intervals and the SM-2 constants are still an open question (OQ 16, 22),
 * so they are named constants in one place.
 */

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export type ReviewStyle = "steps" | "adaptive" | "daily"
export type Grade = "again" | "hard" | "good" | "easy"
export type CardStatus = "new" | "learning" | "review"

export const GRADES: readonly Grade[] = ["again", "hard", "good", "easy"]
export const DEFAULT_REVIEW_STYLE: ReviewStyle = "steps"

export const STEP_LADDER_DAYS: readonly number[] = [1, 3, 7, 14, 30]
export const DEFAULT_EASE = 2.5
export const MIN_EASE = 1.3
const ADAPTIVE_HARD_FACTOR = 1.2
const ADAPTIVE_EASY_BONUS = 0.15
const ADAPTIVE_HARD_PENALTY = 0.15
const ADAPTIVE_LAPSE_PENALTY = 0.2
const ADAPTIVE_EASY_GRADUATE_DAYS = 4
const DAILY_EASY_DAYS = 7
const STEPS_EASY_GRADUATE_DAYS = 3
const HISTORY_LIMIT = 30

export const REVIEW_STYLES: ReadonlyArray<{
  key: ReviewStyle
  name: string
  tag: string
  description: string
  ladder: string
}> = [
  {
    key: "steps",
    get name() { return t("reviewStyle.simple") },
    get tag() { return t("reviewStyle.simple.tag") },
    get description() { return t("reviewStyle.simple.desc") },
    get ladder() { return t("reviewStyle.simple.line") },
  },
  {
    key: "adaptive",
    get name() { return t("reviewStyle.adaptive") },
    get tag() { return t("reviewStyle.adaptive.tag") },
    get description() { return t("reviewStyle.adaptive.desc") },
    get ladder() { return t("reviewStyle.adaptive.line") },
  },
  {
    key: "daily",
    get name() { return t("reviewStyle.daily") },
    get tag() { return t("reviewStyle.daily.tag") },
    get description() { return t("reviewStyle.daily.desc") },
    get ladder() { return t("reviewStyle.daily.line") },
  },
]

export type CardHistoryEntry = { at: number; grade: Grade }

export type WordCard = {
  wordId: string
  status: CardStatus
  /** epoch ms when the card is next due */
  dueAt: number
  /** current review gap in days (0 while the card is new or learning) */
  intervalDays: number
  ease: number
  /** learning step while status is new or learning */
  step: number
  reps: number
  lapses: number
  lastReviewedAt: number | null
  history: CardHistoryEntry[]
}

export function newCard(wordId: string, now: number): WordCard {
  return {
    wordId,
    status: "new",
    dueAt: now,
    intervalDays: 0,
    ease: DEFAULT_EASE,
    step: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    history: [],
  }
}

/** Index of the ladder rung closest to a gap in days. Used when the review style changes. */
export function nearestStep(intervalDays: number): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  STEP_LADDER_DAYS.forEach((days, index) => {
    const distance = Math.abs(days - intervalDays)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

type Outcome = {
  status: CardStatus
  delayMs: number
  intervalDays: number
  ease: number
  step: number
  lapse: boolean
}

function graduate(card: WordCard, days: number): Outcome {
  return {
    status: "review",
    delayMs: days * DAY,
    intervalDays: days,
    ease: card.ease,
    step: nearestStep(days),
    lapse: false,
  }
}

function learning(card: WordCard, delayMs: number, step: number): Outcome {
  return { status: "learning", delayMs, intervalDays: 0, ease: card.ease, step, lapse: false }
}

/** New and learning cards. */
function learningOutcome(card: WordCard, grade: Grade, style: ReviewStyle): Outcome {
  if (style === "adaptive") {
    const onSecondStep = card.status === "learning" && card.step >= 1
    switch (grade) {
      case "again":
        return learning(card, 1 * MINUTE, 0)
      case "hard":
        return learning(card, onSecondStep ? 10 * MINUTE : 6 * MINUTE, onSecondStep ? 1 : 0)
      case "good":
        return onSecondStep ? graduate(card, 1) : learning(card, 10 * MINUTE, 1)
      case "easy":
        return graduate(card, ADAPTIVE_EASY_GRADUATE_DAYS)
    }
  }
  switch (grade) {
    case "again":
      return learning(card, 1 * MINUTE, 0)
    case "hard":
      return learning(card, 10 * MINUTE, 0)
    case "good":
      return graduate(card, 1)
    case "easy":
      return graduate(card, style === "daily" ? DAILY_EASY_DAYS : STEPS_EASY_GRADUATE_DAYS)
  }
}

function lapse(card: WordCard, style: ReviewStyle): Outcome {
  return {
    status: "learning",
    delayMs: 10 * MINUTE,
    intervalDays: 0,
    ease: style === "adaptive" ? Math.max(MIN_EASE, card.ease - ADAPTIVE_LAPSE_PENALTY) : card.ease,
    // second learning step, so one Good brings the word back at one day
    step: 1,
    lapse: true,
  }
}

/** Cards that already graduated. */
function reviewOutcome(card: WordCard, grade: Grade, style: ReviewStyle): Outcome {
  if (grade === "again") return lapse(card, style)

  if (style === "steps") {
    const rung = nearestStep(card.intervalDays)
    const last = STEP_LADDER_DAYS.length - 1
    const target = grade === "hard" ? rung : grade === "good" ? Math.min(rung + 1, last) : Math.min(rung + 2, last)
    return graduate(card, STEP_LADDER_DAYS[target]!)
  }

  if (style === "daily") {
    return graduate(card, grade === "easy" ? DAILY_EASY_DAYS : 1)
  }

  // adaptive
  const current = Math.max(1, card.intervalDays)
  const hard = Math.max(current, Math.round(current * ADAPTIVE_HARD_FACTOR))
  const good = Math.max(hard + 1, Math.round(current * card.ease))
  const easyEase = card.ease + ADAPTIVE_EASY_BONUS
  const easy = Math.max(good + 1, Math.round(current * easyEase))
  if (grade === "hard") {
    return { ...graduate(card, hard), ease: Math.max(MIN_EASE, card.ease - ADAPTIVE_HARD_PENALTY) }
  }
  if (grade === "good") return graduate(card, good)
  return { ...graduate(card, easy), ease: easyEase }
}

function outcomeFor(card: WordCard, grade: Grade, style: ReviewStyle): Outcome {
  return card.status === "review" ? reviewOutcome(card, grade, style) : learningOutcome(card, grade, style)
}

/** The card after one grade. Does not mutate the input. */
export function gradeCard(card: WordCard, grade: Grade, style: ReviewStyle, now: number): WordCard {
  const outcome = outcomeFor(card, grade, style)
  return {
    ...card,
    status: outcome.status,
    dueAt: now + outcome.delayMs,
    intervalDays: outcome.intervalDays,
    ease: outcome.ease,
    step: outcome.step,
    reps: card.reps + 1,
    lapses: card.lapses + (outcome.lapse ? 1 : 0),
    lastReviewedAt: now,
    history: [...card.history, { at: now, grade }].slice(-HISTORY_LIMIT),
  }
}

/** "<1m", "10m", "3h", "4d", "2mo". Again is prefixed with "<" because it comes back in this session. */
export function formatDelay(delayMs: number, lessThan = false, tr: TranslateFn = translatorFor(getActiveLanguage())): string {
  const prefix = lessThan ? "<" : ""
  if (delayMs <= MINUTE) return `${prefix}${tr("learn.delay.min", { count: 1 })}`
  if (delayMs < HOUR) return `${prefix}${tr("learn.delay.min", { count: Math.round(delayMs / MINUTE) })}`
  if (delayMs < DAY) return `${prefix}${tr("learn.delay.hour", { count: Math.round(delayMs / HOUR) })}`
  const days = Math.round(delayMs / DAY)
  if (days < 60) return `${prefix}${tr("learn.delay.day", { count: days })}`
  return `${prefix}${tr("learn.delay.month", { count: Math.round(days / 30) })}`
}

/** The interval printed under each grade button, for the chosen style. */
export function previewIntervals(card: WordCard, style: ReviewStyle): Record<Grade, string> {
  const labels = {} as Record<Grade, string>
  for (const grade of GRADES) {
    labels[grade] = formatDelay(outcomeFor(card, grade, style).delayMs, grade === "again")
  }
  return labels
}

// ---------------------------------------------------------------------------
// Today's queue
// ---------------------------------------------------------------------------

export function endOfLocalDay(now: number): number {
  const date = new Date(now)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

export type QueueCounts = { newCount: number; learningCount: number; dueCount: number }
export type QueueKind = "new" | "learning" | "due"

/** What kind of card is this, for the counters row: New, Learning or Due. */
export function queueKind(card: WordCard): QueueKind {
  if (card.status === "new") return "new"
  if (card.status === "learning") return "learning"
  return "due"
}

/**
 * Build today's queue: reviews and learning cards due before midnight first
 * (oldest due first), then new words up to `newLimit`.
 */
export function buildDailyQueue(
  wordIds: readonly string[],
  cards: Readonly<Record<string, WordCard>>,
  now: number,
  newLimit = 10,
): string[] {
  const endOfDay = endOfLocalDay(now)
  const waiting: Array<{ id: string; dueAt: number }> = []
  const fresh: string[] = []
  for (const id of wordIds) {
    const card = cards[id]
    if (!card || card.status === "new") fresh.push(id)
    else if (card.dueAt <= endOfDay) waiting.push({ id, dueAt: card.dueAt })
  }
  waiting.sort((a, b) => a.dueAt - b.dueAt)
  return [...waiting.map((entry) => entry.id), ...fresh.slice(0, Math.max(0, newLimit))]
}

export function queueCounts(
  queue: readonly string[],
  cards: Readonly<Record<string, WordCard>>,
  now: number,
): QueueCounts {
  const counts: QueueCounts = { newCount: 0, learningCount: 0, dueCount: 0 }
  for (const id of queue) {
    const kind = queueKind(cards[id] ?? newCard(id, now))
    if (kind === "new") counts.newCount += 1
    else if (kind === "learning") counts.learningCount += 1
    else counts.dueCount += 1
  }
  return counts
}

/**
 * Take the first card off the queue after a grade (SCR-22):
 * Again goes to the end, Hard comes back after about two cards,
 * Good and Easy leave today's queue. A card never shows twice in a
 * row unless it is the only one left.
 */
export function advanceQueue(queue: readonly string[], grade: Grade): string[] {
  if (queue.length === 0) return []
  const [head, ...rest] = queue as [string, ...string[]]
  if (grade === "again") return [...rest, head]
  if (grade === "hard") {
    const at = Math.min(2, rest.length)
    return [...rest.slice(0, at), head, ...rest.slice(at)]
  }
  return rest
}

/** Words that count as learned: graduated to the review stage with a gap of a day or more. */
export function wordsLearnedCount(cards: Readonly<Record<string, WordCard>>): number {
  return Object.values(cards).filter((card) => card.status === "review" && card.intervalDays >= 1).length
}

/** Cards due by the end of today, new cards not included. */
export function dueCardCount(cards: Readonly<Record<string, WordCard>>, now: number): number {
  const endOfDay = endOfLocalDay(now)
  return Object.values(cards).filter((card) => card.status !== "new" && card.dueAt <= endOfDay).length
}

/** Earliest due time after `now`, or null when nothing is scheduled. */
export function nextDueAt(cards: Readonly<Record<string, WordCard>>, now: number): number | null {
  let best: number | null = null
  for (const card of Object.values(cards)) {
    if (card.status === "new" || card.dueAt <= now) continue
    if (best === null || card.dueAt < best) best = card.dueAt
  }
  return best
}

/** "in 10m", "in 3h", "tomorrow", "in 4 days". */
export function describeNextDue(dueAt: number | null, now: number, what: "card" | "review" = "card"): string {
  if (dueAt === null) return t("learn.next.none")
  const p = what === "review" ? "learn.nextReview" : "learn.nextCard"
  const delta = dueAt - now
  if (delta < HOUR) return t(`${p}.min`, { n: Math.max(1, Math.round(delta / MINUTE)) })
  if (delta < DAY) return t(`${p}.hour`, { n: Math.round(delta / HOUR) })
  const days = Math.round(delta / DAY)
  return days <= 1 ? t(`${p}.tomorrow`) : t(`${p}.days`, { count: days })
}
