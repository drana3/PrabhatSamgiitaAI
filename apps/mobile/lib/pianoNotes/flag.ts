/** The recording as the shelf sees it: `piano` is true when accepted notes exist for it. Others are returned as they are. */
export function withPianoFlag<T extends { id: string; serverId?: string; piano?: boolean }>(list: readonly T[], known: ReadonlySet<string>): T[] {
  if (!known.size) return list as T[]
  return list.map((k) => (k.piano || !(known.has(k.id) || (k.serverId && known.has(k.serverId))) ? k : { ...k, piano: true }))
}
