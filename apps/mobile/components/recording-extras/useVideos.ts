import { useCallback, useEffect, useRef, useState } from "react"

import { videoFailure, videosBackend } from "@/lib/recordingVideos/backend"
import type { VideoFailure, VideoLink, VideoReportReason, VideoTarget } from "@/lib/recordingVideos/types"

export type VideosState = { status: "loading" | "ready" | "error" | "offline"; items: VideoLink[]; total: number; room: number }

export type VideosController = {
  state: VideosState
  reload: () => Promise<void>
  add: (draft: { url: string; title: string | null; isAnonymous: boolean }) => Promise<{ ok: true; video: VideoLink } | { ok: false; failure: VideoFailure }>
  remove: (id: string) => Promise<VideoFailure | null>
  report: (id: string, reason: VideoReportReason) => Promise<{ ok: true; status: "received" | "already_reported" } | { ok: false; failure: VideoFailure }>
}

const keyOf = (target: VideoTarget | null) => (target ? `${target.kind}:${target.id}` : "none")

/** The video links of one target (a recording or a Prabhat Samgiita song). Same drop-late-replies rule as the other hooks. */
/** `null` loads nothing (a song that cannot take links): the list stays empty and nothing is asked of the server. */
export function useVideos(target: VideoTarget | null): VideosController {
  const key = keyOf(target)
  const [state, setState] = useState<VideosState>({ status: "loading", items: [], total: 0, room: 0 })
  const current = useRef(key)
  current.current = key
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const fresh = (k: string) => alive.current && current.current === k

  const reload = useCallback(async () => {
    if (!target) return
    setState((s) => ({ ...s, status: "loading" }))
    try {
      const list = await videosBackend().list(target)
      if (fresh(key)) setState({ status: "ready", items: list.items, total: list.total, room: list.room })
    } catch (error) {
      if (fresh(key)) setState((s) => ({ ...s, status: videoFailure(error) === "network" ? "offline" : "error" }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    void reload()
  }, [reload])

  const add = useCallback(
    async (draft: { url: string; title: string | null; isAnonymous: boolean }) => {
      if (!target) return { ok: false as const, failure: "gone" as const }
      try {
        const video = await videosBackend().add(target, draft)
        if (fresh(key)) setState((s) => ({ status: "ready", items: [video, ...s.items.filter((x) => x.id !== video.id)], total: s.total + 1, room: Math.max(0, s.room - 1) }))
        return { ok: true as const, video }
      } catch (error) {
        return { ok: false as const, failure: videoFailure(error) }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  const remove = useCallback(async (id: string) => {
    try {
      await videosBackend().remove(id)
    } catch (error) {
      const failure = videoFailure(error)
      if (failure !== "gone") return failure
    }
    if (alive.current) setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== id), total: Math.max(0, s.total - 1), room: s.room + 1 }))
    return null
  }, [])

  const report = useCallback(async (id: string, reason: VideoReportReason) => {
    try {
      const result = await videosBackend().report(id, { reason })
      return { ok: true as const, status: result.status }
    } catch (error) {
      return { ok: false as const, failure: videoFailure(error) }
    }
  }, [])

  return { state, reload, add, remove, report }
}
