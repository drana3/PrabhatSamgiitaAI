import { kindLabel } from "@/lib/kirtan/kind"
import { KIRTAN_TYPES, type Kirtan, type KirtanTypeFilter } from "@/lib/kirtan/types"

/** `12:40`, or `1:02:05` past an hour. */
export function formatKirtanLength(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** `12:40 · added by Priya`. The KIIRTAN or BHAJAN tag is drawn beside it; length and person are left out when unknown. */
export function kirtanSubline(k: Pick<Kirtan, "durationSec" | "addedBy">): string {
  const parts: string[] = []
  if (k.durationSec) parts.push(formatKirtanLength(k.durationSec))
  if (k.addedBy.trim()) parts.push(`added by ${k.addedBy.trim()}`)
  return parts.join(" · ")
}

export function filterKirtans<T extends Pick<Kirtan, "type">>(list: readonly T[], type: KirtanTypeFilter): T[] {
  return type === "all" ? [...list] : list.filter((k) => k.type === type)
}

/** Newest first; ties keep the given order. */
export function newestFirst<T extends Pick<Kirtan, "addedAt">>(list: readonly T[]): T[] {
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.addedAt - a.item.addedAt || a.index - b.index)
    .map((x) => x.item)
}

export function approvedOnly<T extends Pick<Kirtan, "status">>(list: readonly T[]): T[] {
  return list.filter((k) => k.status === "approved")
}

/** The type filters that have at least one kirtan, plus All. Used to hide empty chips if wanted. */
export function typesInUse(list: readonly Pick<Kirtan, "type">[]): KirtanTypeFilter[] {
  return ["all", ...KIRTAN_TYPES.map((t) => t.id).filter((id) => list.some((k) => k.type === id))]
}

/** Spoken label of a row for screen readers. */
export function kirtanRowLabel(k: Kirtan): string {
  return `${kindLabel(k.kind)}, ${k.title}. ${kirtanSubline(k)}`
}
