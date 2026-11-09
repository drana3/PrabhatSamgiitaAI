/**
 * The rules of the compact choice row (Dada, 10 Nov 2026): "Solo or group", "How was it recorded?", "Tempo" and "Which dance?" used to be
 * rows of big chips; each is now ONE row (the label, the chosen value, a chevron) and a tap opens the same white bottom sheet as the key
 * picker. One choice only. A required field has no way to empty it; an optional one gets a first row "Not chosen" that clears it.
 * Pure: the component (components/kirtan/add/ChoiceField.tsx) only draws what these functions say. Ids, words and API payloads stay
 * those of lib/kirtan/recordingInfo.ts and lib/kirtan/types.ts.
 */
export type ChoiceOption = { id: string; label: string }

/** The words of the chosen option, or null when nothing (or an id that is no longer offered) is chosen. */
export function choiceLabel(options: readonly ChoiceOption[], value: string | null | undefined): string | null {
  if (!value) return null
  return options.find((o) => o.id === value)?.label ?? null
}

/** What the row shows under the label: the chosen words, else the "Not chosen" words. */
export function choiceRailText(options: readonly ChoiceOption[], value: string | null | undefined, noneText: string): string {
  return choiceLabel(options, value) ?? noneText
}

export type ChoiceRow = { kind: "none" } | { kind: "choice"; id: string; label: string }

/** The rows of the sheet, top to bottom: "Not chosen" first (only when the field is optional), then every option in the given order. */
export function choiceRows(options: readonly ChoiceOption[], optional: boolean): ChoiceRow[] {
  const rows: ChoiceRow[] = optional ? [{ kind: "none" }] : []
  for (const o of options) rows.push({ kind: "choice", id: o.id, label: o.label })
  return rows
}

/**
 * What a tap on a row does. `picked` is an option id, or null for the "Not chosen" row. A required field never becomes empty
 * (a null pick is ignored), and picking what is already chosen changes nothing (the sheet just closes).
 */
export function pickChoice(current: string | null | undefined, picked: string | null, required: boolean): { value: string | null; changed: boolean } {
  const now = current || null
  if (picked === null && required) return { value: now, changed: false }
  return { value: picked, changed: picked !== now }
}

/** Is this row ticked in the sheet? "Not chosen" is ticked while nothing is chosen. */
export function rowIsOn(row: ChoiceRow, current: string | null | undefined): boolean {
  return row.kind === "none" ? !current : row.id === current
}
