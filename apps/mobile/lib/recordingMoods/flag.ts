/**
 * The recording as the Search menu sees it, with the moods the server confirmed for it. Moods a recording already carries stay;
 * the confirmed ones are added by the app's id or the server's. Others are returned as they are.
 */
export function withConfirmedMoods<T extends { id: string; serverId?: string; moods?: readonly string[] | null }>(list: readonly T[], known: Readonly<Record<string, readonly string[]>>): T[] {
  if (!Object.keys(known).length) return list as T[]
  return list.map((k) => {
    const found = known[k.id] ?? (k.serverId ? known[k.serverId] : undefined)
    if (!found?.length) return k
    const own = k.moods ?? []
    const merged = [...own, ...found.filter((m) => !own.includes(m))]
    return merged.length === own.length ? k : { ...k, moods: merged }
  })
}
