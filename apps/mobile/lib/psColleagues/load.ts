import type { WireAudio, WireChords, WireTranslations } from "./types"

/**
 * Lazy loaders for the colleagues' data. Each file is read once, the first time a screen asks (a dynamic `import()`,
 * so a web export puts it in its own chunk and a phone does not parse it until the Meaning or Chords tab needs it).
 * A failed load is not stored, so the next ask tries again.
 */

let translations: Promise<WireTranslations> | null = null
let chords: Promise<WireChords> | null = null
let audio: Promise<WireAudio> | null = null

function once<T>(slot: Promise<T> | null, make: () => Promise<{ default: unknown }>, set: (p: Promise<T> | null) => void): Promise<T> {
  if (slot) return slot
  const next = make().then((m) => m.default as T)
  set(next)
  next.catch(() => set(null))
  return next
}

export function loadColleagueTranslations(): Promise<WireTranslations> {
  return once(translations, () => import("@/data/psColleagues/translations.json"), (p) => (translations = p))
}

export function loadColleagueChords(): Promise<WireChords> {
  return once(chords, () => import("@/data/psColleagues/chords.json"), (p) => (chords = p))
}

export function loadColleagueAudio(): Promise<WireAudio> {
  return once(audio, () => import("@/data/psColleagues/audio.json"), (p) => (audio = p))
}
