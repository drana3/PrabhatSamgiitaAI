import { cleanBroadcastText, cleanBroadcastTitle, DESCRIPTION_MAX, ORGANIZER_MAX, parseBroadcastLink } from "./rules"
import type { Broadcast, BroadcastDraft, BroadcastFailure, BroadcastList, BroadcastReportReason, BroadcastsBackend, BroadcastWhich } from "./types"

/**
 * The in-memory stand-in for the broadcasts API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`). Nothing here
 * reaches a server and nothing survives a reload. It follows the real rules (the same parser, the same checks of the
 * texts). The seed is made-up sample data on example addresses.
 */
export class BroadcastMockFailure extends Error {
  readonly failure: BroadcastFailure
  constructor(failure: BroadcastFailure) {
    super(failure)
    this.name = "BroadcastMockFailure"
    this.failure = failure
  }
}

export function broadcastMockFailure(error: unknown): BroadcastFailure | null {
  return error instanceof BroadcastMockFailure ? error.failure : null
}

const HOUR = 3_600_000
const ASSUMED = 6 * HOUR

export function createBroadcastsMock(options: { now?: () => number } = {}): BroadcastsBackend {
  const clock = options.now ?? Date.now
  let counter = 0
  const reported = new Set<string>()
  const make = (fields: Pick<Broadcast, "provider" | "url" | "host" | "title"> & Partial<Broadcast>, startMs: number | null, mine = false): Broadcast => {
    counter += 1
    const begin = startMs ?? clock()
    return {
      id: `mock-broadcast-${counter}`,
      description: null,
      organizer: null,
      startsAt: startMs === null ? null : new Date(startMs).toISOString(),
      timezone: startMs === null ? null : "Europe/Berlin",
      endsAt: new Date(begin + ASSUMED).toISOString(),
      phase: "now",
      archived: false,
      thumbnailUrl: null,
      linkStatus: "unknown",
      status: "published",
      mine,
      canEnd: mine,
      canRemove: false,
      createdAt: new Date(clock()).toISOString(),
      reportsCount: null,
      ...fields,
    }
  }
  const items: Broadcast[] = [
    make(
      { provider: "youtube", url: "https://www.youtube.com/watch?v=SampleId001", host: "youtube.com", title: "Evening Kiirtan, live from the sample ashram", organizer: "Sample Ashram", linkStatus: "ok", description: "Made-up sample data for the preview." },
      clock() - HOUR,
    ),
    make({ provider: "zoom", url: "https://us02web.zoom.us/j/81234567890", host: "us02web.zoom.us", title: "Sunday online satsang", organizer: "Sample Sangha" }, clock() + 20 * HOUR),
  ]
  const phased = (b: Broadcast): Broadcast => {
    const now = clock()
    const begin = b.startsAt ? Date.parse(b.startsAt) : Date.parse(b.createdAt)
    return { ...b, phase: now >= Date.parse(b.endsAt) ? "ended" : now < begin ? "upcoming" : "now" }
  }
  const page = (list: Broadcast[]): BroadcastList => ({ items: list.map(phased), total: list.length })
  const find = (id: string) => {
    const found = items.find((b) => b.id === id && b.status === "published")
    if (!found) throw new BroadcastMockFailure("gone")
    return found
  }
  return {
    async list(which: BroadcastWhich) {
      const week = 7 * 24 * HOUR
      const shown = items.map(phased).filter((b) => b.status === "published" && (b.phase !== "ended" || (which === "recent" && clock() - Date.parse(b.endsAt) < week)))
      return page(shown)
    },
    async mine() {
      return page(items.filter((b) => b.mine && b.status === "published"))
    },
    async get(id) {
      return phased(find(id))
    },
    async create(draft: BroadcastDraft) {
      const link = parseBroadcastLink(draft.url)
      if (!link.ok) throw new BroadcastMockFailure(link.failure)
      const title = cleanBroadcastTitle(draft.title)
      if (!title.ok) throw new BroadcastMockFailure(title.failure)
      const description = cleanBroadcastText(draft.description ?? "", DESCRIPTION_MAX)
      if (!description.ok) throw new BroadcastMockFailure(description.failure)
      const organizer = cleanBroadcastText(draft.organizer ?? "", ORGANIZER_MAX)
      if (!organizer.ok) throw new BroadcastMockFailure(organizer.failure)
      if (items.some((b) => b.url === link.url && b.status === "published" && phased(b).phase !== "ended")) throw new BroadcastMockFailure("duplicate")
      const start = draft.startsAt ? new Date(draft.startsAt).getTime() : null
      const made = make(
        { provider: link.provider, url: link.url, host: link.host, title: title.title, description: description.text, organizer: organizer.text, timezone: draft.timezone, linkStatus: link.provider === "youtube" ? "ok" : "unknown" },
        start,
        true,
      )
      items.push(made)
      return phased(made)
    },
    async end(id) {
      const found = find(id)
      if (!found.mine) throw new BroadcastMockFailure("gone")
      found.endsAt = new Date(clock()).toISOString()
      return phased(found)
    },
    async remove(id) {
      const found = find(id)
      if (!found.mine) throw new BroadcastMockFailure("gone")
      found.status = "removed"
    },
    async report(id, _report: { reason: BroadcastReportReason }) {
      find(id)
      if (reported.has(id)) return { status: "already_reported" as const }
      reported.add(id)
      return { status: "received" as const }
    },
  }
}
