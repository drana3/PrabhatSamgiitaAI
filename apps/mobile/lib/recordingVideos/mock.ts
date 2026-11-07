import { MAX_PER_MEMBER_PER_TARGET, MAX_PER_TARGET, cleanVideoTitle, parseVideoUrl } from "./rules"
import type { VideoFailure, VideoLink, VideoList, VideoReportReason, VideoTarget, VideosBackend } from "./types"

/**
 * The in-memory stand-in for the video links API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`). Nothing
 * here reaches a server and nothing survives a reload. It follows the real rules (the same parser, de-duplication,
 * the per-target and per-member caps, an anonymous link carries no author). The seed is made-up sample data.
 */
export class VideoMockFailure extends Error {
  readonly failure: VideoFailure
  constructor(failure: VideoFailure) {
    super(failure)
    this.name = "VideoMockFailure"
    this.failure = failure
  }
}

export function videoMockFailure(error: unknown): VideoFailure | null {
  return error instanceof VideoMockFailure ? error.failure : null
}

const keyOf = (target: VideoTarget) => `${target.kind}:${target.id}`

export function createVideosMock(options: { me: () => string; now?: () => number } = { me: () => "You" }): VideosBackend {
  const clock = options.now ?? Date.now
  const lists = new Map<string, VideoLink[]>()
  const reported = new Set<string>()
  let counter = 0
  const listFor = (target: VideoTarget): VideoLink[] => {
    const key = keyOf(target)
    let items = lists.get(key)
    if (!items) {
      counter += 1
      items = [
        {
          id: `mock-video-${counter}`,
          provider: "youtube",
          url: "https://www.youtube.com/watch?v=SampleId001",
          title: "Sample video for the preview",
          createdAt: new Date(clock() - 2 * 24 * 3_600_000).toISOString(),
          isAnonymous: false,
          author: { name: "Preview member", avatarUrl: null },
          mine: false,
          canRemove: false,
        },
      ]
      lists.set(key, items)
    }
    return items
  }
  const room = (items: VideoLink[]) => Math.max(0, MAX_PER_TARGET - items.length)
  return {
    async list(target): Promise<VideoList> {
      const items = [...listFor(target)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return { items, total: items.length, room: room(items) }
    },
    async add(target, draft) {
      const link = parseVideoUrl(draft.url)
      if (!link.ok) throw new VideoMockFailure(link.failure)
      const title = cleanVideoTitle(draft.title ?? "")
      if (!title.ok) throw new VideoMockFailure(title.failure)
      const items = listFor(target)
      if (items.some((v) => v.url === link.url)) throw new VideoMockFailure("duplicate")
      if (items.length >= MAX_PER_TARGET) throw new VideoMockFailure("targetFull")
      if (items.filter((v) => v.mine).length >= MAX_PER_MEMBER_PER_TARGET) throw new VideoMockFailure("memberFull")
      counter += 1
      const video: VideoLink = {
        id: `mock-video-${counter}`,
        provider: link.provider,
        url: link.url,
        title: title.title,
        createdAt: new Date(clock()).toISOString(),
        isAnonymous: draft.isAnonymous,
        author: draft.isAnonymous ? null : { name: options.me(), avatarUrl: null },
        mine: true,
        canRemove: false,
      }
      items.push(video)
      return video
    },
    async remove(videoId) {
      for (const items of lists.values()) {
        const at = items.findIndex((v) => v.id === videoId)
        if (at >= 0) {
          if (!items[at]?.mine) throw new VideoMockFailure("gone")
          items.splice(at, 1)
          return
        }
      }
      throw new VideoMockFailure("gone")
    },
    async report(videoId, _report: { reason: VideoReportReason }) {
      if (![...lists.values()].some((items) => items.some((v) => v.id === videoId))) throw new VideoMockFailure("gone")
      if (reported.has(videoId)) return { status: "already_reported" as const }
      reported.add(videoId)
      return { status: "received" as const }
    },
  }
}
