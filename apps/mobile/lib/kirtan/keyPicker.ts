/**
 * The rules of the compact key picker (Dada, 9 Nov 2026, part 2): "Which key do you play in?", "Key of this tune" and "Where does Sa
 * sit?" are one line with the chosen note and a "+", and a sheet with a search box and a scrollable list. One choice only.
 * Pure: the component (components/kirtan/add/KeyPicker.tsx) only draws what these functions say.
 */
export type KeyOption = { id: string; label: string }

/** The notes as list rows (the id is the note itself: "C#", "Eb"). */
export function keyOptions(names: readonly string[]): KeyOption[] {
  return names.map((name) => ({ id: name, label: name }))
}

/** What the rail shows: the chosen note, or the "Not sure" words when nothing is chosen (null when the field has no "Not sure"). */
export function keyRailText(value: string, noneLabel: string | null): string | null {
  return value || noneLabel
}

export type KeyRow = { kind: "same" } | { kind: "none" } | { kind: "key"; id: string; label: string }

/**
 * The rows of the sheet, top to bottom: "Same as previous tune" and "Not sure" first (only while nothing is typed in the search box,
 * and only when the field offers them), then the notes that match what was typed.
 */
export function keyRows(input: { options: readonly KeyOption[]; query: string; allowNone: boolean; allowSame: boolean }): KeyRow[] {
  const rows: KeyRow[] = []
  if (!input.query.trim()) {
    if (input.allowSame) rows.push({ kind: "same" })
    if (input.allowNone) rows.push({ kind: "none" })
  }
  const q = plain(input.query)
  for (const o of input.options.filter((o) => !q || plain(o.label).includes(q))) rows.push({ kind: "key", id: o.id, label: o.label })
  return rows
}

/** Lower case, "♯" and "♭" as typed on a phone keyboard turned into "#" and "b", spaces dropped ("c #" finds C#). */
function plain(text: string): string {
  return text.toLowerCase().replace(/♯/g, "#").replace(/♭/g, "b").replace(/\s+/g, "")
}
