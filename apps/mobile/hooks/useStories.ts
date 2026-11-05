import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { FIXTURE_STORIES, fixtureStoryBySlug } from "@/lib/fixtures/stories"
import { MOCK_SONGS } from "@/lib/fixtures/songsMock"
import { api } from "@/lib/client"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { storyFromApi } from "@/lib/stories/fromApi"
import { estimateReadMinutes } from "@/lib/stories/readTime"
import { bodyText } from "@/lib/stories/body"
import type { Story } from "@/lib/stories/types"
import { useSongTitles } from "@/hooks/useSongTitles"

export type StoriesState = {
  stories: Story[]
  loading: boolean
  /** true when the load failed or came back empty (never under MOCKUP_DATA) */
  failed: boolean
  reload: () => void
}

/** The stories list: the API (summaries), or the sample fixtures under MOCKUP_DATA. */
export function useStories(): StoriesState {
  const [stories, setStories] = useState<Story[]>(() => (MOCKUP_DATA ? [...FIXTURE_STORIES] : []))
  const [loading, setLoading] = useState(!MOCKUP_DATA)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (MOCKUP_DATA) return
    let active = true
    setLoading(true)
    setFailed(false)
    void api.fetchStories({ limit: 50 }).then((rows) => {
      if (!active) return
      setStories(rows.map(storyFromApi))
      setFailed(rows.length === 0)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { stories, loading, failed, reload }
}

const detailCache = new Map<string, Story>()

export type StoryState = { story: Story | null; loading: boolean }

/** One story with its full text: the API detail (cached), or the fixture under MOCKUP_DATA. */
export function useStory(slug: string | undefined): StoryState {
  const [story, setStory] = useState<Story | null>(() =>
    !slug ? null : MOCKUP_DATA ? fixtureStoryBySlug(slug) : (detailCache.get(slug) ?? null),
  )
  const [loading, setLoading] = useState(Boolean(slug) && !MOCKUP_DATA && !detailCache.has(slug ?? ""))

  useEffect(() => {
    if (!slug || MOCKUP_DATA) return
    const cached = detailCache.get(slug)
    if (cached) {
      setStory(cached)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    void api.fetchStory(slug).then((detail) => {
      if (!active) return
      const mapped = detail ? storyFromApi(detail) : null
      if (mapped) detailCache.set(slug, mapped)
      setStory(mapped)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [slug])

  return { story, loading }
}

/**
 * Read minutes per slug that are known: from the full text of a fixture, or from details already loaded.
 * A list row of the API has no text, so its length stays unknown (no number is guessed).
 */
export function minutesOf(story: Story): number | null {
  const full = story.paragraphs.length ? story : (detailCache.get(story.slug) ?? null)
  if (!full) return null
  const minutes = estimateReadMinutes(bodyText(full.paragraphs))
  return minutes > 0 ? minutes : null
}

/** Warms the first few details so the list can show read times. */
export function usePrefetchMinutes(stories: readonly Story[]): number {
  const [version, setVersion] = useState(0)
  const done = useRef(new Set<string>())
  useEffect(() => {
    if (MOCKUP_DATA) return
    let active = true
    const todo = stories.filter((s) => !s.paragraphs.length && !detailCache.has(s.slug) && !done.current.has(s.slug)).slice(0, 8)
    if (!todo.length) return
    void Promise.all(
      todo.map(async (s) => {
        done.current.add(s.slug)
        const detail = await api.fetchStory(s.slug)
        if (detail) detailCache.set(s.slug, storyFromApi(detail))
      }),
    ).then(() => {
      if (active) setVersion((v) => v + 1)
    })
    return () => {
      active = false
    }
  }, [stories])
  return version
}

/** Song titles for a list of PS numbers: the sample catalog under MOCKUP_DATA, the real catalog otherwise. */
export function useStorySongTitles(stories: readonly Story[]): (n: number) => string | undefined {
  const numbers = useMemo(() => [...new Set(stories.flatMap((s) => s.songNumbers))], [stories])
  const catalog = useSongTitles(numbers)
  return useCallback(
    (n: number) => {
      if (MOCKUP_DATA) return MOCK_SONGS.find((s) => s.n === n)?.title
      return catalog.get(n)
    },
    [catalog],
  )
}
