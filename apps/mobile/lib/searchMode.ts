/** Pick search backend mode silently — never show these labels in the UI. */
export function resolveSearchMode(query: string): "catalog" | "semantic" {
  const trimmed = query.trim()
  if (!trimmed) return "catalog"
  if (/search prabhat samgiita for/i.test(trimmed)) return "catalog"
  if (/^\s*(?:ps[\s-]*)?\d{1,4}\s*$/i.test(trimmed)) return "catalog"
  // Short keyword lookups stay on catalog; natural-language questions use semantic.
  if (trimmed.split(/\s+/).length <= 2 && !/[?]/.test(trimmed)) return "catalog"
  return "semantic"
}
