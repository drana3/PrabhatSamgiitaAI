import { useCallback, useEffect, useRef, useState } from "react"

import { moodBackend, moodFailure } from "@/lib/recordingMoods/backend"
import { forgetConfirmedMoods } from "@/lib/recordingMoods/confirmed"
import type { MoodFailure, RecordingMoods, VoteValue } from "@/lib/recordingMoods/types"

export type MoodsController = {
  /** null until the first answer (or when the page could not be read) */
  page: RecordingMoods | null
  loading: boolean
  busy: boolean
  /** the failure of the last read or change, with a sentence in `recMoods.failure.*` */
  failure: MoodFailure | null
  suggest: (moods: readonly string[]) => Promise<boolean>
  vote: (mood: string, value: VoteValue) => Promise<boolean>
}

/** The moods of one recording (the server's id): read once, then re-read after every change so the page shows the server's word. */
export function useRecordingMoods(id: string): MoodsController {
  const [page, setPage] = useState<RecordingMoods | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<MoodFailure | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const next = await moodBackend().recording(id)
      if (alive.current) {
        setPage(next)
        setFailure(null)
      }
    } catch (error) {
      if (alive.current) setFailure(moodFailure(error))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  const change = useCallback(
    async (run: () => Promise<void>) => {
      setBusy(true)
      setFailure(null)
      try {
        await run()
        forgetConfirmedMoods()
        await load()
        return true
      } catch (error) {
        if (alive.current) setFailure(moodFailure(error))
        return false
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [load],
  )

  return {
    page,
    loading,
    busy,
    failure,
    suggest: (moods) => change(() => moodBackend().suggest(id, moods)),
    vote: (mood, value) => change(() => moodBackend().vote(id, mood, value)),
  }
}
