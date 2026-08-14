import type { MockSong } from "@/data/mock"
import { storedMeaningForLanguage } from "@/lib/songMap"

export type SongMeaningResolution =
  | { status: "ready"; text: string }
  | { status: "loading" }
  | { status: "unavailable" }

function sameText(left: string | null | undefined, right: string | null | undefined) {
  const a = left?.trim()
  const b = right?.trim()
  return Boolean(a && b && a === b)
}

/** Never show English text under a different selected language label. */
export function resolveSongMeaning(
  song: Pick<MockSong, "meaning" | "hindiMeaning" | "localizedMeanings">,
  language: string,
  localizedMeaning: string | null,
  localizing: boolean,
): SongMeaningResolution {
  const code = language.toLowerCase()
  const english = song.meaning?.trim() || ""

  if (code === "en") {
    return english ? { status: "ready", text: english } : { status: "unavailable" }
  }

  const stored = storedMeaningForLanguage(song, code)?.trim()
  if (stored && !sameText(stored, english)) return { status: "ready", text: stored }

  if (localizing) return { status: "loading" }

  const translated = localizedMeaning?.trim()
  if (translated && !sameText(translated, english)) return { status: "ready", text: translated }

  return { status: "unavailable" }
}

export function meaningUnavailableMessage(language: string) {
  const label = language.toLowerCase() === "hi" ? "Hindi" : language
  if (language.toLowerCase() === "en") {
    return "English meaning is not available for this song yet."
  }
  if (language.toLowerCase() === "hi") {
    return "Hindi meaning is not available for this song yet."
  }
  return `${label} translation is not available yet. Try English or Hindi.`
}
