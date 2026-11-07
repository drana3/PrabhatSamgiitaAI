/**
 * Small pure helpers of the set page (app/recording-set/[id].tsx), kept out of the screen so they can be tested.
 */

/** Moves the id at `index` one place up (-1) or down (+1). Returns the new order, or null when it cannot move. */
export function swapIds(ids: readonly string[], index: number, step: -1 | 1): string[] | null {
  const to = index + step
  if (index < 0 || index >= ids.length || to < 0 || to >= ids.length) return null
  const next = [...ids]
  const moved = next[index] as string
  next[index] = next[to] as string
  next[to] = moved
  return next
}

/** The text the Share sheet carries: title, how many, where and when. Text only (no link yet, see docs/kiirtan-sets.md). */
export function setShareText(
  set: { title: string; place: string | null; count: number; when: string },
  translate: (key: "set.page.shareWithPlace" | "set.page.shareNoPlace", vars: Record<string, string | number>) => string,
): string {
  const place = set.place?.trim()
  return place
    ? translate("set.page.shareWithPlace", { title: set.title, count: set.count, place, when: set.when })
    : translate("set.page.shareNoPlace", { title: set.title, count: set.count, when: set.when })
}

/** One server call of the page (rename, reorder, take out, delete), run by the page's single busy guard. */
export type Job = () => Promise<void>
