import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  HOME_CACHE_KEYS,
  HOME_CACHE_TTL,
  clearHomeCache,
  readHomeCache,
  readHomeCacheStale,
  writeHomeCache,
} from "@/lib/home-cache"

describe("home-cache", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it("writes and reads within TTL", () => {
    writeHomeCache(HOME_CACHE_KEYS.testimonials, [{ quote_text: "hello" }])
    expect(readHomeCache(HOME_CACHE_KEYS.testimonials, HOME_CACHE_TTL.testimonials)).toEqual([
      { quote_text: "hello" },
    ])
  })

  it("returns stale values after TTL for instant paint", () => {
    vi.useFakeTimers()
    writeHomeCache(HOME_CACHE_KEYS.quizWinners, [{ id: "1" }])
    vi.advanceTimersByTime(HOME_CACHE_TTL.quizWinners + 1)
    expect(readHomeCache(HOME_CACHE_KEYS.quizWinners, HOME_CACHE_TTL.quizWinners)).toBeNull()
    expect(readHomeCacheStale(HOME_CACHE_KEYS.quizWinners)).toEqual([{ id: "1" }])
  })

  it("clears a key", () => {
    writeHomeCache(HOME_CACHE_KEYS.quizStatus("self"), { certifications: [] })
    clearHomeCache(HOME_CACHE_KEYS.quizStatus("self"))
    expect(readHomeCacheStale(HOME_CACHE_KEYS.quizStatus("self"))).toBeNull()
  })
})
