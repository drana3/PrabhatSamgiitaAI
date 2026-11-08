import { kindHasChords } from "@/lib/kirtan/kind"
import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { failureFromError, RemoteError } from "@/lib/kirtan/remote"
import { createSet, deleteSet, finishSet, patchSet, patchTrackOnServer, putSetCover, removeTrackFromSet, reorderSet } from "@/lib/kirtan/remoteSets"
import type { RowOutcome } from "@/lib/kirtan/queue"
import { performerName, trackDay, trackFields, type SetDraft, type SetTrack } from "@/lib/kirtan/sets"
import { uploadSubmission } from "@/lib/kirtan/upload"
import type { UploadFailure } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"
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
  /** sends the cover picture of the set; the set stays whole when this fails */
  putCover: (draft: SetDraft) => Promise<void>
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
function sendTrackChords(track: SetTrack, kind: SetTrack["kind"], recordingId: string): void {
  // a Dance music and a Baba's Audio Discourse have no chords block: nothing typed on them before a type change goes up
  if (!kindHasChords(kind)) return
  void useRecordingChordsPendingStore.getState().flush(track.id, recordingId, track.title || track.fileName)
}

const realPorts: SetPorts = {
  online: () => MOCKUP_DATA || canUseServer(),
  async create(draft) {
    if (MOCKUP_DATA) return
    await createSet(remoteConfig(), {
      id: draft.id,
      title: draft.title,
      eventYear: draft.eventYear,
      eventMonth: draft.eventMonth,
      place: draft.place,
      defaultKind: draft.defaultKind,
      defaultLanguage: draft.defaultLanguage,
      defaultLanguageOther: draft.defaultLanguage === "other" ? draft.defaultLanguageOther : null,
      defaultDance: draft.defaultDance,
      tracksExpected: draft.tracks.length,
    })
  },
  async putCover(draft) {
    if (MOCKUP_DATA || !draft.coverUri) return
    // loaded only when a cover is sent: it needs the phone's image modules, which tests and the web preview do not carry
    const { coverBlob } = await import("@/lib/kirtan/setCoverPick")
    const { blob, type } = await coverBlob(draft.coverUri)
    await putSetCover(remoteConfig(), draft.id, blob, type)
  },
  async uploadTrack(draft, track, position) {
    if (MOCKUP_DATA) {
      await demoDelay(350)
      sendTrackChords(track, trackFields(track, draft).kind, `demo-${track.id}`)
      return { status: "published", recordingId: `demo-${track.id}` }
    }
    const fields = trackFields(track, draft)
    const outcome = await uploadSubmission(remoteConfig(), {
      uri: track.uri,
      fileName: track.fileName,
      fileType: track.type,
      kind: fields.kind,
      title: track.title,
      author: performerName(draft, useAuthStore.getState().displayName ?? ""),
      byAuthor: fields.byAuthor,
      language: fields.language,
      languageOther: fields.languageOther,
      dance: fields.dance,
      // the style belongs to a Kiirtan only; a track of another type sends none
      style: fields.kind === "kiirtan" ? draft.defaultStyle : null,
      styleOther: fields.kind === "kiirtan" ? draft.defaultStyleOther : null,
      practice: fields.practice,
      recordingType: fields.recordingType,
      tempo: fields.tempo,
      performance: fields.performance,
      leadInstrument: fields.leadInstrument,
      leadInstrumentOther: fields.leadInstrumentOther,
      collectionId: draft.id,
      position,
      recordedOn: trackDay(track, draft),
      termsVersion: useContentRulesStore.getState().version ?? undefined,
      confirmDifferent: track.similar ? true : undefined,
      key: track.similar?.key,
    })
    if (outcome.status === "published") {
      sendTrackChords(track, fields.kind, outcome.recording.id)
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
