import { filterByLength, type LengthBucketId } from "@/lib/kirtan/length"
import { filterKirtans } from "@/lib/kirtan/list"
import { KIRTAN_TYPES, type Kirtan, type KirtanTypeId } from "@/lib/kirtan/types"

/** The sticky chips of the Kiirtan tab. */
export const KIRTAN_TAB_CHIPS = [
  { id: "all", label: "All" },
  { id: "saved", label: "Saved" },
  { id: "downloaded", label: "Downloaded" },
  { id: "mine", label: "My uploads" },
] as const
export type KirtanTabChip = (typeof KIRTAN_TAB_CHIPS)[number]["id"]

export function parseKirtanTabChip(value: string | string[] | undefined): KirtanTabChip {
  const raw = Array.isArray(value) ? value[0] : value
  return KIRTAN_TAB_CHIPS.some((c) => c.id === raw) ? (raw as KirtanTabChip) : "all"
}

/** The "New kiirtans" list: the type card and the length chip both narrow it (null means no limit). */
export function newKirtansList<T extends Pick<Kirtan, "type" | "durationSec">>(list: readonly T[], type: KirtanTypeId | null, length: LengthBucketId | null): T[] {
  return filterByLength(filterKirtans(list, type ?? "all"), length)
}

/** Counts for the "By type" cards. */
export function typeCards(list: readonly Pick<Kirtan, "type">[]): { id: KirtanTypeId; label: string; count: number }[] {
  return KIRTAN_TYPES.map((t) => ({ id: t.id, label: t.label, count: list.filter((k) => k.type === t.id).length }))
}

/** Saved Kiirtans in the order they were saved. Unknown or unapproved ids are left out. */
export function savedKirtans<T extends Pick<Kirtan, "id" | "status">>(savedIds: readonly string[], byId: ReadonlyMap<string, T>): T[] {
  return savedIds.flatMap((id) => {
    const k = byId.get(id)
    return k && k.status === "approved" ? [k] : []
  })
}

/** What the list says when a type or length leaves nothing. */
export function emptyListText(type: KirtanTypeId | null, length: LengthBucketId | null): string {
  if (type && length) return "No Kiirtans of this type and length yet."
  if (type) return "No Kiirtans of this type yet."
  if (length) return "No Kiirtans of this length yet."
  return "No Kiirtans yet."
}
