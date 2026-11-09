import { cleanBroadcastText, cleanBroadcastTitle, DESCRIPTION_MAX, MAX_SPAN_DAYS, ORGANIZER_MAX, parseBroadcastLink, parseRecordingLink, ARCHIVE_AFTER_DAYS } from "./rules"
import type { Broadcast, BroadcastDraft, BroadcastFailure, BroadcastList, BroadcastRecording, BroadcastReportReason, BroadcastsBackend, BroadcastWhich } from "./types"

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
const DAY = 24 * HOUR
/** With no end given a broadcast is on until its organizer says "it is over", and ends by itself on day 14. */
const CAP = MAX_SPAN_DAYS * DAY
const MAX_ACCEPTED = 5

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
      endsAt: new Date(begin + CAP).toISOString(),
      endsDeclared: false,
      liveSource: "clock",
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
      hidden: null,
      recordings: [],
      recordingAction: null,
      ...fields,
    }
  }
  const items: Broadcast[] = [
    make(
      { provider: "youtube", url: "https://www.youtube.com/watch?v=SampleId001", host: "youtube.com", title: "Evening Kiirtan, live from the sample ashram", organizer: "Sample Ashram", linkStatus: "ok", description: "Made-up sample data for the preview." },
      clock() - HOUR,
    ),
    make(
      { provider: "zoom", url: "https://us02web.zoom.us/j/85550001111", host: "us02web.zoom.us", title: "Nine days of Kiirtan, online retreat", organizer: "Sample Sangha", endsDeclared: true, endsAt: new Date(clock() - 3 * DAY - HOUR + 9 * DAY).toISOString() },
      clock() - 3 * DAY - HOUR,
    ),
    make({ provider: "zoom", url: "https://us02web.zoom.us/j/81234567890", host: "us02web.zoom.us", title: "Sunday online satsang", organizer: "Sample Sangha" }, clock() + 20 * HOUR),
  ]
  const phased = (b: Broadcast): Broadcast => {
    const now = clock()
    const begin = b.startsAt ? Date.parse(b.startsAt) : Date.parse(b.createdAt)
    const phase = now >= Date.parse(b.endsAt) ? "ended" : now < begin ? "upcoming" : "now"
    const accepted = b.recordings.filter((r) => r.status === "accepted").length
    const action = phase !== "ended" || accepted >= MAX_ACCEPTED ? null : b.mine ? "add" : "suggest"
    return { ...b, phase, recordingAction: action }
  }
  // an ended broadcast with its recording, to show the block (it stays on the list for a week after the end)
  items.push(
    make(
      { provider: "youtube", url: "https://www.youtube.com/watch?v=SampleId002", host: "youtube.com", title: "Sunday satsang, last week", organizer: "Sample Sangha", linkStatus: "ok", endsDeclared: true, endsAt: new Date(clock() - 2 * DAY).toISOString() },
      clock() - 2 * DAY - 2 * HOUR,
    ),
  )
  items[items.length - 1]!.recordings = [
    { id: "mock-rec-1", kind: "link", provider: "youtube", url: "https://www.youtube.com/watch?v=SampleId002", host: "youtube.com", recordingId: null, recordingTitle: null, status: "accepted", source: "youtube", mine: false, createdAt: new Date(clock() - 2 * DAY).toISOString() },
  ]
  const page = (list: Broadcast[]): BroadcastList => ({ items: list.map(phased), total: list.length })
  const find = (id: string) => {
    const found = items.find((b) => b.id === id && b.status === "published")
    if (!found) throw new BroadcastMockFailure("gone")
    return found
  }
  return {
    async list(which: BroadcastWhich) {
      const week = ARCHIVE_AFTER_DAYS * DAY
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
      const end = draft.endsAt ? new Date(draft.endsAt).getTime() : null
      const begin = start ?? clock()
      if (end !== null && (end <= begin || end <= clock())) throw new BroadcastMockFailure(end <= clock() ? "endPast" : "endBeforeStart")
      if (end !== null && end > begin + CAP) throw new BroadcastMockFailure("endFar")
      const made = make(
        { provider: link.provider, url: link.url, host: link.host, title: title.title, description: description.text, organizer: organizer.text, timezone: draft.timezone, linkStatus: link.provider === "youtube" ? "ok" : "unknown", ...(end !== null ? { endsAt: new Date(end).toISOString(), endsDeclared: true } : {}) },
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
      found.endsDeclared = true
      return phased(found)
    },
    async remove(id) {
      const found = find(id)
      if (!found.mine) throw new BroadcastMockFailure("gone")
      found.status = "removed"
    },
    async addRecording(id, url) {
      const found = find(id)
      const shown = phased(found)
      if (shown.phase !== "ended") throw new BroadcastMockFailure("notEnded")
      const link = parseRecordingLink(url)
      if (!link.ok) throw new BroadcastMockFailure(link.failure)
      if (found.recordings.some((r) => r.url === link.url)) throw new BroadcastMockFailure("recordingDuplicate")
      if (found.recordings.filter((r) => r.status === "accepted").length >= MAX_ACCEPTED) throw new BroadcastMockFailure("recordingFull")
      counter += 1
      const added: BroadcastRecording = {
        id: `mock-recording-${counter}`,
        kind: "link",
        provider: link.provider,
        url: link.url,
        host: link.host,
        recordingId: null,
        recordingTitle: null,
        status: found.mine ? "accepted" : "pending",
        source: found.mine ? "author" : "member",
        mine: true,
        createdAt: new Date(clock()).toISOString(),
      }
      found.recordings = [...found.recordings, added]
      return added
    },
    async removeRecording(id, linkId) {
      const found = find(id)
      found.recordings = found.recordings.filter((r) => r.id !== linkId)
    },
    async report(id, _report: { reason: BroadcastReportReason }) {
      find(id)
      if (reported.has(id)) return { status: "already_reported" as const }
      reported.add(id)
      return { status: "received" as const }
    },
  }
}
