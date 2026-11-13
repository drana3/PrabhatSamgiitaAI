import type { RemoteBrief } from "@/lib/kirtan/remote"
import { validateAudioFile } from "@/lib/kirtan/rules"
import { AVARTA, cleanPractice } from "@/lib/kirtan/practice"
import { missingKindFields, type KindFields, type MissingField } from "@/lib/kirtan/uploadForm"
import type { DanceId, KirtanOriginal, RecordingKind, UploadFailure } from "@/lib/kirtan/types"

/**
 * The upload queue: many audio files of one kind sent one after another (docs/kiirtan-publishing.md, "Bulk upload").
 * Pure: the rows, their states and the loop that works through them. Nothing here knows React, the stores or the
 * network; the loop gets one `upload` function and one `patch` function (stores/uploadQueueStore.ts wires the real ones,
 * the tests wire fakes).
 *
 * A row can carry its OWN language and dance (the form's choices apply to every row that has none): a Spiritual song
 * row without a language, or a Dance music row without a dance, is "missing" and the queue will not send it
 * (`rowMissing`, `applyToAll` fills them all at once).
 *
 * A row goes: waiting -> uploading -> one of
 *   done       the recording is published
 *   duplicate  the same file (or the person's own copy) is already in the library
 *   similar    it sounds like a recording in the library; waits for the person's answer, the rest carries on
 *   limit      the daily limit stopped the queue; the row (and the waiting ones) stay for tomorrow
 *   failed     anything else; "Try again" puts it back to waiting
 */

export type QueueStatus = "waiting" | "uploading" | "done" | "duplicate" | "similar" | "limit" | "failed"

export type QueueItem = {
  id: string
  fileName: string
  /** a local uri, or a blob url in the browser */
  uri: string
  size: number | null
  type: string | null
  /** what the person may edit; the file name without its extension to begin with */
  title: string
  status: QueueStatus
  /** why a row is `failed` or `limit`, or which problem the file had when it was added */
  failure?: UploadFailure
  /** `duplicate`: the recording that is already there, when the server named it */
  original?: UploadFailure["original"]
  /** `similar`: the stored submission and the file on the server, so the answer can finish or cancel it */
  similar?: { submissionId: string; key: string; briefs: RemoteBrief[] }
  /** the submission of the phone's own list that this row became (`done`) */
  submissionId?: string
  /** this row's own language (an ISO code or "other"); undefined means the form's choice, null means none */
  language?: string | null
  languageOther?: string
  /** this row's own dance; undefined means the form's choice */
  dance?: DanceId | null
  /** Kiirtan only: this row's own practice ("avarta", or null for "no"); undefined means the form's tick for the whole queue */
  practice?: string | null
  /** this row's own type of recording; undefined means the form's choice (lib/kirtan/recordingInfo.ts) */
  recordingType?: string | null
}

export type PickedFile = { name: string; uri: string; size: number | null; type: string | null }

/** Why a queue run stopped before the end. */
export type QueueStop = "dailyLimit" | "signin" | null

/* ------------------------------------------------------------------ titles and rows */

/** `Morning_round_2.mp3` -> `Morning round 2`: the file name without its extension, underscores read as spaces. */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function sameFile(a: { fileName: string; size: number | null }, b: { name: string; size: number | null }): boolean {
  return a.fileName === b.name && a.size === b.size
}

/** A row for one picked file. A file the server could never take (not audio, too big) is `failed` at once, with its reason. */
export function makeQueueItem(file: PickedFile, id: string): QueueItem {
  const base: QueueItem = { id, fileName: file.name, uri: file.uri, size: file.size, type: file.type, title: titleFromFileName(file.name), status: "waiting" }
  const problem = validateAudioFile({ name: file.name, size: file.size, type: file.type })
  return problem ? { ...base, status: "failed", failure: { code: problem } } : base
}

/** Can this row be sent again? A file that is not audio or too big cannot: the person removes it. */
export function isRetryable(item: QueueItem): boolean {
  return item.status === "limit" || (item.status === "failed" && item.failure?.code !== "format" && item.failure?.code !== "size")
}

/**
 * Adds picked files to the queue. A file that is already in it (same name and size) is not added twice.
 * Returns the new list and how many files were left out for that reason.
 */
export function addFiles(items: readonly QueueItem[], files: readonly PickedFile[], newId: () => string): { items: QueueItem[]; added: number; skipped: number } {
  const next = [...items]
  let added = 0
  let skipped = 0
  for (const file of files) {
    if (next.some((item) => sameFile(item, file))) {
      skipped += 1
      continue
    }
    next.push(makeQueueItem(file, newId()))
    added += 1
  }
  return { items: next, added, skipped }
}

export function patchItem(items: readonly QueueItem[], id: string, patch: Partial<QueueItem>): QueueItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

export function setItemTitle(items: readonly QueueItem[], id: string, title: string): QueueItem[] {
  return patchItem(items, id, { title })
}

/** A row that is being sent cannot be removed; any other can. */
export function removeItem(items: readonly QueueItem[], id: string): QueueItem[] {
  return items.filter((item) => !(item.id === id && item.status !== "uploading"))
}

/** Puts a row that stopped back in line (and forgets why it stopped). */
export function requeue(items: readonly QueueItem[], id: string): QueueItem[] {
  return items.map((item) => {
    if (item.id !== id || !isRetryable(item)) return item
    const { failure: _failure, original: _original, ...rest } = item
    return { ...rest, status: "waiting" }
  })
}

/** Every row that can be sent again goes back in line. */
export function requeueAll(items: readonly QueueItem[]): QueueItem[] {
  return items.map((item) => (isRetryable(item) ? (requeue([item], item.id)[0] as QueueItem) : item))
}

/** After "Add more": the rows that are finished leave; the ones that still need the person stay. */
export function withoutFinished(items: readonly QueueItem[]): QueueItem[] {
  return items.filter((item) => item.status !== "done" && item.status !== "duplicate")
}

/* ------------------------------------------------------------------ language and dance per row */

/** The form's choices that every row without its own inherits. */
export type KindDefaults = { kind: RecordingKind; language: string | null; languageOther: string; dance: DanceId | null }

/** What a row will be sent with: its own language and dance, or else the form's. */
export function effectiveFields(item: QueueItem, defaults: KindDefaults): KindFields {
  const language = item.language !== undefined ? item.language : defaults.language
  return {
    kind: defaults.kind,
    language,
    languageOther: item.language !== undefined ? item.languageOther ?? "" : defaults.languageOther,
    dance: item.dance !== undefined ? item.dance : defaults.dance,
  }
}

/** What this row still needs before it can be sent (empty when it is complete). */
export function rowMissing(item: QueueItem, defaults: KindDefaults): MissingField[] {
  return missingKindFields(effectiveFields(item, defaults))
}

/** The rows that are waiting to be sent and still miss something; the list says what, row by row. */
export function incompleteRows(items: readonly QueueItem[], defaults: KindDefaults): { id: string; missing: MissingField[] }[] {
  return items.flatMap((item) => {
    if (item.status !== "waiting") return []
    const missing = rowMissing(item, defaults)
    return missing.length ? [{ id: item.id, missing }] : []
  })
}

/** How many waiting rows miss a language (or its name), a dance, and how many miss anything. */
export function missingCounts(items: readonly QueueItem[], defaults: KindDefaults): { language: number; dance: number; rows: number } {
  const incomplete = incompleteRows(items, defaults)
  return {
    language: incomplete.filter((row) => row.missing.includes("language") || row.missing.includes("languageName")).length,
    dance: incomplete.filter((row) => row.missing.includes("dance")).length,
    rows: incomplete.length,
  }
}

/** The practice a row will be sent with: its own choice, or else the tick of the whole form. Only a Kiirtan has one. */
export function effectivePractice(item: Pick<QueueItem, "practice">, kind: string, formPractice: string | null): string | null {
  if (kind !== "kiirtan") return null
  return cleanPractice(kind, item.practice !== undefined ? item.practice : formPractice)
}

/** How many of the rows still to send are Avarta Kiirtan, and how many rows that is in all. */
export function practiceCounts(items: readonly QueueItem[], kind: string, formPractice: string | null): { avarta: number; total: number } {
  const open = items.filter((item) => item.status === "waiting" || item.status === "limit" || item.status === "failed")
  return { avarta: open.filter((item) => effectivePractice(item, kind, formPractice) === AVARTA).length, total: open.length }
}

export type RowFieldsPatch = { language?: string | null; languageOther?: string; dance?: DanceId | null; practice?: string | null; recordingType?: string | null }

/** Sets one row's own language and/or dance. Choosing a language other than "other" forgets the name. */
export function setRowFields(items: readonly QueueItem[], id: string, patch: RowFieldsPatch): QueueItem[] {
  return items.map((item) => {
    if (item.id !== id || item.status === "uploading" || item.status === "done") return item
    const next: QueueItem = { ...item }
    if ("language" in patch) {
      next.language = patch.language
      next.languageOther = patch.language === "other" ? (patch.languageOther ?? item.languageOther ?? "") : undefined
    } else if ("languageOther" in patch) {
      next.languageOther = patch.languageOther
    }
    if ("dance" in patch) next.dance = patch.dance
    if ("practice" in patch) next.practice = patch.practice
    if ("recordingType" in patch) next.recordingType = patch.recordingType
    return next
  })
}

/**
 * The type changed: what a row said on its own about the OLD type (its language, dance, Avarta, type of recording) no longer
 * means anything, so every row that can still be sent follows the form again. The files stay (docs/kiirtan-publishing.md,
 * "Changing the type").
 */
export function withoutKindBoundChoices(items: readonly QueueItem[]): QueueItem[] {
  return items.map((item) => {
    if (item.status === "uploading" || item.status === "done" || item.status === "duplicate") return item
    const next: QueueItem = { ...item }
    delete next.language
    delete next.languageOther
    delete next.dance
    delete next.practice
    delete next.recordingType
    return next
  })
}

/**
 * Opening the Add screen: is there nothing here worth keeping? A queue that only holds files that were picked and never sent
 * (or nothing at all) is a leftover draft of an earlier visit, and it starts empty. A queue with a recording that is going up,
 * waits for an answer, hit the limit, failed or is done is shown as it is, so the person sees where it is.
 */
export function isLeftoverDraft(items: readonly QueueItem[], running: boolean): boolean {
  return !running && items.every((item) => item.status === "waiting")
}

/**
 * "Apply to all rows": gives every row that can still be sent (not uploading, done or already in the library) the
 * same language and/or dance. Rows that have their own value are overwritten: the person asked for all.
 */
export function applyToAll(items: readonly QueueItem[], patch: RowFieldsPatch): QueueItem[] {
  return items.map((item) => {
    if (item.status === "uploading" || item.status === "done" || item.status === "duplicate") return item
    return setRowFields([item], item.id, patch)[0] as QueueItem
  })
}

/* ------------------------------------------------------------------ counting */

export type QueueCounts = Record<QueueStatus, number> & { total: number }

export function queueCounts(items: readonly QueueItem[]): QueueCounts {
  const counts: QueueCounts = { waiting: 0, uploading: 0, done: 0, duplicate: 0, similar: 0, limit: 0, failed: 0, total: items.length }
  for (const item of items) counts[item.status] += 1
  return counts
}

/** Is a row still to be sent, or being sent? */
export function hasWork(items: readonly QueueItem[]): boolean {
  return items.some((item) => item.status === "waiting" || item.status === "uploading")
}

/** A file that could never be sent (not audio, too big) is not part of the progress. */
function isUnsendable(item: QueueItem): boolean {
  return item.status === "failed" && (item.failure?.code === "format" || item.failure?.code === "size")
}

/** 0 to 1: the share of sendable rows that are no longer waiting or uploading. Nothing to send is 0. */
export function queueProgress(items: readonly QueueItem[]): number {
  const sendable = items.filter((item) => !isUnsendable(item))
  if (!sendable.length) return 0
  const settled = sendable.filter((item) => item.status !== "waiting" && item.status !== "uploading").length
  return settled / sendable.length
}

/** "Daily limit reached, N files left for tomorrow": the files still to send after the limit stopped the queue. */
export function leftForTomorrow(items: readonly QueueItem[]): number {
  return items.filter((item) => item.status === "limit" || item.status === "waiting").length
}

export type QueueSummary = { uploaded: number; duplicates: number; needDecision: number; failed: number; left: number }

/** The end-of-run line: "12 uploaded, 2 already in the library, 1 needs your decision". Zero parts are left out by the screen. */
export function queueSummary(items: readonly QueueItem[]): QueueSummary {
  const counts = queueCounts(items)
  return { uploaded: counts.done, duplicates: counts.duplicate, needDecision: counts.similar, failed: counts.failed, left: counts.limit + counts.waiting }
}

/** The first row that is waiting; null when none is. */
export function nextWaiting(items: readonly QueueItem[]): QueueItem | null {
  return items.find((item) => item.status === "waiting") ?? null
}

/** The first waiting row without a title, or null: the form asks for it before it starts. */
export function firstUntitled(items: readonly QueueItem[]): QueueItem | null {
  return items.find((item) => item.status === "waiting" && !item.title.trim()) ?? null
}

/* ------------------------------------------------------------------ one answer to one row */

/** What the upload of one row came to; the same shapes as lib/kirtan/uploadRunner.ts `RunResult`. */
export type RowOutcome =
  | { status: "published" | "local"; submissionId?: string }
  | { status: "similar"; key: string; similar: RemoteBrief[]; submissionId: string }
  | { status: "failed"; failure: UploadFailure }

/** The patch a row gets from the answer, and whether the whole queue has to stop. */
export function applyOutcome(outcome: RowOutcome): { patch: Partial<QueueItem>; stop: QueueStop } {
  if (outcome.status === "published" || outcome.status === "local") {
    return { patch: { status: "done", failure: undefined, submissionId: outcome.submissionId }, stop: null }
  }
  if (outcome.status === "similar") {
    return { patch: { status: "similar", similar: { submissionId: outcome.submissionId, key: outcome.key, briefs: outcome.similar } }, stop: null }
  }
  if (outcome.status !== "failed") return { patch: { status: "failed" }, stop: null }
  const { failure } = outcome
  if (failure.code === "duplicate" || failure.code === "ownDuplicate") {
    return { patch: { status: "duplicate", failure, original: failure.original as (KirtanOriginal & { audioUrl: string }) | undefined }, stop: null }
  }
  if (failure.code === "dailyLimit" || failure.code === "setDailyLimit") return { patch: { status: "limit", failure }, stop: "dailyLimit" }
  if (failure.code === "signin") return { patch: { status: "failed", failure }, stop: "signin" }
  return { patch: { status: "failed", failure }, stop: null }
}

/* ------------------------------------------------------------------ the loop */

export type QueueRunnerDeps = {
  /** the rows as they are now (the person may add, edit or remove rows while it runs) */
  items: () => readonly QueueItem[]
  patch: (id: string, patch: Partial<QueueItem>) => void
  /** sends one row; never throws (a thrown error counts as a failed row) */
  upload: (item: QueueItem) => Promise<RowOutcome>
  /** a waiting row that is not ready (it still misses its language or dance) is passed over, not sent */
  ready?: (item: QueueItem) => boolean
}

/**
 * Works through the waiting rows one after another, in order, until none is left or something makes sending pointless
 * (the daily limit, or not being signed in). A row that failed does not stop the others. Rows added while it runs are
 * picked up. Returns why it stopped early, or null when it ran to the end.
 */
export async function runQueue(deps: QueueRunnerDeps): Promise<QueueStop> {
  for (;;) {
    const item = deps.items().find((row) => row.status === "waiting" && (deps.ready ? deps.ready(row) : true))
    if (!item) return null
    deps.patch(item.id, { status: "uploading", failure: undefined })
    let outcome: RowOutcome
    try {
      outcome = await deps.upload(item)
    } catch (error) {
      outcome = { status: "failed", failure: { code: "server", message: error instanceof Error ? error.message : undefined } }
    }
    const { patch, stop } = applyOutcome(outcome)
    deps.patch(item.id, patch)
    if (stop) return stop
  }
}
