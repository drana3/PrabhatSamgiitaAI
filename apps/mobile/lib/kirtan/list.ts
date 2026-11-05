import { kindLabel } from "@/lib/kirtan/kind"
import { KIRTAN_TYPES, type Kirtan, type KirtanTypeFilter } from "@/lib/kirtan/types"
import { t } from "@/lib/i18n"

/** `12:40`, or `1:02:05` past an hour. */
export function formatKirtanLength(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** A submission made by the listener is stored with the name "You"; show it in the app's language. */
export function addedByName(raw: string): string {
  const name = raw.trim()
  return name === "You" ? t("kt.you") : name
}

/** `12:40 · added by Priya`. The KIIRTAN or BHAJAN tag is drawn beside it; length and person are left out when unknown. */
export function kirtanSubline(k: Pick<Kirtan, "durationSec" | "addedBy">): string {
  const parts: string[] = []
  if (k.durationSec) parts.push(formatKirtanLength(k.durationSec))
  if (k.addedBy.trim()) parts.push(t("kt.addedBy", { name: addedByName(k.addedBy) }))
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

export function publishedOnly<T extends Pick<Kirtan, "status">>(list: readonly T[]): T[] {
  return list.filter((k) => k.status === "published")
}

/**
 * What "Block this author" stores for a recording: the uploader's account id. A recording without one (the team's
 * bulk-loaded library, the demo samples) can be blocked by the author's name on this device only when `byName` is true
 * (the demo preview); a real build does not offer it, because the server cannot block a name.
 */
export function authorBlockKey(k: Pick<Kirtan, "authorId" | "author">, byName = false): string | null {
  if (k.authorId) return k.authorId
  const name = k.author.trim().toLowerCase()
  return byName && name ? `name:${name}` : null
}

/** Leaves out every recording of an author the person blocked. */
export function withoutBlocked<T extends Pick<Kirtan, "authorId" | "author">>(list: readonly T[], blockedAuthorIds: readonly string[]): T[] {
  if (!blockedAuthorIds.length) return [...list]
  const blocked = new Set(blockedAuthorIds)
  return list.filter((k) => {
    const key = authorBlockKey(k, true)
    return !key || !blocked.has(key)
  })
}

/**
 * Everything the app can play: the person's own uploads, then what the server publishes (minus blocked authors and
 * minus what is already among the person's own), then the demo samples (empty outside the preview).
 */
export function mergeCatalog(own: readonly Kirtan[], remote: readonly Kirtan[], samples: readonly Kirtan[], blockedAuthorIds: readonly string[]): Kirtan[] {
  const ownServerIds = new Set(own.map((k) => k.serverId).filter((id): id is string => Boolean(id)))
  const others = remote.filter((k) => !(k.serverId && ownServerIds.has(k.serverId)))
  return [...own, ...withoutBlocked([...others, ...samples], blockedAuthorIds)]
}

/** The type filters that have at least one kirtan, plus All. Used to hide empty chips if wanted. */
export function typesInUse(list: readonly Pick<Kirtan, "type">[]): KirtanTypeFilter[] {
  return ["all", ...KIRTAN_TYPES.map((t) => t.id).filter((id) => list.some((k) => k.type === id))]
}

/** Spoken label of a row for screen readers. */
export function kirtanRowLabel(k: Kirtan): string {
  return `${kindLabel(k.kind)}, ${k.title}. ${kirtanSubline(k)}`
}
