import { countChords, type Draft } from "./draft"

/**
 * The unfinished charts a member keeps on the phone. Not one draft but a small book: one per song and instrument (a
 * guitar chart and a harmonium chart of the same song are different work), one per chart being fixed after a
 * rejection, one per changed copy of a live chart. At most MAX_DRAFTS, the least recently touched one makes room.
 * Pure functions: the store (stores/chordDraftStore.ts) only holds the book and saves it.
 */
export type StoredDraft = { draft: Draft; updatedAt: number }
export type DraftBook = Record<string, StoredDraft>

export const MAX_DRAFTS = 5

export function draftKey(draft: Pick<Draft, "songId" | "instrument" | "editId" | "basedOn">): string {
  if (draft.editId) return `edit:${draft.editId}`
  if (draft.basedOn) return `copy:${draft.basedOn}`
  return `song:${draft.songId ?? 0}:${draft.instrument}`
}

/** A draft with no chord and no note is not work worth keeping (picking a song and leaving saves nothing). */
export function worthKeeping(draft: Draft): boolean {
  return countChords(draft) > 0 || draft.note.trim().length > 0
}

export function putDraft(book: DraftBook, draft: Draft, now: number): DraftBook {
  const key = draftKey(draft)
  const next: DraftBook = { ...book }
  if (!worthKeeping(draft)) {
    delete next[key]
    return next
  }
  next[key] = { draft, updatedAt: now }
  const keys = Object.keys(next)
  if (keys.length > MAX_DRAFTS) {
    const oldest = keys.filter((k) => k !== key).sort((a, b) => next[a].updatedAt - next[b].updatedAt)
    for (const drop of oldest.slice(0, keys.length - MAX_DRAFTS)) delete next[drop]
  }
  return next
}

export function removeDraft(book: DraftBook, key: string): DraftBook {
  if (!(key in book)) return book
  const next = { ...book }
  delete next[key]
  return next
}

export type DraftEntry = { key: string; draft: Draft; updatedAt: number; chords: number }

/** The drafts, most recently touched first. */
export function listDrafts(book: DraftBook): DraftEntry[] {
  return Object.entries(book)
    .map(([key, v]) => ({ key, draft: v.draft, updatedAt: v.updatedAt, chords: countChords(v.draft) }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Which drafts to offer when the screen opens. `edit` / `copy` (a chart being fixed) offer only that chart's draft;
 * `song` offers the drafts of that song; with nothing given, every draft is offered. An empty list means: start fresh.
 */
export function entryChoices(book: DraftBook, want: { song?: number | null; edit?: string | null; copy?: string | null }): DraftEntry[] {
  const all = listDrafts(book)
  if (want.edit) return all.filter((e) => e.key === `edit:${want.edit}`)
  if (want.copy) return all.filter((e) => e.key === `copy:${want.copy}`)
  const plain = all.filter((e) => !e.draft.editId && !e.draft.basedOn)
  if (want.song) return plain.filter((e) => e.draft.songId === want.song)
  return all
}

/** Version 1 kept a single `draft`; it becomes one entry (touched "now", we do not know better). */
export function migrateDrafts(saved: unknown, now: number): DraftBook {
  if (!saved || typeof saved !== "object") return {}
  const raw = saved as { drafts?: unknown; draft?: unknown }
  if (raw.drafts && typeof raw.drafts === "object") {
    const book: DraftBook = {}
    for (const [key, v] of Object.entries(raw.drafts as Record<string, unknown>)) {
      const entry = v as Partial<StoredDraft> | null
      if (entry && typeof entry === "object" && entry.draft && typeof entry.updatedAt === "number") book[key] = { draft: entry.draft, updatedAt: entry.updatedAt }
    }
    return book
  }
  const old = raw.draft as Draft | null | undefined
  if (old && typeof old === "object" && Array.isArray(old.lines) && worthKeeping(old)) return { [draftKey(old)]: { draft: old, updatedAt: now } }
  return {}
}

/** "2 hours ago" without words: the screens turn these into their own sentence. */
export function ageOf(updatedAt: number, now: number): { unit: "minutes" | "hours" | "days"; count: number } | "now" {
  const minutes = Math.max(0, Math.round((now - updatedAt) / 60_000))
  if (minutes < 1) return "now"
  if (minutes < 60) return { unit: "minutes", count: minutes }
  const hours = Math.round(minutes / 60)
  if (hours < 48) return { unit: "hours", count: hours }
  return { unit: "days", count: Math.round(hours / 24) }
}
