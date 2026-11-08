import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { PickedFile, RowFieldsPatch } from "@/lib/kirtan/queue"
import { applyToAll as applyToAllRows } from "@/lib/kirtan/queue"
import { cancelSimilar } from "@/lib/kirtan/uploadRunner"
import { defaultSetPorts, failureOf, isStartLimit, type SetPorts } from "@/lib/kirtan/setPorts"
import {
  addTracks,
  isSettled,
  liveOrder,
  moveTrack,
  newSetDraft,
  nudgeTrack,
  patchTrack,
  removeTrack,
  restoreDraft,
  retryAllTracks,
  retryTrack,
  runSet,
  setCounts,
  setState,
  setTrackDay,
  setTrackFields,
  setTrackKind,
  setTrackTitle,
  sortByFileName,
  startBlock,
  type SetDraft,
  type SetTrack,
  type StartBlock,
} from "@/lib/kirtan/sets"
import type { RecordingKind, UploadFailure } from "@/lib/kirtan/types"

/**
 * The playlists the person is putting up (docs/kiirtan-sets.md). Unlike the single-file queue this store IS kept on
 * the phone: a concert has dozens of files and takes a while, so closing the app, losing the signal or running out of
 * battery in the middle must not lose the set. What is kept: the details, every track with its state, the order. What
 * is not: the run itself (`running`), which starts again when the person taps "Continue".
 *
 *   drafts    the sets still being made or sent, newest first
 *   archive   the last few that were published from this phone, so "My playlists" shows them even without a connection
 *
 * The network lives in `SetPorts` (lib/kirtan/setPorts.ts); tests give the store their own.
 */

/** Why a run ended early. `network`: no connection (the rest waits); `startLimit`: too many playlists today. */
export type SetStop = "dailyLimit" | "signin" | "network" | "startLimit" | "server" | null

type SetStoreState = {
  drafts: SetDraft[]
  archive: SetDraft[]
  running: string | null
  stopped: SetStop
  /** the sentence-worthy failure of the last create/finish call, when there was one */
  error: UploadFailure | null
  begin: (id?: string) => string
  discard: (id: string) => Promise<void>
  details: (id: string, patch: Partial<SetDraft>) => void
  addFiles: (id: string, files: readonly PickedFile[]) => { added: number; skipped: number; overLimit: number }
  move: (id: string, trackId: string, to: number) => void
  nudge: (id: string, trackId: string, step: -1 | 1) => void
  sortByName: (id: string) => void
  remove: (id: string, trackId: string) => void
  title: (id: string, trackId: string, title: string) => void
  day: (id: string, trackId: string, text: string) => void
  kind: (id: string, trackId: string, kind: RecordingKind | undefined) => void
  fields: (id: string, trackId: string, patch: RowFieldsPatch) => void
  /** the same language and/or dance for every track that can still be sent */
  applyToAll: (id: string, patch: RowFieldsPatch) => void
  confirm: (id: string, confirmed: boolean) => void
  /** the cover picture the person chose (a small local picture), or "" to take it away */
  cover: (id: string, uri: string) => void
  retry: (id: string, trackId: string) => Promise<void>
  retryAll: (id: string) => Promise<void>
  decideSimilar: (id: string, trackId: string, different: boolean) => Promise<void>
  /** sends the waiting tracks; returns why it did not start, if it did not */
  upload: (id: string) => Promise<StartBlock>
  /** the person is done with a published set: it moves to the archive */
  archiveDone: (id: string) => void
}

let counter = 0
const newId = () => `t-${Date.now().toString(36)}-${(counter += 1)}`

/** A v4-shaped id for the set (the server takes it as the set's id, so a create sent twice is the same playlist). */
export function newSetId(): string {
  const bytes = new Uint8Array(16)
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto
  if (cryptoObj?.getRandomValues) cryptoObj.getRandomValues(bytes)
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

let ports: SetPorts = defaultSetPorts()
/** Tests give the store a fake network; `null` puts the real one back. */
export function setSetPorts(next: SetPorts | null): void {
  ports = next ?? defaultSetPorts()
}

const ARCHIVE_KEEP = 20

export const useUploadSetStore = create<SetStoreState>()(
  persist(
    (set, get) => {
      const draftOf = (id: string) => get().drafts.find((draft) => draft.id === id)
      const update = (id: string, change: (draft: SetDraft) => SetDraft) => set({ drafts: get().drafts.map((draft) => (draft.id === id ? change(draft) : draft)) })

      /** After the last track settled: the live ones get their order, and a set with nothing left to do is finished. */
      const settle = async (id: string) => {
        const draft = draftOf(id)
        if (!draft || !draft.created) return
        const order = liveOrder(draft)
        if (order.length > 1) {
          try {
            await ports.reorder(draft, order)
          } catch {
            // the order is kept on the phone and sent again next time
          }
        }
        const counts = setCounts(draft)
        if (counts.live > 0 && isSettled(draft) && counts.limit === 0 && counts.failed === 0 && counts.similar === 0 && !draft.finished) {
          try {
            await ports.finish(draft)
            update(id, (d) => ({ ...d, finished: true }))
          } catch (error) {
            set({ error: failureOf(error) })
          }
        }
      }

      /** The cover goes up once, after the playlist exists; a failure never stops the tracks (it can be added later from the page). */
      const sendCover = async (id: string) => {
        const draft = draftOf(id)
        if (!draft || !draft.created || !draft.coverUri || draft.coverState === "sent") return
        try {
          await ports.putCover(draft)
          update(id, (d) => ({ ...d, coverState: "sent" }))
        } catch {
          update(id, (d) => ({ ...d, coverState: "failed" }))
        }
      }

      const run = async (id: string): Promise<StartBlock> => {
        const first = draftOf(id)
        if (!first || get().running) return null
        const block = startBlock(first)
        if (block) return block
        set({ running: id, stopped: null, error: null })
        try {
          if (!first.created) {
            try {
              await ports.create(first)
              update(id, (d) => ({ ...d, created: true }))
            } catch (error) {
              const failure = failureOf(error)
              set({ error: failure, stopped: isStartLimit(error) ? "startLimit" : failure.code === "network" ? "network" : failure.code === "signin" ? "signin" : "server" })
              return null
            }
          }
          await sendCover(id)
          const stop = await runSet({
            draft: () => draftOf(id) as SetDraft,
            patch: (trackId, patch) => update(id, (d) => patchTrack(d, trackId, patch)),
            upload: (track, position) => ports.uploadTrack(draftOf(id) as SetDraft, track, position),
          })
          set({ stopped: stop })
          await settle(id)
        } finally {
          set({ running: null })
        }
        return null
      }

      return {
        drafts: [],
        archive: [],
        running: null,
        stopped: null,
        error: null,
        begin: (id) => {
          const existing = id ? draftOf(id) : undefined
          if (existing) return existing.id
          const made = newSetDraft(id ?? newSetId())
          set({ drafts: [made, ...get().drafts] })
          return made.id
        },
        discard: async (id) => {
          const draft = draftOf(id)
          if (!draft || get().running === id) return
          // a similar-recording question leaves a file on the server: it goes with the set
          for (const track of draft.tracks) if (track.status === "similar" && track.similar) void cancelSimilar(track.similar.key)
          set({ drafts: get().drafts.filter((d) => d.id !== id) })
        },
        details: (id, patch) => update(id, (d) => ({ ...d, ...patch, tracks: d.tracks })),
        cover: (id, uri) => update(id, (d) => ({ ...d, coverUri: uri, coverState: uri ? "pending" : "none" })),
        addFiles: (id, files) => {
          const draft = draftOf(id)
          if (!draft) return { added: 0, skipped: 0, overLimit: 0 }
          const result = addTracks(draft, files, newId, false)
          update(id, () => result.draft)
          return { added: result.added, skipped: result.skipped, overLimit: result.overLimit }
        },
        move: (id, trackId, to) => update(id, (d) => ({ ...d, tracks: moveTrack(d.tracks, trackId, to) })),
        nudge: (id, trackId, step) => update(id, (d) => ({ ...d, tracks: nudgeTrack(d.tracks, trackId, step) })),
        sortByName: (id) => update(id, (d) => ({ ...d, tracks: sortByFileName(d.tracks) })),
        remove: (id, trackId) => {
          const draft = draftOf(id)
          const track = draft?.tracks.find((t) => t.id === trackId)
          if (!draft || !track || track.status === "uploading") return
          if (track.status === "similar" && track.similar) void cancelSimilar(track.similar.key)
          update(id, (d) => removeTrack(d, trackId))
          // removing the last failed track can finish the set
          void settle(id)
        },
        title: (id, trackId, title) => update(id, (d) => setTrackTitle(d, trackId, title)),
        day: (id, trackId, text) => update(id, (d) => setTrackDay(d, trackId, text)),
        kind: (id, trackId, kind) => update(id, (d) => setTrackKind(d, trackId, kind)),
        fields: (id, trackId, patch) => update(id, (d) => setTrackFields(d, trackId, patch)),
        applyToAll: (id, patch) => update(id, (d) => ({ ...d, tracks: applyToAllRows(d.tracks, patch) as SetTrack[] })),
        confirm: (id, confirmed) => update(id, (d) => ({ ...d, confirmed })),
        retry: async (id, trackId) => {
          update(id, (d) => ({ ...retryTrack(d, trackId), finished: false }))
          await run(id)
        },
        retryAll: async (id) => {
          update(id, (d) => ({ ...retryAllTracks(d), finished: false }))
          await run(id)
        },
        decideSimilar: async (id, trackId, different) => {
          const track = draftOf(id)?.tracks.find((t) => t.id === trackId)
          if (!track || track.status !== "similar" || !track.similar) return
          if (!different) {
            void cancelSimilar(track.similar.key)
            update(id, (d) => removeTrack(d, trackId))
            void settle(id)
            return
          }
          // "it is a different performance": back in line; the file that already reached the server is not sent again
          update(id, (d) => patchTrack(d, trackId, { status: "waiting" }))
          await run(id)
        },
        upload: run,
        archiveDone: (id) => {
          const draft = draftOf(id)
          if (!draft) return
          set({ drafts: get().drafts.filter((d) => d.id !== id), archive: [draft, ...get().archive.filter((d) => d.id !== id)].slice(0, ARCHIVE_KEEP) })
        },
      }
    },
    {
      name: "prabhat-upload-sets",
      storage: createJSONStorage(() => AsyncStorage),
      // 2: a playlist draft now holds the approximate date (year and month) and a cover instead of first and last day.
      // The drafts of version 1 were test uploads in the preview, so they go (docs/kiirtan-sets.md).
      // 3: a draft also holds how its Kiirtans were recorded, the tempo and solo or group (lib/kirtan/recordingInfo.ts).
      // Nothing to convert: `restoreDraft` fills the new fields, so the drafts of version 2 stay.
      // (The main instrument and the author tick came later still: `restoreDraft` fills them too, so the version stays 3.)
      version: 3,
      migrate: (persisted, fromVersion) => (fromVersion >= 2 ? (persisted as { drafts: never[]; archive: never[] }) : { drafts: [], archive: [] }),
      partialize: (state) => ({ drafts: state.drafts, archive: state.archive }),
      // the run never survives a restart: a track that was going goes back to waiting (lib/kirtan/sets.ts restoreDraft)
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Pick<SetStoreState, "drafts" | "archive">>
        return { ...current, drafts: (saved.drafts ?? []).map(restoreDraft), archive: (saved.archive ?? []).map(restoreDraft) }
      },
    },
  ),
)

/** The state of a draft for its card: draft, uploading or published. */
export function stateOfDraft(draft: SetDraft) {
  return setState(draft)
}
