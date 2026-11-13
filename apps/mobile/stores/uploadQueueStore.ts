import { create } from "zustand"

import { addFiles, applyOutcome, applyToAll, effectiveFields, effectivePractice, incompleteRows, isLeftoverDraft, patchItem, queueCounts, removeItem, requeue, requeueAll, rowMissing, runQueue, setItemTitle, setRowFields, withoutFinished, withoutKindBoundChoices, type KindDefaults, type PickedFile, type QueueItem, type QueueStop, type RowFieldsPatch, type RowOutcome } from "@/lib/kirtan/queue"
import { draftWithPatch } from "@/lib/kirtan/uploadForm"
import { validateSubmission } from "@/lib/kirtan/submissions"
import { kindHasChords, kindHasLanguage } from "@/lib/kirtan/kind"
import { effectiveRecordingType } from "@/lib/kirtan/recordingInfo"
import type { DanceId, RecordingKind, RecordingLanguage } from "@/lib/kirtan/types"
import { cancelSimilar, runUpload } from "@/lib/kirtan/uploadRunner"
import { fixKiirtanSpelling, fixKiirtanSpellingIn } from "@/lib/kirtan/kiirtanSpelling"
import { useKirtanStore } from "@/stores/kirtanStore"
import { flushFormExtras, forgetFormExtras } from "@/lib/kirtan/formExtras"
import { useRecordingChordsPendingStore } from "@/stores/recordingChordsPendingStore"

/**
 * The bulk-upload form and its queue, kept in memory for as long as the app is open: leaving the Add screen does
 * not stop the uploads, and coming back shows where they are (docs/kiirtan-publishing.md, "Bulk upload"). Nothing
 * is persisted: a recording that was still going when the app closed is saved as "not uploaded" by the kirtan store,
 * and the person picks the file again.
 *
 * The choices at the top of the form (type, performer, language, ...) apply to every row; a row has its own title.
 * Each row becomes one submission of the kirtan store and goes through the same `runUpload` as a single file always did.
 */

export type QueueDraft = {
  kind: RecordingKind
  performer: string
  language: RecordingLanguage | null
  /** the person's own name for the language, when `language` is "other" */
  languageOther: string
  /** Dance music: Tandava or Kaoshiki */
  dance: DanceId | null
  credits: string
  /** where it was recorded or performed (every kind, optional), and Baba's Audio Discourses: the name or number of the discourse */
  place: string
  discourse: string
  year: string
  notes: string
  /** Prabhat Samgiita: the song this is a performance of */
  psSong: { number: number; title: string } | null
  /** the styles (ids) and the person's own style words, REQUIRED for a Kiirtan, optional for the kinds that keep one; and the moods the same way (apply to every row) */
  styles: string[]
  stylesOther: string[]
  moods: string[]
  moodsOther: string[]
  /** Kiirtan only, optional: "avarta" marks the whole queue as Avarta Kiirtan; a row may say otherwise (QueueItem.practice) */
  practice: string | null
  /** how it was recorded (REQUIRED for a Kiirtan), the tempo, solo or group: lib/kirtan/recordingInfo.ts; a row may say another type (QueueItem.recordingType) */
  recordingType: string | null
  tempo: string | null
  performance: string | null
  /** the main instrument (an id or "other" with its word): lib/kirtan/instruments.ts; optional */
  leadInstrument: string | null
  leadInstrumentOther: string
  byAuthor: boolean
  /** "I perform or play on this recording": kept on the form only (the API has no field for it); it fills the performer line with the person's own name (lib/kirtan/uploadChords.ts performsPatch) */
  performs: boolean
  /** Others: which one it is (null until chosen: there is no default; "other" = Something else); no other kind has it */
  mantraType: string | null
  /** Others, "Something else": the name the person wrote (2 to 40 characters, the team checks it) */
  mantraOther: string
}

export const EMPTY_DRAFT: QueueDraft = { kind: "kiirtan", performer: "", language: null, languageOther: "", dance: null, credits: "", place: "", discourse: "", year: "", notes: "", psSong: null, styles: [], stylesOther: [], moods: [], moodsOther: [], practice: null, recordingType: null, tempo: null, performance: null, leadInstrument: null, leadInstrumentOther: "", byAuthor: false, performs: false, mantraType: null, mantraOther: "" }

type QueueState = {
  items: QueueItem[]
  draft: QueueDraft
  running: boolean
  /** why the last run ended early (the daily limit, or not being signed in); null otherwise */
  stopped: QueueStop
  /** the live broadcast the files being added are the recording of (docs/broadcasts.md); null for an ordinary upload */
  forBroadcast: { id: string; title: string } | null
  setBroadcast: (target: { id: string; title: string } | null) => void
  setDraft: (patch: Partial<QueueDraft>) => void
  /** the Add screen was opened: files left over from an earlier visit that was never sent are dropped; a queue that has work in it stays */
  openFresh: () => void
  addFiles: (files: readonly PickedFile[]) => { added: number; skipped: number }
  setTitle: (id: string, title: string) => void
  /** one row's own language and/or dance */
  setRowFields: (id: string, patch: RowFieldsPatch) => void
  /** the same language and/or dance for every row that can still be sent ("Apply to all rows") */
  applyToAll: (patch: RowFieldsPatch) => void
  remove: (id: string) => void
  /** begins (or carries on with) the waiting rows; does nothing while a run is going */
  start: () => Promise<void>
  retry: (id: string) => Promise<void>
  retryAll: () => Promise<void>
  /** the answer to "is this a different performance?" for one row */
  decideSimilar: (id: string, different: boolean) => Promise<void>
  /** after a finished run: the done rows leave, the ones that still need the person stay */
  clearFinished: () => void
  reset: () => void
}

let counter = 0
const newId = () => `q-${Date.now().toString(36)}-${(counter += 1)}`

/** The year the person typed as a number, or null (empty or not a number). */
export function yearOf(text: string): number | null {
  const digits = text.trim()
  return /^\d{4}$/.test(digits) ? Number(digits) : null
}

/** The form's choices that rows without their own inherit. */
export function defaultsOf(draft: QueueDraft): KindDefaults {
  return { kind: draft.kind, language: draft.language, languageOther: draft.languageOther, dance: draft.dance }
}

function outcomeOf(result: Awaited<ReturnType<typeof runUpload>>, submissionId: string): RowOutcome {
  if (result.status === "similar") return { status: "similar", key: result.key, similar: result.similar, submissionId }
  if (result.status === "failed") return { status: "failed", failure: result.failure }
  return { status: "published", submissionId }
}

/** The chords typed on a row go to the recording once it is up (docs/recording-extras.md). Never throws, never changes the upload's result. */
function sendChords(rowKey: string, submissionId: string, title: string, first = false): void {
  const mine = useKirtanStore.getState().submissions.find((k) => k.id === submissionId)
  const recordingId = mine?.serverId ?? submissionId
  void useRecordingChordsPendingStore.getState().flush(rowKey, recordingId, title)
  // the chords and piano notes typed on the form itself belong to the FIRST file (lib/kirtan/uploadChords.ts)
  if (first) flushFormExtras(recordingId, title)
}

export const useUploadQueueStore = create<QueueState>()((set, get) => {
  const patch = (id: string, change: Partial<QueueItem>) => set({ items: patchItem(get().items, id, change) })

  /** Sends one row: it becomes a submission of the kirtan store, then goes up. */
  const sendOne = async (item: QueueItem): Promise<RowOutcome> => {
    const { draft } = get()
    const fields = effectiveFields(item, defaultsOf(draft))
    const input = {
      kind: draft.kind,
      fileName: item.fileName,
      fileUri: item.uri,
      fileSize: item.size,
      fileType: item.type,
      title: item.title,
      author: draft.performer,
      byAuthor: draft.byAuthor,
      addedBy: "You",
      termsAccepted: true,
      year: yearOf(draft.year),
      language: kindHasLanguage(draft.kind) ? fields.language : null,
      languageOther: kindHasLanguage(draft.kind) ? fields.languageOther : null,
      dance: fields.dance,
      credits: draft.credits,
      place: draft.place,
      discourse: draft.discourse,
      notes: draft.notes,
      psSong: draft.psSong?.number ?? null,
      styles: draft.styles,
      stylesOther: draft.stylesOther,
      moods: draft.moods,
      moodsOther: draft.moodsOther,
      practice: effectivePractice(item, draft.kind, draft.practice),
      recordingType: effectiveRecordingType(item.recordingType, draft.recordingType, draft.kind),
      tempo: draft.tempo,
      performance: draft.performance,
      leadInstrument: draft.leadInstrument,
      leadInstrumentOther: draft.leadInstrumentOther,
      mantraType: draft.kind === "other_mantra" ? draft.mantraType : null,
      mantraOther: draft.kind === "other_mantra" ? draft.mantraOther : "",
      broadcastId: get().forBroadcast?.id ?? null,
    }
    if (validateSubmission(input)) return { status: "failed", failure: { code: "gone" } }
    const added = useKirtanStore.getState().submit(input).added
    if (!added) return { status: "failed", failure: { code: "gone" } }
    const result = await runUpload(added.id)
    // A row that failed lives in the queue (with "Try again"), not in the person's list.
    if (result.status === "failed") useKirtanStore.getState().withdraw(added.id)
    const outcome = outcomeOf(result, added.id)
    if (outcome.status === "published" && kindHasChords(draft.kind)) sendChords(item.id, added.id, item.title || item.fileName, get().items[0]?.id === item.id)
    return outcome
  }

  const run = async () => {
    if (get().running) return
    // rows the daily limit stopped yesterday go back in line (the server decides whether today has room)
    set({ items: get().items.map((item) => (item.status === "limit" ? (requeue([item], item.id)[0] as QueueItem) : item)) })
    set({ running: true, stopped: null })
    let stopped: QueueStop = null
    try {
      // a row that still misses its language or dance is passed over: the list marks it and "Upload" waits for it
      stopped = await runQueue({ items: () => get().items, patch, upload: sendOne, ready: (item) => rowMissing(item, defaultsOf(get().draft)).length === 0 })
    } finally {
      set({ running: false, stopped })
    }
  }

  return {
    items: [],
    draft: EMPTY_DRAFT,
    running: false,
    stopped: null,
    forBroadcast: null,
    // a run that is going keeps the target it started with
    setBroadcast: (target) => {
      if (!get().running) set({ forBroadcast: target })
    },
    // the type decides which optional fields exist: changing it clears the ones the new type does not have
    // The picked files stay when the type changes (they are the same files); what the old type's fields and rows said does not.
    setDraft: (change) => {
      const before = get().draft
      const draft = draftWithPatch(before, fixKiirtanSpellingIn(change, ["performer", "place", "discourse", "credits"]))
      set({ draft, ...(draft.kind !== before.kind ? { items: withoutKindBoundChoices(get().items) } : {}) })
    },
    openFresh: () => {
      const { items, running } = get()
      if (!isLeftoverDraft(items, running)) return
      for (const item of items) useRecordingChordsPendingStore.getState().forget(item.id)
      forgetFormExtras()
      set({ items: [], draft: EMPTY_DRAFT, stopped: null })
    },
    addFiles: (files) => {
      const result = addFiles(get().items, files, newId)
      set({ items: result.items })
      return { added: result.added, skipped: result.skipped }
    },
    setTitle: (id, title) => set({ items: setItemTitle(get().items, id, fixKiirtanSpelling(title)) }),
    setRowFields: (id, change) => set({ items: setRowFields(get().items, id, change) }),
    applyToAll: (change) => set({ items: applyToAll(get().items, change) }),
    remove: (id) => {
      const row = get().items.find((item) => item.id === id)
      // a row that waits for the answer to "is it different?" has a file on the server: it goes with the row
      if (row?.status === "similar" && row.similar) {
        void cancelSimilar(row.similar.key)
        useKirtanStore.getState().withdraw(row.similar.submissionId)
      }
      useRecordingChordsPendingStore.getState().forget(id)
      set({ items: removeItem(get().items, id) })
    },
    start: run,
    retry: async (id) => {
      set({ items: requeue(get().items, id), stopped: null })
      await run()
    },
    retryAll: async () => {
      set({ items: requeueAll(get().items), stopped: null })
      await run()
    },
    decideSimilar: async (id, different) => {
      const row = get().items.find((item) => item.id === id)
      if (!row || row.status !== "similar" || !row.similar) return
      const { key, submissionId } = row.similar
      if (!different) {
        // "Cancel": the file that already reached the server is deleted and the row leaves
        void cancelSimilar(key)
        useKirtanStore.getState().withdraw(submissionId)
        set({ items: removeItem(get().items, id) })
        return
      }
      patch(id, { status: "uploading", similar: undefined })
      const result = await runUpload(submissionId, { confirmDifferent: true, key })
      if (result.status === "failed") useKirtanStore.getState().withdraw(submissionId)
      const outcome = outcomeOf(result, submissionId)
      patch(id, applyOutcome(outcome).patch)
      if (outcome.status === "published" && kindHasChords(get().draft.kind)) sendChords(id, submissionId, row.title || row.fileName, get().items[0]?.id === id)
    },
    clearFinished: () => {
      // a new batch starts without the old batch's chords: their "sent" lines would otherwise stop the next ones from going
      forgetFormExtras()
      set({ items: withoutFinished(get().items), stopped: null })
    },
    reset: () => {
      forgetFormExtras()
      set({ items: [], draft: EMPTY_DRAFT, running: false, stopped: null, forBroadcast: null })
    },
  }
})

/** The waiting rows that still miss a language or a dance (empty when every row can be sent). */
export function selectIncompleteRows(state: Pick<QueueState, "items" | "draft">) {
  return incompleteRows(state.items, defaultsOf(state.draft))
}

/** Is the queue busy, and with what: the numbers the form and the Kiirtan tab show. */
export function selectQueueCounts(state: Pick<QueueState, "items">) {
  return queueCounts(state.items)
}
