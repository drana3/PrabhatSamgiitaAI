/**
 * The kirtan player's order. `context` is the list the kirtan was opened from, `queued` holds
 * kirtans added with "Play next" (they play before the list continues). Pure.
 */

export type KirtanQueueState = {
  context: readonly string[]
  queued: readonly string[]
}

/** "Play next": the new one goes in front of those already waiting, and never twice. */
export function playNext(queued: readonly string[], id: string): string[] {
  return [id, ...queued.filter((q) => q !== id)]
}

export function nextAfter(state: KirtanQueueState, currentId: string | null): { id: string; fromQueue: boolean } | null {
  const [first] = state.queued
  if (first) return { id: first, fromQueue: true }
  if (!currentId) return state.context[0] ? { id: state.context[0], fromQueue: false } : null
  const at = state.context.indexOf(currentId)
  const id = at >= 0 ? state.context[at + 1] : undefined
  return id ? { id, fromQueue: false } : null
}

export function previousBefore(state: KirtanQueueState, currentId: string | null): string | null {
  if (!currentId) return null
  const at = state.context.indexOf(currentId)
  return at > 0 ? state.context[at - 1] : null
}

/** Position text for the meta line: `3 of 8`; empty when the kirtan is not in the list. */
export function positionLabel(context: readonly string[], currentId: string | null): string {
  const at = currentId ? context.indexOf(currentId) : -1
  return at >= 0 ? `${at + 1} of ${context.length}` : ""
}
