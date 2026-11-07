import { filterByKind, isRecordingKind, kindCountLabel, kindHasTypes, kindWhat, typesOfKind } from "@/lib/kirtan/kind"
import { filterByLength, type LengthBucketId } from "@/lib/kirtan/length"
import { filterKirtans } from "@/lib/kirtan/list"
import { RECORDING_KINDS, type KindFilter, type Kirtan, type KirtanTypeId, type RecordingKind } from "@/lib/kirtan/types"
import { t } from "@/lib/i18n"

/**
 * The sticky chips of the Kiirtan tab. The first four are the KIND filter (All, Kiirtan, Bhajan,
 * Prabhat Samgiita) and narrow every shelf and list; Saved, Downloaded and My uploads are lists of their own (all kinds).
 */
export const KIRTAN_TAB_CHIPS = [
  { id: "all", get label() { return t("kt.chip.all") } },
  { id: "kiirtan", get label() { return t("kind.kiirtan") } },
  { id: "bhajan", get label() { return t("kind.bhajan") } },
  { id: "prabhat_samgiita", get label() { return t("kind.prabhat_samgiita") } },
  { id: "saved", get label() { return t("kt.chip.saved") } },
  { id: "downloaded", get label() { return t("kt.chip.downloaded") } },
  { id: "mine", get label() { return t("kt.chip.mine") } },
] as const
export type KirtanTabChip = (typeof KIRTAN_TAB_CHIPS)[number]["id"]

export function parseKirtanTabChip(value: string | string[] | undefined): KirtanTabChip {
  const raw = Array.isArray(value) ? value[0] : value
  return KIRTAN_TAB_CHIPS.some((c) => c.id === raw) ? (raw as KirtanTabChip) : "all"
}

/** The kind a chip filters by: All and the three kinds say it; the list chips (Saved...) show every kind. */
export function kindOfTabChip(chip: KirtanTabChip): KindFilter {
  return isRecordingKind(chip) ? chip : "all"
}

/** Is this one of the four chips that show the shelves (and so use the kind filter)? */
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
