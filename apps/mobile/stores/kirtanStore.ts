import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { KIRTAN_DEMO_UPLOADS } from "@/lib/fixtures/kirtan"
import { KIRTAN_STORE_VERSION, migrateKirtanState } from "@/lib/kirtan/migrate"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import {
  addSubmission,
  buildSubmission,
  fromRemote,
  markFailed,
  markPublished,
  markPublishedLocal,
  mergeRemoteMine,
  newlyRemoved,
  retrySubmission,
  withdrawSubmission,
  withLanguage,
  type AddResult,
  type SubmissionInput,
} from "@/lib/kirtan/submissions"
import type { Kirtan, UploadFailure } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { uploadDecisionNotification } from "@/lib/notifications/serverKinds"
import { useNotificationsStore } from "@/stores/notificationsStore"

/**
 * Recordings of the four kinds (one list, a `kind` each) on this phone: what the person uploaded and where each one stands
 * (uploading, published, failed, removed), the recordings they saved, the ones they reported, and the authors
 * they blocked. An upload is published at once; the team looks afterwards (docs/kiirtan-publishing.md).
 * `catalog` is what the server publishes for everyone else; it is not stored (a removed recording must not linger).
 */
type KirtanState = {
  submissions: Kirtan[]
  savedIds: string[]
  reportedIds: string[]
  /** author ids the person blocked: their recordings are hidden here and the server is told */
  blockedAuthorIds: string[]
  /** the author's name at the time of blocking, by key (for the list of blocked authors) */
  blockedNames: Record<string, string>
  /** published recordings of other people, from the server; not persisted */
  catalog: Kirtan[]
  /** put the preview's own uploads in an empty store, once (MOCKUP_DATA only) */
  seedDemo: () => void
  submit: (input: SubmissionInput, now?: number) => AddResult
  /** the server accepted the upload */
  published: (id: string, remote: RemoteRecording) => void
  /** demo preview: published without a server, the file stays on this device */
  publishedLocally: (id: string) => void
  failed: (id: string, failure: UploadFailure) => void
  retry: (id: string) => void
  withdraw: (id: string) => void
  /** the language was added to a recording that had none (its own id or its server id) */
  languageAdded: (id: string, value: { language: string; languageOther?: string }) => void
  /** the server's list of the person's own uploads; a recording that was live and is now removed raises a notice */
  applyMine: (remote: readonly RemoteRecording[], now?: number) => void
  setCatalog: (remote: readonly RemoteRecording[]) => void
  /** recordings the catalogue may not hold yet (for example a version opened from a song page), so they can be queued and played */
  addToCatalog: (remote: readonly RemoteRecording[]) => void
  toggleSaved: (id: string) => boolean
  markReported: (id: string) => void
  setBlockedAuthors: (ids: readonly string[]) => void
  blockAuthor: (authorId: string, name?: string) => void
  unblockAuthor: (authorId: string) => void
  reset: () => void
}

const INITIAL = {
  submissions: [] as Kirtan[],
  savedIds: [] as string[],
  reportedIds: [] as string[],
  blockedAuthorIds: [] as string[],
  blockedNames: {} as Record<string, string>,
  catalog: [] as Kirtan[],
}

export const useKirtanStore = create<KirtanState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      seedDemo: () => {
        if (!MOCKUP_DATA || get().submissions.length) return
        set({ submissions: [...KIRTAN_DEMO_UPLOADS] })
      },
      submit: (input, now = Date.now()) => {
        const result = addSubmission(get().submissions, buildSubmission(input, now))
        if (result.added) set({ submissions: result.list })
        return result
      },
      published: (id, remote) => set({ submissions: markPublished(get().submissions, id, remote) }),
      publishedLocally: (id) => set({ submissions: markPublishedLocal(get().submissions, id) }),
      failed: (id, failure) => set({ submissions: markFailed(get().submissions, id, failure) }),
      retry: (id) => set({ submissions: retrySubmission(get().submissions, id) }),
      withdraw: (id) => set({ submissions: withdrawSubmission(get().submissions, id) }),
      languageAdded: (id, value) => {
        set({ submissions: withLanguage(get().submissions, id, value), catalog: withLanguage(get().catalog, id, value) })
      },
      applyMine: (remote, now = Date.now()) => {
        const before = get().submissions
        const after = mergeRemoteMine(before, remote)
        set({ submissions: after })
        const told = newlyRemoved(before, after).map((k) =>
          uploadDecisionNotification({ uploadId: k.serverId ?? k.id, kind: k.kind, title: k.title, decision: "removed", reason: k.removedReason, firedAt: k.removedAt ?? now }),
        )
        if (told.length) useNotificationsStore.getState().receive(told, now)
      },
      setCatalog: (remote) => set({ catalog: remote.filter((r) => r.status !== "removed").map((r) => fromRemote(r)) }),
      addToCatalog: (remote) => {
        const known = new Set(get().catalog.map((k) => k.serverId))
        const fresh = remote.filter((r) => r.status !== "removed" && !known.has(r.id)).map((r) => fromRemote(r))
        if (fresh.length) set({ catalog: [...get().catalog, ...fresh] })
      },
      toggleSaved: (id) => {
        const has = get().savedIds.includes(id)
        set({ savedIds: has ? get().savedIds.filter((s) => s !== id) : [...get().savedIds, id] })
        return !has
      },
      markReported: (id) => {
        if (!get().reportedIds.includes(id)) set({ reportedIds: [...get().reportedIds, id] })
      },
      setBlockedAuthors: (ids) => set({ blockedAuthorIds: Array.from(new Set([...get().blockedAuthorIds, ...ids])) }),
      blockAuthor: (authorId, name) => {
        const { blockedAuthorIds, blockedNames } = get()
        set({
          blockedAuthorIds: blockedAuthorIds.includes(authorId) ? blockedAuthorIds : [...blockedAuthorIds, authorId],
          blockedNames: name ? { ...blockedNames, [authorId]: name } : blockedNames,
        })
      },
      unblockAuthor: (authorId) => {
        const { [authorId]: _gone, ...names } = get().blockedNames
        set({ blockedAuthorIds: get().blockedAuthorIds.filter((id) => id !== authorId), blockedNames: names })
      },
      reset: () => set(INITIAL),
    }),
    {
      name: "prabhat-kirtan",
      storage: createJSONStorage(() => AsyncStorage),
      version: KIRTAN_STORE_VERSION,
      // v1 had no `kind`; v2 had the review statuses (approved/pending/rejected); v4 dropped the draft mantra fields: see lib/kirtan/migrate.ts.
      migrate: (persisted, version) => migrateKirtanState(persisted, version) as unknown as KirtanState,
      // An upload that was still running when the app closed is not running any more: it is saved as "not uploaded".
      partialize: (state) => ({
        submissions: state.submissions.map((k): Kirtan => (k.status === "uploading" ? { ...k, status: "failed", failure: { code: "network" } } : k)),
        savedIds: state.savedIds,
        reportedIds: state.reportedIds,
        blockedAuthorIds: state.blockedAuthorIds,
        blockedNames: state.blockedNames,
      }),
    },
  ),
)
