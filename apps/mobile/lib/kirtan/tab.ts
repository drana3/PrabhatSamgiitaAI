import { filterByKind, isRecordingKind, kindCountLabel, kindHasTypes, kindWhat, typesOfKind } from "@/lib/kirtan/kind"
import { filterByLength, type LengthBucketId } from "@/lib/kirtan/length"
import { filterKirtans } from "@/lib/kirtan/list"
import { languageLabel, LANGUAGE_CODES, OTHER_LANGUAGE } from "@/lib/kirtan/languages"
import { RECORDING_KINDS, type DanceId, type KindFilter, type Kirtan, type KirtanTypeId, type RecordingKind } from "@/lib/kirtan/types"
import { t } from "@/lib/i18n"

/**
 * The sticky chips of the Kiirtan tab. The first seven are the KIND filter (All, Kiirtan, Bhajan,
 * Prabhat Samgiita, Spiritual song, Dance music, Baba's Audio) and narrow every shelf and list; Saved, Downloaded and My uploads are lists of their own (all kinds).
 */
export const KIRTAN_TAB_CHIPS = [
  { id: "all", get label() { return t("kt.chip.all") } },
  { id: "kiirtan", get label() { return t("kind.kiirtan") } },
  { id: "bhajan", get label() { return t("kind.bhajan") } },
  { id: "prabhat_samgiita", get label() { return t("kind.prabhat_samgiita") } },
  { id: "spiritual_song", get label() { return t("kind.spiritual_song") } },
  { id: "dance_song", get label() { return t("kind.dance_song") } },
  { id: "baba_audio", get label() { return t("kind.baba_audio") } },
  { id: "saved", get label() { return t("kt.chip.saved") } },
  { id: "downloaded", get label() { return t("kt.chip.downloaded") } },
  { id: "mine", get label() { return t("kt.chip.mine") } },
] as const
export type KirtanTabChip = (typeof KIRTAN_TAB_CHIPS)[number]["id"]

export function parseKirtanTabChip(value: string | string[] | undefined): KirtanTabChip {
  const raw = Array.isArray(value) ? value[0] : value
  return KIRTAN_TAB_CHIPS.some((c) => c.id === raw) ? (raw as KirtanTabChip) : "all"
}

/** The kind a chip filters by: All and the six kinds say it; the list chips (Saved...) show every kind. */
export function kindOfTabChip(chip: KirtanTabChip): KindFilter {
  return isRecordingKind(chip) ? chip : "all"
}

/** Is this one of the chips that show the shelves (and so use the kind filter)? */
export function isShelfChip(chip: KirtanTabChip): boolean {
  return chip === "all" || isRecordingKind(chip)
}

/**
 * The "New kiirtans" list: the kind chip, the type card and the length chip all narrow it (null means
 * no limit). `kind` defaults to both kinds.
 */
export function newKirtansList<T extends Pick<Kirtan, "type" | "durationSec"> & { kind?: RecordingKind }>(
  list: readonly T[],
  type: KirtanTypeId | null,
  length: LengthBucketId | null,
  kind: KindFilter = "all",
): T[] {
  return filterByLength(filterKirtans(filterByKind(list, kind), type ?? "all"), length)
}

export type TypeCard = { id: KirtanTypeId; kind: RecordingKind; label: string; count: number }

/**
 * Counts for the "By type" cards: the types of one kind, or (kind "all") Kiirtan types first and then
 * Bhajan types. The kind is part of a card because "Other" exists in both.
 */
export function typeCards(list: readonly (Pick<Kirtan, "type"> & { kind?: RecordingKind })[], kind: KindFilter = "kiirtan"): TypeCard[] {
  const kinds: RecordingKind[] = (kind === "all" ? [...RECORDING_KINDS] : [kind]).filter(kindHasTypes)
  return kinds.flatMap((k) => {
    const ofKind = filterByKind(list, k)
    return typesOfKind(k).map((t) => ({ id: t.id, kind: k, label: t.label, count: ofKind.filter((x) => x.type === t.id).length }))
  })
}

/** Label of a type card's count: `4 kiirtans`, `1 bhajan`. */
export function typeCardCount(card: Pick<TypeCard, "kind" | "count">): string {
  return kindCountLabel(card.kind, card.count)
}

/** Saved Kiirtans in the order they were saved. Unknown or unpublished ids are left out. */
export function savedKirtans<T extends Pick<Kirtan, "id" | "status">>(savedIds: readonly string[], byId: ReadonlyMap<string, T>): T[] {
  return savedIds.flatMap((id) => {
    const k = byId.get(id)
    return k && k.status === "published" ? [k] : []
  })
}

/** What the list says when a type or length leaves nothing. */
export function emptyListText(type: KirtanTypeId | null, length: LengthBucketId | null, kind: KindFilter = "kiirtan"): string {
  const what = kindWhat(kind)
  if (type && length) return t("kt.emptyList.both", { what })
  if (type) return t("kt.emptyList.type", { what })
  if (length) return t("kt.emptyList.length", { what })
  return t("kt.emptyList.none", { what })
}

/**
 * What an empty catalog says (no filter is on and nothing exists yet, as in a real build before the
 * first upload), with the Add entry shown under it: "No Kiirtans yet. Be the first to add one."
 */
export function emptyCatalogText(kind: KindFilter = "kiirtan"): string {
  return t("kt.emptyCatalog", { what: kindWhat(kind) })
}

/** True when the list is empty because nothing exists, not because a type or length filter hides it. */
export function isEmptyCatalog(type: KirtanTypeId | null, length: LengthBucketId | null, listLength: number): boolean {
  return listLength === 0 && !type && !length
}

/**
 * "Bhajans for every hour": the Bhajans ordered by the hour they belong to (Morning, Evening, Devotional,
 * Other), newest first inside a type. Only published ones are expected in `list`.
 */
export function bhajansForEveryHour<T extends Pick<Kirtan, "type" | "addedAt"> & { kind?: RecordingKind }>(list: readonly T[], limit = 12): T[] {
  const order = typesOfKind("bhajan").map((t) => t.id)
  return filterByKind(list, "bhajan")
    .map((item, index) => ({ item, index }))
    .sort((a, b) => order.indexOf(a.item.type) - order.indexOf(b.item.type) || b.item.addedAt - a.item.addedAt || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.item)
}

/* ------------------------------------------------------------------ language and dance filters */

/** The two sub-filters of the Spiritual song and Dance music chips: which dance, which language (null is any). */
export type KindSubFilter = { dance: DanceId | null; language: string | null }
export const NO_SUB_FILTER: KindSubFilter = { dance: null, language: null }

/** Do these kinds have sub-filters (languages for all three; the dance for Dance music only)? */
export function hasSubFilters(kind: KindFilter): boolean {
  return kind === "spiritual_song" || kind === "dance_song" || kind === "baba_audio"
}

export function isSubFilterOn(sub: KindSubFilter): boolean {
  return sub.dance !== null || sub.language !== null
}

export function filterBySub<T extends Pick<Kirtan, "dance" | "language">>(list: readonly T[], sub: KindSubFilter): T[] {
  return list.filter((item) => (!sub.dance || item.dance === sub.dance) && (!sub.language || item.language === sub.language))
}

/** The languages that really occur in the list, in the order of the language catalog ("other" last). */
export function languagesIn(list: readonly Pick<Kirtan, "language">[]): string[] {
  const present = new Set(list.flatMap((item) => (item.language ? [item.language] : [])))
  const known = LANGUAGE_CODES.filter((code) => present.has(code))
  return present.has(OTHER_LANGUAGE) ? [...known, OTHER_LANGUAGE] : known
}

/** What the list says when a dance or language filter leaves nothing (the catalog itself is not empty). */
export function subEmptyText(kind: KindFilter, sub: KindSubFilter): string {
  const what = kindWhat(kind)
  const dance = sub.dance ? (t as (key: string) => string)(`rec.dance.${sub.dance}`) : ""
  const language = sub.language ? languageLabel(sub.language) : ""
  if (dance && language) return t("kt.emptyList.danceLanguage", { what, dance, language })
  if (dance) return t("kt.emptyList.dance", { what, dance })
  return t("kt.emptyList.language", { what, language })
}
