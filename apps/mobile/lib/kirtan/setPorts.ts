import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { failureFromError, RemoteError } from "@/lib/kirtan/remote"
import { createSet, deleteSet, finishSet, patchSet, patchTrackOnServer, removeTrackFromSet, reorderSet } from "@/lib/kirtan/remoteSets"
import type { RowOutcome } from "@/lib/kirtan/queue"
import { trackDay, trackFields, type SetDraft, type SetTrack } from "@/lib/kirtan/sets"
import { uploadSubmission } from "@/lib/kirtan/upload"
import type { UploadFailure } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useContentRulesStore } from "@/stores/contentRulesStore"
import { useRecordingChordsPendingStore } from "@/stores/recordingChordsPendingStore"

/**
 * The calls the playlist store makes, behind one object so the store can be tested without a network
 * (stores/uploadSetStore.ts `setSetPorts`). The real ports talk to the API; in the demo preview (MOCKUP_DATA) there is
 * no server and every call succeeds on this device, so the whole flow can be tried (docs/kiirtan-sets.md, "Demo").
 */

export type TrackOutcome = RowOutcome & { recordingId?: string }

export type SetPorts = {
  /** can the build prove who the member is (and is there a server at all)? */
  online: () => boolean
  /** starts the playlist on the server; the same id twice is the same playlist */
  create: (draft: SetDraft) => Promise<void>
  /** sends one track at a place; never throws */
  uploadTrack: (draft: SetDraft, track: SetTrack, position: number) => Promise<TrackOutcome>
  /** the order of the live tracks */
  reorder: (draft: SetDraft, recordingIds: readonly string[]) => Promise<void>
  /** the last file was sent */
  finish: (draft: SetDraft) => Promise<void>
}

function demoDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** The chords typed on a track go to its recording once it is up (docs/recording-extras.md). Never throws, never changes the track's result. */
function sendTrackChords(track: SetTrack, recordingId: string): void {
  void useRecordingChordsPendingStore.getState().flush(track.id, recordingId, track.title || track.fileName)
}

const realPorts: SetPorts = {
  online: () => MOCKUP_DATA || canUseServer(),
  async create(draft) {
    if (MOCKUP_DATA) return
    await createSet(remoteConfig(), {
      id: draft.id,
      title: draft.title,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn || null,
      place: draft.place,
      description: draft.description,
      coverUrl: draft.coverUrl || null,
      defaultKind: draft.defaultKind,
      defaultLanguage: draft.defaultLanguage,
      defaultLanguageOther: draft.defaultLanguage === "other" ? draft.defaultLanguageOther : null,
      defaultDance: draft.defaultDance,
      tracksExpected: draft.tracks.length,
    })
  },
  async uploadTrack(draft, track, position) {
    if (MOCKUP_DATA) {
      await demoDelay(350)
      sendTrackChords(track, `demo-${track.id}`)
      return { status: "published", recordingId: `demo-${track.id}` }
    }
    const fields = trackFields(track, draft)
    const outcome = await uploadSubmission(remoteConfig(), {
      uri: track.uri,
      fileName: track.fileName,
      fileType: track.type,
      kind: fields.kind,
      title: track.title,
      author: draft.performer,
      byAuthor: false,
      language: fields.language,
      languageOther: fields.languageOther,
      dance: fields.dance,
      collectionId: draft.id,
      position,
      recordedOn: trackDay(track, draft),
      termsVersion: useContentRulesStore.getState().version ?? undefined,
      confirmDifferent: track.similar ? true : undefined,
      key: track.similar?.key,
    })
    if (outcome.status === "published") {
      sendTrackChords(track, outcome.recording.id)
      return { status: "published", recordingId: outcome.recording.id }
    }
    if (outcome.status === "similar") return { status: "similar", key: outcome.key, similar: outcome.similar, submissionId: track.id }
    return { status: "failed", failure: outcome.failure }
  },
  async reorder(draft, recordingIds) {
    if (MOCKUP_DATA || recordingIds.length < 2) return
    await reorderSet(remoteConfig(), draft.id, recordingIds)
  },
  async finish(draft) {
    if (MOCKUP_DATA) return
    await finishSet(remoteConfig(), draft.id)
  },
}

export function defaultSetPorts(): SetPorts {
  return realPorts
}

/** Why a playlist call failed, as one of the codes the screens have a sentence for (`uploadErrorText`). */
export function failureOf(error: unknown): UploadFailure {
  return failureFromError(error)
}

/** The server said "start fewer playlists today" (`set_start_limit`). */
export function isStartLimit(error: unknown): boolean {
  return error instanceof RemoteError && error.code === "set_start_limit"
}

/* ------------------------------------------------------------------ editing a playlist that is already up */

/** Renames or re-dates a playlist on the server. */
export async function savePatch(id: string, patch: Parameters<typeof patchSet>[2]): Promise<void> {
  if (MOCKUP_DATA) return
  await patchSet(remoteConfig(), id, patch)
}

export async function saveOrder(id: string, recordingIds: readonly string[]): Promise<void> {
  if (MOCKUP_DATA) return
  await reorderSet(remoteConfig(), id, recordingIds)
}

export async function saveTrackTitle(id: string, recordingId: string, title: string): Promise<void> {
  if (MOCKUP_DATA) return
  await patchTrackOnServer(remoteConfig(), id, recordingId, { title })
}

export async function dropTrack(id: string, recordingId: string): Promise<void> {
  if (MOCKUP_DATA) return
  await removeTrackFromSet(remoteConfig(), id, recordingId)
}

export async function dropSet(id: string, tracks: "keep" | "remove"): Promise<void> {
  if (MOCKUP_DATA) return
  await deleteSet(remoteConfig(), id, tracks)
}
