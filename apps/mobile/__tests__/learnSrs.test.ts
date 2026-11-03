import { describe, expect, it } from "vitest"

import {
  DAY,
  DEFAULT_EASE,
  MINUTE,
  advanceQueue,
  buildDailyQueue,
  describeNextDue,
  dueCardCount,
  formatDelay,
  gradeCard,
  nearestStep,
  newCard,
  nextDueAt,
  previewIntervals,
  queueCounts,
  wordsLearnedCount,
  type Grade,
  type ReviewStyle,
  type WordCard,
} from "@/lib/learn/srs"

const NOW = new Date(2026, 10, 3, 9, 0, 0).getTime()

function review(days: number, ease = DEFAULT_EASE): WordCard {
  return { ...newCard("w", NOW), status: "review", intervalDays: days, ease, dueAt: NOW }
}

function after(card: WordCard, grade: Grade, style: ReviewStyle): WordCard {
  return gradeCard(card, grade, style, NOW)
}

describe("formatDelay", () => {
  it("prints minutes, hours, days and months", () => {
    expect(formatDelay(30_000, true)).toBe("<1m")
    expect(formatDelay(10 * MINUTE)).toBe("10m")
    expect(formatDelay(10 * MINUTE, true)).toBe("<10m")
    expect(formatDelay(3 * 60 * MINUTE)).toBe("3h")
    expect(formatDelay(4 * DAY)).toBe("4d")
    expect(formatDelay(80 * DAY)).toBe("3mo")
  })
})

describe("simple steps ladder 1, 3, 7, 14, 30", () => {
  it("climbs one rung per Good", () => {
    let card = after(newCard("w", NOW), "good", "steps")
    expect(card.status).toBe("review")
    expect(card.intervalDays).toBe(1)
    const seen = [card.intervalDays]
    for (let i = 0; i < 5; i += 1) {
      card = after(card, "good", "steps")
      seen.push(card.intervalDays)
    }
    expect(seen).toEqual([1, 3, 7, 14, 30, 30])
  })

  it("Again restarts the ladder at one day", () => {
    const failed = after(review(14), "again", "steps")
    expect(failed.status).toBe("learning")
    expect(failed.lapses).toBe(1)
    expect(failed.dueAt - NOW).toBe(10 * MINUTE)
    const back = after(failed, "good", "steps")
    expect(back.status).toBe("review")
    expect(back.intervalDays).toBe(1)
  })

  it("Hard repeats the rung and Easy skips one", () => {
    expect(after(review(7), "hard", "steps").intervalDays).toBe(7)
    expect(after(review(7), "easy", "steps").intervalDays).toBe(30)
    expect(after(review(3), "easy", "steps").intervalDays).toBe(14)
  })

  it("new card: Again 1 minute, Hard 10 minutes, Good one day, Easy three days", () => {
    const card = newCard("w", NOW)
    expect(previewIntervals(card, "steps")).toEqual({ again: "<1m", hard: "10m", good: "1d", easy: "3d" })
  })
})

describe("adaptive (SM-2-like)", () => {
  it("walks learning steps 1m then 10m before graduating at one day", () => {
    const first = after(newCard("w", NOW), "good", "adaptive")
    expect(first.status).toBe("learning")
    expect(first.dueAt - NOW).toBe(10 * MINUTE)
    const second = after(first, "good", "adaptive")
    expect(second.status).toBe("review")
    expect(second.intervalDays).toBe(1)
  })

  it("Easy from new graduates at four days", () => {
    expect(after(newCard("w", NOW), "easy", "adaptive").intervalDays).toBe(4)
  })

  it("an easy word gaps grow roughly 4, 11, 31 days", () => {
    let card = after(newCard("w", NOW), "easy", "adaptive")
    const gaps = [card.intervalDays]
    for (let i = 0; i < 2; i += 1) {
      card = after(card, "easy", "adaptive")
      gaps.push(card.intervalDays)
    }
    expect(gaps).toEqual([4, 11, 31])
  })

  it("keeps Hard < Good < Easy even at one day", () => {
    const card = review(1)
    const hard = after(card, "hard", "adaptive").intervalDays
    const good = after(card, "good", "adaptive").intervalDays
    const easy = after(card, "easy", "adaptive").intervalDays
    expect(hard).toBeLessThan(good)
    expect(good).toBeLessThan(easy)
  })

  it("Hard and Again lower ease but never below 1.3", () => {
    let card = review(10, 1.4)
    card = after(card, "hard", "adaptive")
    expect(card.ease).toBeGreaterThanOrEqual(1.3)
    card = after(review(10, 1.31), "again", "adaptive")
    expect(card.ease).toBe(1.3)
  })

  it("a hard word comes back sooner than an easy one", () => {
    const hard = after(review(10), "hard", "adaptive")
    const easy = after(review(10), "easy", "adaptive")
    expect(hard.intervalDays).toBeLessThan(easy.intervalDays)
  })
})

describe("daily practice", () => {
  it("comes back tomorrow until Easy, then after a week", () => {
    let card = after(newCard("w", NOW), "good", "daily")
    expect(card.intervalDays).toBe(1)
    card = after(card, "good", "daily")
    expect(card.intervalDays).toBe(1)
    card = after(card, "hard", "daily")
    expect(card.intervalDays).toBe(1)
    card = after(card, "easy", "daily")
    expect(card.intervalDays).toBe(7)
    expect(card.dueAt - NOW).toBe(7 * DAY)
  })
})

describe("grading bookkeeping", () => {
  it("does not mutate the input and records history", () => {
    const card = newCard("w", NOW)
    const next = gradeCard(card, "good", "steps", NOW)
    expect(card.reps).toBe(0)
    expect(card.history).toHaveLength(0)
    expect(next.reps).toBe(1)
    expect(next.history).toEqual([{ at: NOW, grade: "good" }])
    expect(next.lastReviewedAt).toBe(NOW)
  })

  it("caps history at 30 entries", () => {
    let card = newCard("w", NOW)
    for (let i = 0; i < 40; i += 1) card = gradeCard(card, "again", "steps", NOW + i)
    expect(card.history).toHaveLength(30)
  })

  it("maps a gap to the nearest ladder rung when the style changes", () => {
    expect(nearestStep(1)).toBe(0)
    expect(nearestStep(4)).toBe(1)
    expect(nearestStep(10)).toBe(2)
    expect(nearestStep(11)).toBe(3)
    expect(nearestStep(80)).toBe(4)
  })

  it("an adaptive card switched to Simple steps continues from the nearest rung", () => {
    const adaptive = after(review(10), "good", "adaptive")
    expect(adaptive.intervalDays).toBeGreaterThan(10)
    const stepsNext = after(review(10), "good", "steps")
    expect(stepsNext.intervalDays).toBe(14)
  })
})

describe("today's queue", () => {
  const ids = ["a", "b", "c", "d", "e", "f"]

  it("puts due reviews first, then new words up to the limit", () => {
    const cards: Record<string, WordCard> = {
      c: { ...review(3), wordId: "c", dueAt: NOW - DAY },
      b: { ...review(3), wordId: "b", dueAt: NOW - 2 * DAY },
      d: { ...review(3), wordId: "d", dueAt: NOW + 3 * DAY },
    }
    const queue = buildDailyQueue(ids, cards, NOW, 2)
    expect(queue).toEqual(["b", "c", "a", "e"])
  })

  it("counts New, Learning and Due", () => {
    const cards: Record<string, WordCard> = {
      a: { ...newCard("a", NOW), status: "learning" },
      b: { ...review(3), wordId: "b" },
    }
    expect(queueCounts(["a", "b", "c"], cards, NOW)).toEqual({ newCount: 1, learningCount: 1, dueCount: 1 })
  })

  it("Again goes to the end of the queue", () => {
    expect(advanceQueue(["a", "b", "c"], "again")).toEqual(["b", "c", "a"])
  })

  it("Hard comes back after two cards", () => {
    expect(advanceQueue(["a", "b", "c", "d"], "hard")).toEqual(["b", "c", "a", "d"])
    expect(advanceQueue(["a", "b"], "hard")).toEqual(["b", "a"])
  })

  it("Good and Easy leave the queue", () => {
    expect(advanceQueue(["a", "b"], "good")).toEqual(["b"])
    expect(advanceQueue(["a", "b"], "easy")).toEqual(["b"])
    expect(advanceQueue(["a"], "good")).toEqual([])
  })

  it("never shows the same card twice in a row unless it is the last one", () => {
    for (const grade of ["again", "hard"] as const) {
      for (let n = 2; n <= 5; n += 1) {
        const queue = Array.from({ length: n }, (_, i) => `c${i}`)
        expect(advanceQueue(queue, grade)[0]).not.toBe(queue[0])
      }
    }
    expect(advanceQueue(["only"], "again")).toEqual(["only"])
  })

  it("a full session ends with an empty queue", () => {
    let queue = ["a", "b", "c"]
    const grades: Grade[] = ["again", "good", "hard", "good", "good", "easy"]
    for (const grade of grades) queue = advanceQueue(queue, grade)
    expect(queue).toEqual([])
  })
})

describe("counts and next due", () => {
  it("counts learned words and due cards", () => {
    const cards: Record<string, WordCard> = {
      a: { ...review(1), wordId: "a", dueAt: NOW + 10 * DAY },
      b: { ...review(7), wordId: "b", dueAt: NOW - 1 },
      c: { ...newCard("c", NOW), status: "learning", dueAt: NOW + 5 * MINUTE },
    }
    expect(wordsLearnedCount(cards)).toBe(2)
    expect(dueCardCount(cards, NOW)).toBe(2)
    expect(nextDueAt(cards, NOW)).toBe(NOW + 5 * MINUTE)
  })

  it("describes the next due time", () => {
    expect(describeNextDue(null, NOW)).toBe("No cards scheduled")
    expect(describeNextDue(NOW + 10 * MINUTE, NOW)).toBe("Next card in 10m")
    expect(describeNextDue(NOW + 3 * 60 * MINUTE, NOW)).toBe("Next card in 3h")
    expect(describeNextDue(NOW + DAY, NOW)).toBe("Next card tomorrow")
    expect(describeNextDue(NOW + 4 * DAY, NOW)).toBe("Next card in 4 days")
  })
})
