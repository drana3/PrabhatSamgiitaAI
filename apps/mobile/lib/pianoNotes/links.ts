import type { PianoTarget } from "./types"

function targetParams(target: PianoTarget): string {
  return target.kind === "recording" ? `recording=${encodeURIComponent(target.id)}` : `song=${target.number}`
}

/** The page of the piano notes of a recording or a song. `sheet` opens it on one sheet. */
export function pianoHref(target: PianoTarget, title?: string, sheet?: string): string {
  const parts = [targetParams(target)]
  if (title) parts.push(`title=${encodeURIComponent(title.slice(0, 120))}`)
  if (sheet) parts.push(`sheet=${encodeURIComponent(sheet)}`)
  return `/piano-notes?${parts.join("&")}`
}

/**
 * The page where notes are written. `edit`: a waiting or rejected sheet of the member's own, being fixed. `copy`: a live
 * sheet of the member's own, being changed (the new one replaces it). `from`: somebody else's sheet, "Start from these notes".
 */
export function pianoEditHref(input: { target: PianoTarget; title?: string; edit?: string; copy?: string; from?: string }): string {
  const parts = [targetParams(input.target)]
  if (input.title) parts.push(`title=${encodeURIComponent(input.title.slice(0, 120))}`)
  if (input.edit) parts.push(`edit=${encodeURIComponent(input.edit)}`)
  else if (input.copy) parts.push(`copy=${encodeURIComponent(input.copy)}`)
  else if (input.from) parts.push(`from=${encodeURIComponent(input.from)}`)
  return `/piano-notes-edit?${parts.join("&")}`
}

/** The target named by the params of a screen, or null when neither is valid. */
export function targetFromParams(params: { recording?: unknown; song?: unknown }): PianoTarget | null {
  if (typeof params.recording === "string" && params.recording) return { kind: "recording", id: params.recording }
  const number = typeof params.song === "string" ? Number(params.song) : NaN
  if (Number.isInteger(number) && number >= 1 && number <= 5018) return { kind: "song", number }
  return null
}
