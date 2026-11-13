/**
 * Words for the compact choice row (Dada, 10 Nov 2026): "Solo or group", "How was it recorded?", "Tempo" and "Which dance?" are one row
 * with a sheet now. Only what the old chips did not need: the screen-reader name of the sheet's "Not chosen" row. English is the source of
 * truth; ru and es mirror it key for key (the parity test checks it). Spread last in en.ts, ru.ts and es.ts.
 */
export const choiceFieldEn = {
  "choice.clear.a11y": "Clear the choice: {field}",
} as const

export const choiceFieldRu: Record<keyof typeof choiceFieldEn, string> = {
  "choice.clear.a11y": "Убрать выбор: {field}",
}

export const choiceFieldEs: Record<keyof typeof choiceFieldEn, string> = {
  "choice.clear.a11y": "Quitar la elección: {field}",
}
