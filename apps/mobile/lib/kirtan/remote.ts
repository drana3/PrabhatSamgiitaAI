import { fixKiirtanSpelling } from "@/lib/kirtan/kiirtanSpelling"
import { kindHasDance, kindHasDiscourse, kindHasLanguage } from "@/lib/kirtan/kind"
import { cleanLanguageOther, OTHER_LANGUAGE } from "@/lib/kirtan/languages"
import { cleanPractice } from "@/lib/kirtan/practice"
import { cleanInstrument } from "@/lib/kirtan/instruments"
import { cleanMantra } from "@/lib/kirtan/mantra"
import { cleanRecordingInfo, kindHasByAuthor } from "@/lib/kirtan/recordingInfo"
import { cleanMoods } from "@/lib/kirtan/moods"
import { cleanStyles } from "@/lib/kirtan/styles"
import type { ReportReason } from "@/lib/kirtan/rules"
import type { RecordingKind, UploadFailure } from "@/lib/kirtan/types"

/**
 * The phone's side of the recordings API (apps/api `/api/v1/recordings`, docs/kiirtan-publishing.md).
 * Plain `fetch`, no React: the base URL, the member headers and `fetch` itself are passed in, so tests run it
 * against a fake server. The default wiring (real base URL, signed-in member) is lib/kirtan/api.ts.
 */

export type RemoteConfig = {
  baseUrl: string
  /** member headers (X-Member-Proxy-Key and the principal); empty for a guest */
  headers: () => Record<string, string>
  fetch?: typeof fetch
}

/** `RecordingOut` of the API. */
export type RemoteRecording = {
  id: string
  kind: RecordingKind
  type: string
  title: string
  author: string
  added_by: string
  author_id: string | null
  by_author: boolean
  status: "published" | "removed" | "flagged"
  duration_sec: number | null
  /** Measured by the server (ffmpeg, EBU R128): integrated loudness in LUFS and true peak in dBTP; null/absent when not measured. */
  loudness_lufs?: number | null
  true_peak_db?: number | null
  /** null on a public author page whose owner hides the listening statistics */
  plays: number | null
  audio_url: string
  thumbnail_url: string | null
  published_at: string | null
  created_at: string
  removed_reason?: string | null
  removed_at?: string | null
  duplicate_of?: string | null
  year?: number | null
  /** an ISO code, `other` (then `language_other` names it) or an old word of the first form */
  language?: string | null
  language_other?: string | null
  /** the styles (listed ids) and the uploader's own style words, and the moods the same way; a stranger gets an own word only once the team accepted it */
  styles?: string[] | null
  styles_other?: string[] | null
  moods?: string[] | null
  moods_other?: string[] | null
  /** the first style as before the lists (`other` then names its word in `style_other`): older rows carry only this */
  style?: string | null
  style_other?: string | null
  /** Kiirtan only: "avarta" for an Avarta Kiirtan */
  practice?: string | null
  /** studio, live or ai (an old home reads as studio); slow, medium, fast or mix (Dance music); solo or group (lib/kirtan/recordingInfo.ts) */
  recording_type?: string | null
  tempo?: string | null
  performance?: string | null
  /** Others with type `other`: the name the author wrote (for its author, or everybody once the team accepted it: `type_other_checked`) */
  type_other?: string | null
  type_other_checked?: boolean
  /** the main instrument id or `other` (then `lead_instrument_other` is the word, for its author or once the team accepted it) */
  lead_instrument?: string | null
  lead_instrument_other?: string | null
  lead_instrument_checked?: boolean
  /** Dance music: tandava or kaoshiki */
  dance?: string | null
  /** the playlist from an event this is a track of, and its place there */
  collection_id?: string | null
  position?: number | null
  recorded_on?: string | null
  credits?: string | null
  notes?: string | null
  /** Baba's Audio Discourses: where it was given, and the name or number of the discourse */
  place?: string | null
  discourse?: string | null
  /** Prabhat Samgiita recordings: the number of the song (1 to 5018) */
  ps_song_number?: number | null
  /** owner only: the team removed this as a copy of that recording */
  removed_duplicate_of?: string | null
}

/** A recording the check found: `reasons` are the layers that matched (title, duration, sound), `duration_sec` its length (docs/duplicate-check.md). */
export type RemoteBrief = { id: string; kind: RecordingKind; title: string; author: string; audio_url: string; duration_sec?: number | null; reasons?: string[] }

export type UploadTarget = {
  key: string
  method: string
  url: string
  headers: Record<string, string>
  expires_at: string
  max_bytes: number
}

export type RemoteNotice = {
  id: string
  kind: string
  recording_id: string | null
  title: string
  body: string
  payload: Record<string, unknown>
  created_at: string
  read_at: string | null
}

/** An answer the server gave that is not a success. `similar` is set for the "a similar recording exists" warning. */
export class RemoteError extends Error {
  readonly status: number
  /** the API's `detail.code`, or the `X-Error-Code` header (for example `upload_daily_limit`) */
  readonly code: string | null
  readonly duplicateOf: RemoteBrief | null
  readonly similar: RemoteBrief[]

  constructor(status: number, message: string, extra: { code?: string | null; duplicateOf?: RemoteBrief | null; similar?: RemoteBrief[] } = {}) {
    super(message)
    this.name = "RemoteError"
    this.status = status
    this.code = extra.code ?? null
    this.duplicateOf = extra.duplicateOf ?? null
    this.similar = extra.similar ?? []
  }
}

/** The request never got an answer (offline, DNS, timeout). */
export class NetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message)
    this.name = "NetworkError"
  }
}

function join(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/api/v1/recordings${path}`
}

function doFetch(cfg: RemoteConfig): typeof fetch {
  return cfg.fetch ?? fetch
}

async function readError(response: Response): Promise<RemoteError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : null
  const headerCode = response.headers?.get?.("X-Error-Code") ?? null
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as { code?: string; message?: string; duplicate_of?: RemoteBrief | null; similar?: RemoteBrief[] }
    return new RemoteError(response.status, d.message ?? `Request failed (${response.status})`, {
      code: d.code ?? headerCode,
      duplicateOf: d.duplicate_of ?? null,
      similar: Array.isArray(d.similar) ? d.similar : [],
    })
  }
  if (typeof detail === "string" && detail) return new RemoteError(response.status, detail, { code: headerCode })
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string }
    return new RemoteError(response.status, first?.msg ?? `Request failed (${response.status})`)
  }
  return new RemoteError(response.status, `Request failed (${response.status})`)
}

async function call<T>(cfg: RemoteConfig, method: string, path: string, body?: unknown, fallback?: T): Promise<T> {
  return callUrl<T>(cfg, method, join(cfg.baseUrl, path), body, fallback)
}

/** The same request with the same error handling for any URL of the API (the playlists from an event use `/api/v1/recording-sets`). */
export async function callUrl<T>(cfg: RemoteConfig, method: string, url: string, body?: unknown, fallback?: T): Promise<T> {
  let response: Response
  try {
    response = await doFetch(cfg)(url, {
      method,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...cfg.headers() },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined)
  }
  if (!response.ok) throw await readError(response)
  if (response.status === 204) return fallback as T
  return (await response.json()) as T
}

/** The same, with a picture (or other file) as the body instead of JSON. */
export async function callBytes<T>(cfg: RemoteConfig, method: string, url: string, body: Blob, contentType: string): Promise<T> {
  let response: Response
  try {
    response = await doFetch(cfg)(url, { method, headers: { Accept: "application/json", "Content-Type": contentType, ...cfg.headers() }, body })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined)
  }
  if (!response.ok) throw await readError(response)
  return (await response.json()) as T
}

/* ------------------------------------------------------------------ upload */

export async function requestUpload(
  cfg: RemoteConfig,
  file: { fileName: string; contentType: string; sizeBytes: number; sha256?: string | null; collectionId?: string | null },
): Promise<UploadTarget> {
  return call<UploadTarget>(cfg, "POST", "/uploads", {
    file_name: file.fileName,
    content_type: file.contentType,
    size_bytes: file.sizeBytes,
    ...(file.sha256 ? { sha256: file.sha256 } : {}),
    // a track of a playlist is counted against the playlist allowance, not the single-upload one
    ...(file.collectionId ? { collection_id: file.collectionId } : {}),
  })
}

/** Step 2: the bytes go to the target (R2 directly, or the API itself in development). */
export async function putFile(cfg: RemoteConfig, target: UploadTarget, body: Blob, contentType: string): Promise<void> {
  let response: Response
  try {
    response = await doFetch(cfg)(target.url, {
      method: target.method || "PUT",
      headers: { "Content-Type": contentType, ...target.headers },
      body,
    })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined)
  }
  if (!response.ok) throw await readError(response)
}

export type PublishPayload = {
  key: string
  kind: RecordingKind
  type: string
  title: string
  author: string
  byAuthor: boolean
  termsVersion: string
  /** the author saw "sounds like a recording already in the library" and said theirs is a different performance */
  confirmDifferent: boolean
  year?: number | null
  language?: string | null
  /** the person's own name for the language, sent only with `language: "other"` */
  languageOther?: string | null
  /** the styles (listed ids) and the person's own style words, and the moods the same way */
  styles?: readonly string[] | null
  stylesOther?: readonly string[] | null
  moods?: readonly string[] | null
  moodsOther?: readonly string[] | null
  /** Kiirtan only: "avarta" marks an Avarta Kiirtan */
  practice?: string | null
  /** how it was recorded (required for a Kiirtan), the tempo and solo or group; each only for the kinds that carry it */
  recordingType?: string | null
  tempo?: string | null
  performance?: string | null
  /** the main instrument: an id or `other` (then `leadInstrumentOther` is the word, 2 to 40 characters); optional */
  leadInstrument?: string | null
  leadInstrumentOther?: string | null
  /** Others with type `other` (Something else): the name, 2 to 40 characters; the team checks it before strangers see it */
  typeOther?: string | null
  /** required for the Dance music kind, refused for the others */
  dance?: string | null
  /** a track of a playlist from an event, and its place there; kind, language and dance left out come from the playlist */
  collectionId?: string | null
  position?: number | null
  recordedOn?: string | null
  /** the live broadcast this is the recording of (its author and the team link it at once, anybody else suggests it) */
  broadcastId?: string | null
  credits?: string | null
  notes?: string | null
  /** where it was recorded or performed (every kind, optional); the discourse is Baba's Audio Discourses only */
  place?: string | null
  discourse?: string | null
  /** required for the Prabhat Samgiita kind, refused for the others */
  psSong?: number | null
  durationSec?: number | null
}

/** Step 3: the file is stored; publish. The recording is live the moment this returns. */
export async function publishRecording(cfg: RemoteConfig, payload: PublishPayload): Promise<RemoteRecording> {
  return call<RemoteRecording>(cfg, "POST", "", {
    key: payload.key,
    kind: payload.kind,
    type: payload.type,
    // "Kiirtan" with two i's once more, for a title that did not come through the form (a file name)
    title: fixKiirtanSpelling(payload.title),
    author: fixKiirtanSpelling(payload.author),
    by_author: payload.byAuthor && kindHasByAuthor(payload.kind),
    terms_accepted: true,
    terms_version: payload.termsVersion,
    confirm_different: payload.confirmDifferent,
    ...(payload.year ? { year: payload.year } : {}),
    ...(payload.language && kindHasLanguage(payload.kind) ? { language: payload.language } : {}),
    ...(payload.language === OTHER_LANGUAGE && kindHasLanguage(payload.kind) && cleanLanguageOther(payload.languageOther) ? { language_other: cleanLanguageOther(payload.languageOther) } : {}),
    ...(() => {
      const st = cleanStyles(payload.kind, payload.styles, payload.stylesOther)
      const mood = cleanMoods(payload.kind, payload.moods, payload.moodsOther)
      return {
        ...(st.styles.length ? { styles: st.styles } : {}),
        ...(st.stylesOther.length ? { styles_other: st.stylesOther } : {}),
        ...(mood.moods.length ? { moods: mood.moods } : {}),
        ...(mood.moodsOther.length ? { moods_other: mood.moodsOther } : {}),
      }
    })(),
    ...(cleanPractice(payload.kind, payload.practice) ? { practice: cleanPractice(payload.kind, payload.practice) } : {}),
    ...(() => {
      const info = cleanRecordingInfo(payload.kind, payload)
      return {
        ...(info.recordingType ? { recording_type: info.recordingType } : {}),
        ...(info.tempo ? { tempo: info.tempo } : {}),
        ...(info.performance ? { performance: info.performance } : {}),
      }
    })(),
    ...(() => {
      const instrument = cleanInstrument(payload.kind, payload.leadInstrument, payload.leadInstrumentOther)
      return instrument.instrument && !instrument.tooShort ? { lead_instrument: instrument.instrument, ...(instrument.instrumentOther ? { lead_instrument_other: instrument.instrumentOther } : {}) } : {}
    })(),
    ...(() => {
      const mantra = cleanMantra(payload.kind, payload.type, payload.typeOther)
      return mantra.typeOther ? { type: mantra.type ?? payload.type, type_other: mantra.typeOther } : {}
    })(),
    ...(payload.dance && kindHasDance(payload.kind) ? { dance: payload.dance } : {}),
    ...(payload.collectionId ? { collection_id: payload.collectionId, ...(payload.position ? { position: payload.position } : {}) } : {}),
    ...(payload.recordedOn ? { recorded_on: payload.recordedOn } : {}),
    ...(payload.broadcastId ? { broadcast_id: payload.broadcastId } : {}),
    ...(payload.credits?.trim() ? { credits: payload.credits.trim() } : {}),
    ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
    ...(payload.place?.trim() ? { place: fixKiirtanSpelling(payload.place.trim()) } : {}),
    ...(payload.discourse?.trim() && kindHasDiscourse(payload.kind) ? { discourse: payload.discourse.trim() } : {}),
    ...(payload.psSong ? { ps_song_number: payload.psSong } : {}),
    ...(payload.durationSec ? { duration_sec: Math.max(1, Math.round(payload.durationSec)) } : {}),
  })
}

/** Adds the language to a recording stored without one. Its uploader or the team; the server only adds, it never rewrites. */
export async function setRecordingLanguage(cfg: RemoteConfig, id: string, language: string, languageOther?: string): Promise<RemoteRecording> {
  const name = cleanLanguageOther(languageOther)
  return call<RemoteRecording>(cfg, "PATCH", `/${id}/language`, { language, ...(language === OTHER_LANGUAGE && name ? { language_other: name } : {}) })
}

/** Marks a Kiirtan as an Avarta Kiirtan (`"avarta"`) or clears the mark (`null`). Its uploader or the team. */
export async function setRecordingPractice(cfg: RemoteConfig, id: string, practice: string | null): Promise<RemoteRecording> {
  return call<RemoteRecording>(cfg, "PATCH", `/${id}/practice`, { practice })
}

/** The file reached the server but the author backed out: the stored file is deleted (an unpublished one only). */
export async function discardUpload(cfg: RemoteConfig, key: string): Promise<void> {
  await call<void>(cfg, "POST", "/uploads/discard", { key }, undefined)
}

/* ------------------------------------------------------------------ reading */

export async function fetchTermsVersion(cfg: RemoteConfig): Promise<string> {
  return (await call<{ version: string }>(cfg, "GET", "/terms")).version
}

export async function fetchPublished(cfg: RemoteConfig, query: { kind?: RecordingKind; songNumber?: number; authorId?: string; limit?: number } = {}): Promise<RemoteRecording[]> {
  const params = new URLSearchParams()
  if (query.kind) params.set("kind", query.kind)
  if (query.songNumber) params.set("song_number", String(query.songNumber))
  if (query.authorId) params.set("author_id", query.authorId)
  params.set("limit", String(query.limit ?? 100))
  return (await call<{ items: RemoteRecording[] }>(cfg, "GET", `?${params.toString()}`)).items
}

/** The words the team accepted under "Add your own" (a main instrument, a style or a mood), for the form to offer next to the fixed list. */
export type ValueOptions = { accepted: { key: string; label: string }[]; newWordsPerWeek: number }
export async function fetchValueOptions(cfg: RemoteConfig, field: "instrument" | "style" | "mood" | "mantra"): Promise<ValueOptions> {
  const out = await call<{ accepted: { key: string; label: string }[]; new_words_per_week: number }>(cfg, "GET", `/value-options?field=${field}`)
  return { accepted: out.accepted ?? [], newWordsPerWeek: out.new_words_per_week }
}

export async function fetchMine(cfg: RemoteConfig): Promise<RemoteRecording[]> {
  return (await call<{ items: RemoteRecording[] }>(cfg, "GET", "/mine")).items
}

/** Counts a play. Fire and forget: a failure is not worth telling the listener. */
export async function countPlay(cfg: RemoteConfig, id: string): Promise<void> {
  await call<void>(cfg, "POST", `/${id}/play`, undefined, undefined)
}

/* ------------------------------------------------------------------ safety */

export type ReportOutcome = { status: "received" | "already_reported"; message: string }

export async function sendReport(cfg: RemoteConfig, id: string, report: { reason: ReportReason; comment?: string }): Promise<ReportOutcome> {
  const comment = report.comment?.trim()
  return call<ReportOutcome>(cfg, "POST", `/${id}/report`, { reason: report.reason, ...(comment ? { comment } : {}) })
}

export async function fetchBlockedAuthors(cfg: RemoteConfig): Promise<string[]> {
  return (await call<{ author_ids: string[] }>(cfg, "GET", "/blocks")).author_ids
}

export async function blockAuthor(cfg: RemoteConfig, authorId: string): Promise<string[]> {
  return (await call<{ author_ids: string[] }>(cfg, "POST", "/blocks", { author_id: authorId })).author_ids
}

export async function unblockAuthor(cfg: RemoteConfig, authorId: string): Promise<string[]> {
  return (await call<{ author_ids: string[] }>(cfg, "DELETE", `/blocks/${authorId}`)).author_ids
}

export async function fetchNotices(cfg: RemoteConfig, unreadOnly = false): Promise<RemoteNotice[]> {
  return call<RemoteNotice[]>(cfg, "GET", unreadOnly ? "/notices?unread_only=true" : "/notices")
}

export async function markNoticeRead(cfg: RemoteConfig, id: string): Promise<void> {
  await call<RemoteNotice>(cfg, "POST", `/notices/${id}/read`, {})
}

/* ------------------------------------------------------------------ errors to the phone's words */

function withOriginal(failure: UploadFailure, brief: RemoteBrief | null): UploadFailure {
  return brief ? { ...failure, original: { id: brief.id, title: brief.title, author: brief.author, audioUrl: brief.audio_url } } : failure
}

/** What went wrong, as one of the codes the form knows (`lib/kirtan/rules.ts` has the sentence for each). */
export function failureFromError(error: unknown): UploadFailure {
  if (error instanceof NetworkError) return { code: "network" }
  if (error instanceof RemoteError) {
    if (error.status === 401 || error.status === 403) return { code: "signin" }
    if (error.code === "duplicate") return withOriginal({ code: "duplicate" }, error.duplicateOf)
    if (error.code === "own_duplicate") return withOriginal({ code: "ownDuplicate" }, error.duplicateOf)
    if (error.code === "removed_duplicate") return { code: "removedDuplicate" }
    if (error.code === "upload_daily_limit") return { code: "dailyLimit", message: error.message }
    if (error.code === "set_daily_limit") return { code: "setDailyLimit", message: error.message }
    if (error.code === "set_full") return { code: "setFull", message: error.message }
    if (error.status === 413) return { code: "size" }
    if (error.status === 415) return { code: "format" }
    if (error.status === 422 && /content rules/i.test(error.message)) return { code: "rules" }
    // the server refused for a missing language or dance (the form should have caught it first)
    if (error.status === 422 && /language|dance/i.test(error.message)) return { code: "fields", message: error.message }
    // the server refused a written word (a main instrument or style): the team did not accept it, or this person already brought three new ones this week
    if ((error.status === 422 && /word|instrument|style/i.test(error.message)) || (error.status === 429 && /new words/i.test(error.message))) return { code: "fields", message: error.message }
    if (error.status === 404 || error.status === 409) return { code: "gone", message: error.message }
    return { code: "server", message: error.message }
  }
  return { code: "server", message: error instanceof Error ? error.message : undefined }
}
