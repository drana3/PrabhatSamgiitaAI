import { filterByKind, kindCountLabel, kindLabelPlural, typesOfKind } from "@/lib/kirtan/kind"
import { filterByLength, type LengthBucketId } from "@/lib/kirtan/length"
import { filterKirtans } from "@/lib/kirtan/list"
import type { KindFilter, Kirtan, KirtanTypeId, RecordingKind } from "@/lib/kirtan/types"

/**
 * The sticky chips of the Kiirtan tab. The first three are the KIND filter (All, Kiirtan, Bhajan) and
 * narrow every shelf and list; Saved, Downloaded and My uploads are lists of their own (both kinds).
 */
export const KIRTAN_TAB_CHIPS = [
  { id: "all", label: "All" },
  { id: "kiirtan", label: "Kiirtan" },
  { id: "bhajan", label: "Bhajan" },
  { id: "saved", label: "Saved" },
  { id: "downloaded", label: "Downloaded" },
  { id: "mine", label: "My uploads" },
] as const
export type KirtanTabChip = (typeof KIRTAN_TAB_CHIPS)[number]["id"]

export function parseKirtanTabChip(value: string | string[] | undefined): KirtanTabChip {
  const raw = Array.isArray(value) ? value[0] : value
  return KIRTAN_TAB_CHIPS.some((c) => c.id === raw) ? (raw as KirtanTabChip) : "all"
}

/** The kind a chip filters by: All, Kiirtan and Bhajan say it; the list chips (Saved...) show both kinds. */
export function kindOfTabChip(chip: KirtanTabChip): KindFilter {
  return chip === "kiirtan" ? "kiirtan" : chip === "bhajan" ? "bhajan" : "all"
}

/** Is this one of the three chips that show the shelves (and so use the kind filter)? */
export function isShelfChip(chip: KirtanTabChip): boolean {
  return chip === "all" || chip === "kiirtan" || chip === "bhajan"
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
  const kinds: RecordingKind[] = kind === "all" ? ["kiirtan", "bhajan"] : [kind]
  return kinds.flatMap((k) => {
    const ofKind = filterByKind(list, k)
    return typesOfKind(k).map((t) => ({ id: t.id, kind: k, label: t.label, count: ofKind.filter((x) => x.type === t.id).length }))
  })
}

/** Label of a type card's count: `4 kiirtans`, `1 bhajan`. */
export function typeCardCount(card: Pick<TypeCard, "kind" | "count">): string {
  return kindCountLabel(card.kind, card.count)
}

/** Saved Kiirtans in the order they were saved. Unknown or unapproved ids are left out. */
export function savedKirtans<T extends Pick<Kirtan, "id" | "status">>(savedIds: readonly string[], byId: ReadonlyMap<string, T>): T[] {
  return savedIds.flatMap((id) => {
    const k = byId.get(id)
    return k && k.status === "approved" ? [k] : []
  })
}

/** What the list says when a type or length leaves nothing. */
export function emptyListText(type: KirtanTypeId | null, length: LengthBucketId | null, kind: KindFilter = "kiirtan"): string {
  const what = kind === "all" ? "Kiirtans or Bhajans" : kindLabelPlural(kind)
  if (type && length) return `No ${what} of this type and length yet.`
  if (type) return `No ${what} of this type yet.`
  if (length) return `No ${what} of this length yet.`
  return `No ${what} yet.`
}

/**
 * "Bhajans for every hour": the Bhajans ordered by the hour they belong to (Morning, Evening, Devotional,
 * Other), newest first inside a type. Only approved ones are expected in `list`.
 */
export function bhajansForEveryHour<T extends Pick<Kirtan, "type" | "addedAt"> & { kind?: RecordingKind }>(list: readonly T[], limit = 12): T[] {
  const order = typesOfKind("bhajan").map((t) => t.id)
  return filterByKind(list, "bhajan")
    .map((item, index) => ({ item, index }))
    .sort((a, b) => order.indexOf(a.item.type) - order.indexOf(b.item.type) || b.item.addedAt - a.item.addedAt || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.item)
}
