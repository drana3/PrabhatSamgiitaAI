/**
 * Merging a guest's saved items into the account they sign in to, as plain functions.
 * Rule: the account ends with the union; an item is never twice; nothing is removed; the order the account
 * already had stays, and the guest's new items follow in the order the guest saved them.
 */

/** Union of two id lists: `base` first, then what only `extra` has. Never mutates, never doubles. */
export function unionIds(base: readonly string[], extra: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of [...base, ...extra]) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** `ps-12` to 12; null for any other id. */
export function songNumberOfId(songId: string): number | null {
  const match = /^ps-(\d+)$/i.exec(songId)
  if (!match) return null
  const number = Number(match[1])
  return Number.isFinite(number) && number > 0 ? number : null
}

/** The song numbers of a list of ids, without duplicates, ignoring ids that are not songs. */
export function songNumbersOf(ids: readonly string[]): number[] {
  const numbers = ids.map(songNumberOfId).filter((n): n is number => n != null)
  return [...new Set(numbers)]
}

/** Song numbers the account lacks: what to send. */
export function missingNumbers(guest: readonly number[], account: readonly number[]): number[] {
  const have = new Set(account)
  return [...new Set(guest)].filter((n) => !have.has(n))
}
