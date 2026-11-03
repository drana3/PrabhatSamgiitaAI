import type { ChatThread } from "@/stores/chatStore"

/** Threads that belong to one scope (a song, or null for the catalogue) and have messages. */
export function threadsForScope(threads: ChatThread[], songNumber: number | null): ChatThread[] {
  return threads
    .filter(
      (thread) =>
        thread.messages.length > 0 &&
        (typeof thread.songNumber === "number" ? thread.songNumber : null) === songNumber,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export type ThreadGroup = { key: string; label: string; threads: ChatThread[] }

function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const DAY_MS = 24 * 60 * 60 * 1000

export function dayLabel(ms: number, now: number): string {
  const diff = Math.round((startOfLocalDay(now) - startOfLocalDay(ms)) / DAY_MS)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  return new Date(ms).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/** Newest first, grouped by local calendar day. */
export function groupThreadsByDay(threads: ChatThread[], now: number): ThreadGroup[] {
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt)
  const groups: ThreadGroup[] = []
  for (const thread of sorted) {
    const key = String(startOfLocalDay(thread.updatedAt))
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.threads.push(thread)
    } else {
      groups.push({ key, label: dayLabel(thread.updatedAt, now), threads: [thread] })
    }
  }
  return groups
}

export function questionCount(thread: ChatThread): number {
  return thread.messages.filter((message) => message.role === "user").length
}

export function questionCountLabel(thread: ChatThread): string {
  const count = questionCount(thread)
  return count === 1 ? "1 question" : `${count} questions`
}
