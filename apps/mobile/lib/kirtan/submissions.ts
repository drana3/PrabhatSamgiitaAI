import { cleanInstrument } from "@/lib/kirtan/instruments"
import { kindHasDance, kindHasDiscourse, kindHasLanguage, kindHasPerformer, normalizeKind } from "@/lib/kirtan/kind"
import { cleanLanguageOther, normalizeLanguageCode, OTHER_LANGUAGE } from "@/lib/kirtan/languages"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import { cleanPractice } from "@/lib/kirtan/practice"
import { AI_TYPE, cleanRecordingInfo, kindAllowsAi, kindHasByAuthor, kindHasRecordingType, performanceMissing, recordingTypeMissing, titleNeedsEnglish } from "@/lib/kirtan/recordingInfo"
import { fixKiirtanSpelling } from "@/lib/kirtan/kiirtanSpelling"
import { cleanMoods } from "@/lib/kirtan/moods"
import { cleanStyles, stylesOfRecord } from "@/lib/kirtan/styles"
import { validateAudioFile, type FileProblem } from "@/lib/kirtan/rules"
import { missingKindFields } from "@/lib/kirtan/uploadForm"
import { BABA_AUTHOR, DANCES, PS_SONG_COUNT, type DanceId, type Kirtan, type KirtanStatus, type KirtanTypeId, type RecordingKind, type RecordingLanguage, type UploadFailure } from "@/lib/kirtan/types"

/**
 * Submissions: a person uploads an audio file of a Kiirtan or a Bhajan (the `kind`) and it is PUBLISHED AT ONCE.
 * There is no waiting for review: the team looks afterwards, and removes a recording that breaks the content rules
 * with a notice to the author (docs/kiirtan-publishing.md). Pure transitions on a list, used by stores/kirtanStore.
 *
 * Life of a submission on the phone: `uploading` -> `published` (the server accepted it) or `failed` (a check or the
 * network stopped it; the person can try again). Later the server may say `removed`, with a reason.
 * The upload itself is lib/kirtan/upload.ts; the network calls are lib/kirtan/remote.ts.
 */

/**
 * Every new submission gets this type. The form does not ask for a type (Dada: "we don't need it"); "other" is
 * valid for both kinds, so covers and tones (lib/kirtan/tone) keep working. The team can set a better one later.
 * `byAuthor` records whether the person wrote or performs it. The one-time agreement to the content rules
 * is a separate step (stores/contentRulesStore).
 */
export const DEFAULT_SUBMISSION_TYPE = "other" as const

export type SubmissionInput = {
  /** "Type": one of the four kinds. */
  kind: RecordingKind
  /** name of the picked audio file, e.g. `morning-round.mp3`; null until a file is chosen */
  fileName: string | null
  /** where the picked file is (a local uri, or a blob url in the browser) */
  fileUri: string | null
  /** size in bytes when the picker knows it */
  fileSize?: number | null
  /** the picker's content type, when it gives one */
  fileType?: string | null
  title: string
  /** performer or group */
  author: string
  /** year recorded, optional */
  year?: number | null
  language?: RecordingLanguage | null
  /** the person's own name for the language, when `language` is "other" */
  languageOther?: string | null
  /** Dance music only: Tandava or Kaoshiki */
  dance?: DanceId | null
  /** a playlist from an event this recording is a track of (a server id), and its place there */
  collectionId?: string | null
  position?: number | null
  /** the day it was recorded, YYYY-MM-DD */
  recordedOn?: string | null
  /** the live broadcast this is the recording of */
  broadcastId?: string | null
  /** words and music by, optional */
  credits?: string
  /** where it was recorded or performed (every kind, optional), and Baba's Audio Discourses only: the name or number of the discourse */
  place?: string
  discourse?: string
  /** a short note, optional */
  notes?: string
  /** Prabhat Samgiita only: the song this is a performance of (1 to 5018) */
  psSong?: number | null
  /** the styles (STYLES ids) and the person's own style words; REQUIRED for a Kiirtan (one of either), optional for the other kinds but Baba's Audio Discourses */
  styles?: readonly string[] | null
  stylesOther?: readonly string[] | null
  /** the moods (UPLOAD_MOODS ids) and the person's own mood words; always optional */
  moods?: readonly string[] | null
  moodsOther?: readonly string[] | null
  /** the single style of the first form: read as a list of one when `styles` is not given (a caller from before the lists) */
  style?: string | null
  styleOther?: string | null
  /** Kiirtan only: "avarta" marks an Avarta Kiirtan */
  practice?: string | null
  /** how it was recorded (REQUIRED for a Kiirtan), the tempo, solo or group (lib/kirtan/recordingInfo.ts) */
  recordingType?: string | null
  tempo?: string | null
  performance?: string | null
  /** the main instrument: an id or "other" with its word (lib/kirtan/instruments.ts); optional */
  leadInstrument?: string | null
  leadInstrumentOther?: string | null
  /** the person is the author of the recording (the tick is not offered for Prabhat Samgiita) */
  byAuthor: boolean
  addedBy: string
  /** the person agreed to the content rules (now, or on an earlier upload) */
  termsAccepted?: boolean
}

export type SubmissionError = "file" | FileProblem | "title" | "titleEnglish" | "author" | "language" | "languageName" | "dance" | "song" | "style" | "recordingType" | "performance" | "instrument" | "year" | "terms"

/** Is this a song number of the Prabhat Samgiita catalogue (a whole number from 1 to 5018)? */
export function isPsSongNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= PS_SONG_COUNT
}

/** Earliest year the form accepts (the API's `FIRST_YEAR`). */
export const FIRST_YEAR = 1900

/** Is this a year that can be recorded: a whole number from 1900 up to this year? */
export function isRecordableYear(value: unknown, now: number = Date.now()): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= FIRST_YEAR && value <= new Date(now).getFullYear()
}

/** The first thing missing from the form, or null when it can be sent. Order follows the form from the top. */
export function validateSubmission(input: SubmissionInput): SubmissionError | null {
  if (!input.fileName || !input.fileUri) return "file"
  const problem = validateAudioFile({ name: input.fileName, size: input.fileSize ?? null, type: input.fileType })
  if (problem) return problem
  if (!input.title.trim()) return "title"
  if (titleNeedsEnglish(input.kind, input.title)) return "titleEnglish"
  if (kindHasPerformer(input.kind) && !input.author.trim()) return "author"
  const missing = missingKindFields({ kind: normalizeKind(input.kind), language: input.language, languageOther: input.languageOther, dance: input.dance })
  if (missing.length) return missing[0]!
  if (normalizeKind(input.kind) === "prabhat_samgiita" && !isPsSongNumber(input.psSong)) return "song"
  // a Kiirtan names at least one style (listed or its own word); the other kinds may
  if (cleanStyles(normalizeKind(input.kind), inputStyles(input).styles, inputStyles(input).stylesOther).missing) return "style"
  // how a Kiirtan was recorded is required; an AI recording is not taken as a Bhajan
  if (recordingTypeMissing(input.kind, input.recordingType)) return "recordingType"
  if (input.recordingType === AI_TYPE && kindHasRecordingType(input.kind) && !kindAllowsAi(input.kind)) return "recordingType"
  // solo or group is required for a Kiirtan
  if (performanceMissing(input.kind, input.performance)) return "performance"
  // "Add your own" instrument needs a word of at least two letters
  if (cleanInstrument(input.kind, input.leadInstrument, input.leadInstrumentOther).tooShort) return "instrument"
  if (input.year != null && !isRecordableYear(input.year)) return "year"
  if (!input.termsAccepted) return "terms"
  return null
}

function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

/** Same title by the same author. Only used to catch a double tap while the first upload is still running. */
export function submissionKey(title: string, author: string): string {
  return `${tidy(title).toLowerCase()}|${tidy(author).toLowerCase()}`
}

function slug(text: string, fallback: string): string {
  return tidy(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || fallback
}

/** The styles a form named: the lists, or the one old `style` read as a list of one. */
function inputStyles(input: Pick<SubmissionInput, "styles" | "stylesOther" | "style" | "styleOther">): { styles: readonly string[]; stylesOther: readonly string[] } {
  if (input.styles != null || input.stylesOther != null) return { styles: input.styles ?? [], stylesOther: input.stylesOther ?? [] }
  return stylesOfRecord(input)
}

/**
 * The styles and moods a form named, for the kinds that keep them. The first style is also written the old way (`style`, and
 * `styleOther` for an own word) so an older screen and the search shelves still read it.
 */
function tagsOfInput(kind: string, input: SubmissionInput): Pick<Kirtan, "styles" | "stylesOther" | "moods" | "moodsOther" | "style" | "styleOther"> {
  const given = inputStyles(input)
  const st = cleanStyles(kind, given.styles, given.stylesOther)
  const mood = cleanMoods(kind, input.moods, input.moodsOther)
  const first = st.styles[0]
  return {
    ...(st.styles.length ? { styles: st.styles } : {}),
    ...(st.stylesOther.length ? { stylesOther: st.stylesOther } : {}),
    ...(mood.moods.length ? { moods: mood.moods } : {}),
    ...(mood.moodsOther.length ? { moodsOther: mood.moodsOther } : {}),
    ...(first ? { style: first } : st.stylesOther[0] ? { style: "other", styleOther: st.stylesOther[0] } : {}),
  }
}

/** The type of recording, tempo and solo or group a form named, for the kinds that carry them. */
function infoOfInput(kind: string, input: SubmissionInput): Pick<Kirtan, "recordingType" | "tempo" | "performance"> {
  const clean = cleanRecordingInfo(kind, input)
  return { ...(clean.recordingType ? { recordingType: clean.recordingType } : {}), ...(clean.tempo ? { tempo: clean.tempo } : {}), ...(clean.performance ? { performance: clean.performance } : {}) }
}

/** The main instrument a form named, for the kinds of music (a word that IS a listed instrument becomes its id). */
function instrumentOfInput(kind: string, input: SubmissionInput): Pick<Kirtan, "leadInstrument" | "leadInstrumentOther"> {
  const clean = cleanInstrument(kind, input.leadInstrument, input.leadInstrumentOther)
  if (!clean.instrument || clean.tooShort) return {}
  return { leadInstrument: clean.instrument, ...(clean.instrumentOther ? { leadInstrumentOther: clean.instrumentOther } : {}) }
}

/** A new Kiirtan or Bhajan, on its way up. The id is stable per title and time. */
export function buildSubmission(input: SubmissionInput, now: number): Kirtan {
  const kind = normalizeKind(input.kind)
  return {
    id: `sub-${slug(input.title, kind)}-${now}`,
    kind,
    title: fixKiirtanSpelling(tidy(input.title)),
    author: kindHasPerformer(kind) ? tidy(input.author) : BABA_AUTHOR,
    durationSec: null,
    type: DEFAULT_SUBMISSION_TYPE,
    byAuthor: kindHasPerformer(kind) && kindHasByAuthor(kind) && Boolean(input.byAuthor),
    ...(input.year ? { year: input.year } : {}),
    ...(input.language && kindHasLanguage(kind) ? { language: input.language } : {}),
    ...(input.language === OTHER_LANGUAGE && kindHasLanguage(kind) && cleanLanguageOther(input.languageOther) ? { languageOther: cleanLanguageOther(input.languageOther)! } : {}),
    ...(kindHasDance(kind) && input.dance && DANCES.includes(input.dance) ? { dance: input.dance } : {}),
    ...(input.collectionId ? { collectionId: input.collectionId, ...(input.position ? { position: input.position } : {}) } : {}),
    ...(input.recordedOn ? { recordedOn: input.recordedOn } : {}),
    ...(input.broadcastId ? { broadcastId: input.broadcastId } : {}),
    ...(tidy(input.credits ?? "") ? { credits: tidy(input.credits ?? "") } : {}),
    ...(tidy(input.place ?? "") ? { place: tidy(input.place ?? "") } : {}),
    ...(kindHasDiscourse(kind) && tidy(input.discourse ?? "") ? { discourse: tidy(input.discourse ?? "") } : {}),
    ...(tidy(input.notes ?? "") ? { notes: tidy(input.notes ?? "") } : {}),
    ...(kind === "prabhat_samgiita" && isPsSongNumber(input.psSong) ? { psSong: input.psSong } : {}),
    ...tagsOfInput(kind, input),
    ...(cleanPractice(kind, input.practice) ? { practice: cleanPractice(kind, input.practice) as string } : {}),
    ...infoOfInput(kind, input),
    ...instrumentOfInput(kind, input),
    audioUrl: input.fileUri,
    thumbnailUrl: null,
    addedBy: input.addedBy.trim() || "You",
    status: "uploading",
    addedAt: now,
    ...(input.fileName ? { fileName: input.fileName } : {}),
    ...(input.fileType ? { fileType: input.fileType } : {}),
  }
}

export type AddResult = { list: Kirtan[]; added: Kirtan | null; duplicate: Kirtan | null }

/**
 * Adds a submission to the list. The only thing refused here is the same title by the same author while its first
 * upload is still running (a double tap). Whether the AUDIO is already in the app is the server's call: the same file
 * is refused, a similar one only warns, a different performance of the same chant is welcome (lib/kirtan/upload.ts).
 */
export function addSubmission(list: readonly Kirtan[], next: Kirtan): AddResult {
  const key = submissionKey(next.title, next.author)
  const running = list.find((k) => k.status === "uploading" && submissionKey(k.title, k.author) === key) ?? null
  if (running) return { list: [...list], added: null, duplicate: running }
  return { list: [next, ...list], added: next, duplicate: null }
}

function update(list: readonly Kirtan[], id: string, patch: (k: Kirtan) => Kirtan): Kirtan[] {
  return list.map((k) => (k.id === id ? patch(k) : k))
}

/** The server accepted the upload: it is published; the server's link, id and length replace the phone's file. */
export function markPublished(list: readonly Kirtan[], id: string, remote: RemoteRecording): Kirtan[] {
  return update(list, id, (k) => fromRemote(remote, k))
}

/** The upload stopped. The person can try again from My uploads. */
export function markFailed(list: readonly Kirtan[], id: string, failure: UploadFailure): Kirtan[] {
  return update(list, id, (k) => (k.status === "published" || k.status === "removed" ? k : { ...k, status: "failed", failure }))
}

/** The language was added to a recording that had none (by its id here or on the server); an existing language is never rewritten. */
export function withLanguage(list: readonly Kirtan[], id: string, value: { language: string; languageOther?: string }): Kirtan[] {
  const name = value.language === OTHER_LANGUAGE ? cleanLanguageOther(value.languageOther) : null
  return list.map((k) => (k.language || (k.id !== id && k.serverId !== id) ? k : { ...k, language: value.language, ...(name ? { languageOther: name } : {}) }))
}

/** The Avarta mark of a recording was changed (by its id here or on the server): set, or cleared with `null`. */
export function withPractice(list: readonly Kirtan[], id: string, practice: string | null): Kirtan[] {
  const clean = practice === "avarta" ? practice : null
  return list.map((k) => {
    if (k.id !== id && k.serverId !== id) return k
    const { practice: _old, ...rest } = k
    return clean ? { ...rest, practice: clean } : rest
  })
}

/** Try again: back to uploading, the old failure forgotten. */
export function retrySubmission(list: readonly Kirtan[], id: string): Kirtan[] {
  return update(list, id, (k) => {
    if (k.status !== "failed") return k
    const { failure: _failure, ...rest } = k
    return { ...rest, status: "uploading" }
  })
}

/** Dismiss a submission that is not live (failed, still uploading, or removed). A published one is never dropped here. */
export function withdrawSubmission(list: readonly Kirtan[], id: string): Kirtan[] {
  return list.filter((k) => !(k.id === id && k.status !== "published"))
}

/** The team took it down (the server says so, with a reason). */
export function markRemoved(list: readonly Kirtan[], id: string, info: { reason: string; at: number }): Kirtan[] {
  return update(list, id, (k) => ({ ...k, status: "removed", removedReason: info.reason, removedAt: info.at }))
}

/** Published here before, removed now: the ones the person has to be told about. */
export function newlyRemoved(before: readonly Kirtan[], after: readonly Kirtan[]): Kirtan[] {
  const wasLive = new Set(before.filter((k) => k.status === "published").map((k) => k.id))
  return after.filter((k) => k.status === "removed" && wasLive.has(k.id))
}

/** Demo preview only (no server): the upload counts as done at once and the file stays on this device. */
export function markPublishedLocal(list: readonly Kirtan[], id: string): Kirtan[] {
  return update(list, id, (k) => {
    const { failure: _failure, ...rest } = k
    return { ...rest, status: "published" }
  })
}

/** Counts for the "Your uploads" header. */
export function submissionCounts(list: readonly Kirtan[]): Record<KirtanStatus, number> {
  const counts: Record<KirtanStatus, number> = { uploading: 0, published: 0, failed: 0, removed: 0 }
  for (const k of list) counts[k.status] += 1
  return counts
}

/* ------------------------------------------------------------------ the server's view */

function ms(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function isDance(value: unknown): value is DanceId {
  return DANCES.includes(value as DanceId)
}

/** The language fields of a server row, read through the catalog (an old stored word like "bengali" reads as "bn"). */
function languageOf(remote: RemoteRecording, base?: Kirtan): Pick<Kirtan, "language" | "languageOther"> {
  const code = normalizeLanguageCode(remote.language) ?? base?.language
  if (!code) return {}
  const other = code === OTHER_LANGUAGE ? cleanLanguageOther(remote.language_other) ?? base?.languageOther : undefined
  return { language: code, ...(other ? { languageOther: other } : {}) }
}

/**
 * The styles and moods of a server row. The server is the truth when it says (an own word comes only for its writer, or once the team
 * accepted it); a row from before the lists carries one `style`, which reads as a list of one; an older server says nothing and the
 * phone's own values stay.
 */
function tagsOf(remote: RemoteRecording, kind: string, base?: Kirtan): Pick<Kirtan, "styles" | "stylesOther" | "moods" | "moodsOther" | "style" | "styleOther"> {
  if (kind === "baba_audio") return {}
  const said = remote.styles !== undefined || remote.styles_other !== undefined || remote.style !== undefined
  const from = said ? stylesOfRecord({ styles: remote.styles, stylesOther: remote.styles_other, style: remote.style, styleOther: remote.style_other }) : stylesOfRecord(base ?? {})
  const moods = remote.moods !== undefined ? (remote.moods ?? []) : (base?.moods ?? [])
  const moodsOther = remote.moods_other !== undefined ? (remote.moods_other ?? []) : (base?.moodsOther ?? [])
  const first = from.styles[0]
  return {
    ...(from.styles.length ? { styles: from.styles } : {}),
    ...(from.stylesOther.length ? { stylesOther: from.stylesOther } : {}),
    ...(moods.length ? { moods: [...moods] } : {}),
    ...(moodsOther.length ? { moodsOther: [...moodsOther] } : {}),
    ...(first ? { style: first } : from.stylesOther[0] ? { style: "other", styleOther: from.stylesOther[0] } : {}),
  }
}

/** The practice of a server row: the server is the truth when it says (even "none"); an older server says nothing and the phone's own value stays. */
function practiceOf(remote: RemoteRecording, kind: string, base?: Kirtan): Pick<Kirtan, "practice"> {
  const said = remote.practice === undefined ? base?.practice : remote.practice
  const clean = cleanPractice(kind, said)
  return clean ? { practice: clean } : {}
}

/** The server is the truth when it says (even "none"); an older server says nothing and the phone's own value stays. */
function infoOfRemote(remote: RemoteRecording, kind: string, base?: Kirtan): Pick<Kirtan, "recordingType" | "tempo" | "performance"> {
  const clean = cleanRecordingInfo(kind, {
    recordingType: remote.recording_type === undefined ? base?.recordingType : remote.recording_type,
    tempo: remote.tempo === undefined ? base?.tempo : remote.tempo,
    performance: remote.performance === undefined ? base?.performance : remote.performance,
  })
  return { ...(clean.recordingType ? { recordingType: clean.recordingType } : {}), ...(clean.tempo ? { tempo: clean.tempo } : {}), ...(clean.performance ? { performance: clean.performance } : {}) }
}

/** The main instrument of a server row: the server is the truth when it says. The author's own word comes with it (others get it once accepted). */
function instrumentOfRemote(remote: RemoteRecording, kind: string, base?: Kirtan): Pick<Kirtan, "leadInstrument" | "leadInstrumentOther" | "leadInstrumentChecked"> {
  const id = remote.lead_instrument === undefined ? base?.leadInstrument : remote.lead_instrument
  const clean = cleanInstrument(kind, id, remote.lead_instrument_other ?? base?.leadInstrumentOther)
  if (!clean.instrument) return {}
  const word = clean.instrumentOther ?? (id === "other" ? (remote.lead_instrument_other ?? base?.leadInstrumentOther ?? "").trim() : "")
  return { leadInstrument: clean.instrument, ...(word ? { leadInstrumentOther: word } : {}), ...(remote.lead_instrument_checked ? { leadInstrumentChecked: true } : {}) }
}

/** A server recording as the app's `Kirtan`. `base` keeps the phone's own id and time when the item is already here. */
export function fromRemote(remote: RemoteRecording, base?: Kirtan): Kirtan {
  const removed = remote.status === "removed"
  const kind = normalizeKind(remote.kind)
  const next: Kirtan = {
    id: base?.id ?? `srv-${remote.id}`,
    kind,
    title: remote.title,
    author: remote.author,
    durationSec: remote.duration_sec ?? base?.durationSec ?? null,
    ...(typeof remote.loudness_lufs === "number" ? { loudnessLufs: remote.loudness_lufs } : base?.loudnessLufs !== undefined ? { loudnessLufs: base.loudnessLufs } : {}),
    ...(typeof remote.true_peak_db === "number" ? { truePeakDb: remote.true_peak_db } : base?.truePeakDb !== undefined ? { truePeakDb: base.truePeakDb } : {}),
    type: remote.type as KirtanTypeId,
    byAuthor: base?.byAuthor ?? remote.by_author,
    audioUrl: remote.audio_url,
    thumbnailUrl: remote.thumbnail_url,
    addedBy: remote.added_by,
    // the server's `flagged` is still live: it stays in the app until the team decides
    status: removed ? "removed" : "published",
    addedAt: base?.addedAt ?? ms(remote.published_at) ?? ms(remote.created_at) ?? 0,
    plays: remote.plays ?? undefined,
    serverId: remote.id,
    authorId: remote.author_id,
    ...(remote.year ? { year: remote.year } : base?.year ? { year: base.year } : {}),
    ...languageOf(remote, base),
    ...tagsOf(remote, kind, base),
    ...practiceOf(remote, kind, base),
    ...infoOfRemote(remote, kind, base),
    ...instrumentOfRemote(remote, kind, base),
    ...(isDance(remote.dance) ? { dance: remote.dance } : base?.dance ? { dance: base.dance } : {}),
    ...(remote.collection_id ? { collectionId: remote.collection_id } : base?.collectionId ? { collectionId: base.collectionId } : {}),
    ...(remote.position ? { position: remote.position } : base?.position ? { position: base.position } : {}),
    ...(remote.recorded_on ? { recordedOn: remote.recorded_on } : base?.recordedOn ? { recordedOn: base.recordedOn } : {}),
    ...(remote.credits ? { credits: remote.credits } : base?.credits ? { credits: base.credits } : {}),
    ...(remote.place ? { place: remote.place } : base?.place ? { place: base.place } : {}),
    ...(remote.discourse ? { discourse: remote.discourse } : base?.discourse ? { discourse: base.discourse } : {}),
    ...(remote.notes ? { notes: remote.notes } : base?.notes ? { notes: base.notes } : {}),
    ...(isPsSongNumber(remote.ps_song_number) ? { psSong: remote.ps_song_number } : base?.psSong ? { psSong: base.psSong } : {}),
  }
  if (removed && remote.removed_duplicate_of) next.duplicateOf = { id: remote.removed_duplicate_of, title: "", author: "" }
  if (removed) {
    next.removedReason = remote.removed_reason ?? ""
    const at = ms(remote.removed_at)
    if (at !== undefined) next.removedAt = at
  }
  return next
}

/**
 * Folds the person's own uploads from the server (`GET /recordings/mine`) into the list: a recording the team removed
 * shows as removed with its reason; one made on another device appears here. Items that never reached the server
 * (uploading, failed) stay as they are.
 */
export function mergeRemoteMine(list: readonly Kirtan[], remote: readonly RemoteRecording[]): Kirtan[] {
  const byServerId = new Map(remote.map((r) => [r.id, r]))
  const known = new Set<string>()
  const merged = list.map((k) => {
    const r = k.serverId ? byServerId.get(k.serverId) : undefined
    if (!r) return k
    known.add(r.id)
    return fromRemote(r, k)
  })
  const fresh = remote.filter((r) => !known.has(r.id)).map((r) => fromRemote(r))
  return [...merged, ...fresh].sort((a, b) => b.addedAt - a.addedAt)
}
