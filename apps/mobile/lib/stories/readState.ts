/** Which stories were read, and when (ms since epoch). Kept on the device by stores/storiesStore. */
export type ReadMap = Record<string, number>

export function isRead(map: ReadMap, slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, slug)
}

/** Marks a story read. Reading it again keeps the first time; the same map comes back when nothing changes. */
export function markRead(map: ReadMap, slug: string, now: number): ReadMap {
  if (!slug || isRead(map, slug)) return map
  return { ...map, [slug]: now }
}

export function markUnread(map: ReadMap, slug: string): ReadMap {
  if (!isRead(map, slug)) return map
  const next = { ...map }
  delete next[slug]
  return next
}

export function unreadCount(slugs: readonly string[], map: ReadMap): number {
  return slugs.filter((slug) => !isRead(map, slug)).length
}

/** A map from storage that may be damaged: keeps only `slug -> finite number`. */
export function sanitizeReadMap(raw: unknown): ReadMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: ReadMap = {}
  for (const [slug, time] of Object.entries(raw as Record<string, unknown>)) {
    if (slug && typeof time === "number" && Number.isFinite(time)) out[slug] = time
  }
  return out
}
