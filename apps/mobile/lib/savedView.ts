export type SavedViewState = "loading" | "empty" | "list"

/** The Saved tab shows exactly one of: loading, empty or list (BUG-28). */
export function savedViewState(input: { syncing: boolean; count: number }): SavedViewState {
  if (input.count > 0) return "list"
  return input.syncing ? "loading" : "empty"
}
