/**
 * Step from "saved with no version" (zustand counts that as 0) to version 1 for stores whose shape did not change.
 * Without a `migrate`, zustand throws the saved data away when the version differs; this keeps it. Anything that
 * is not an object (a damaged save) becomes an empty save, so the store starts from its defaults.
 */
export function keepSavedState<T>(saved: unknown): T {
  return (saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : {}) as T
}
