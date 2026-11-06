import { create } from "zustand"

import { addFiles, applyOutcome, patchItem, queueCounts, removeItem, requeue, requeueAll, runQueue, setItemTitle, withoutFinished, type PickedFile, type QueueItem, type QueueStop, type RowOutcome } from "@/lib/kirtan/queue"
import { validateSubmission } from "@/lib/kirtan/submissions"
import type { RecordingKind, RecordingLanguage } from "@/lib/kirtan/types"
import { cancelSimilar, runUpload } from "@/lib/kirtan/uploadRunner"
import { useKirtanStore } from "@/stores/kirtanStore"

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
  credits: string
  year: string
  notes: string
  /** Prabhat Samgiita: the song this is a performance of */
  psSong: { number: number; title: string } | null
  byAuthor: boolean
}

export const EMPTY_DRAFT: QueueDraft = { kind: "kiirtan", performer: "", language: null, credits: "", year: "", notes: "", psSong: null, byAuthor: false }

type QueueState = {
  items: QueueItem[]
  draft: QueueDraft
  running: boolean
  /** why the last run ended early (the daily limit, or not being signed in); null otherwise */
  stopped: QueueStop
  setDraft: (patch: Partial<QueueDraft>) => void
  addFiles: (files: readonly PickedFile[]) => { added: number; skipped: number }
  setTitle: (id: string, title: string) => void
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

function outcomeOf(result: Awaited<ReturnType<typeof runUpload>>, submissionId: string): RowOutcome {
  if (result.status === "similar") return { status: "similar", key: result.key, similar: result.similar, submissionId }
  if (result.status === "failed") return { status: "failed", failure: result.failure }
  return { status: "published", submissionId }
}

export const useUploadQueueStore = create<QueueState>()((set, get) => {
  const patch = (id: string, change: Partial<QueueItem>) => set({ items: patchItem(get().items, id, change) })

  /** Sends one row: it becomes a submission of the kirtan store, then goes up. */
  const sendOne = async (item: QueueItem): Promise<RowOutcome> => {
    const { draft } = get()
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
      language: draft.language,
      credits: draft.credits,
      notes: draft.notes,
      psSong: draft.psSong?.number ?? null,
    }
    if (validateSubmission(input)) return { status: "failed", failure: { code: "gone" } }
    const added = useKirtanStore.getState().submit(input).added
    if (!added) return { status: "failed", failure: { code: "gone" } }
    const result = await runUpload(added.id)
    // A row that failed lives in the queue (with "Try again"), not in the person's list.
    if (result.status === "failed") useKirtanStore.getState().withdraw(added.id)
    return outcomeOf(result, added.id)
  }

  const run = async () => {
    if (get().running) return
    // rows the daily limit stopped yesterday go back in line (the server decides whether today has room)
    set({ items: get().items.map((item) => (item.status === "limit" ? (requeue([item], item.id)[0] as QueueItem) : item)) })
    set({ running: true, stopped: null })
    let stopped: QueueStop = null
    try {
      stopped = await runQueue({ items: () => get().items, patch, upload: sendOne })
    } finally {
      set({ running: false, stopped })
    }
  }

  return {
    items: [],
    draft: EMPTY_DRAFT,
    running: false,
    stopped: null,
    setDraft: (change) => set({ draft: { ...get().draft, ...change } }),
    addFiles: (files) => {
      const result = addFiles(get().items, files, newId)
      set({ items: result.items })
      return { added: result.added, skipped: result.skipped }
    },
    setTitle: (id, title) => set({ items: setItemTitle(get().items, id, title) }),
    remove: (id) => {
      const row = get().items.find((item) => item.id === id)
      // a row that waits for the answer to "is it different?" has a file on the server: it goes with the row
      if (row?.status === "similar" && row.similar) {
        void cancelSimilar(row.similar.key)
        useKirtanStore.getState().withdraw(row.similar.submissionId)
      }
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
    },
    clearFinished: () => set({ items: withoutFinished(get().items), stopped: null }),
    reset: () => set({ items: [], draft: EMPTY_DRAFT, running: false, stopped: null }),
  }
})

/** Is the queue busy, and with what: the numbers the form and the Kiirtan tab show. */
export function selectQueueCounts(state: Pick<QueueState, "items">) {
  return queueCounts(state.items)
}
