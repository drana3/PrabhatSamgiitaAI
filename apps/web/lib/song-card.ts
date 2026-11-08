import { AUTHOR_CARD_PHOTOS, hashSeed } from "@/lib/author-card"
import { titleCaseTransliteration } from "@/lib/transliteration-text"

/**
 * The share picture and the page text of a song page (docs/share.md, "Song page preview"). Pure, so the rules can
 * be tested; the drawing is `song-card-image.tsx` and the route is `app/share/song/[number]/route.tsx`.
 *
 * It says only what the page already shows to everybody: the song number, the title, the first line. No lyrics
 * beyond the first line, no meaning, no listener numbers, no site address. Text in a script the card's fonts
 * cannot draw (Devanagari, Bengali) is left out, never drawn as empty boxes.
 */
export type CardSong = {
  number: number
  title: string
  first_line?: string | null
  language?: string | null
  theme?: string | null
}

const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Z}\p{S}]+$/u

export function isDrawableText(value: string): boolean {
  return LATIN.test(value)
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

export function clip(value: string, max: number): string {
  const text = clean(value)
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1).replace(/[\s,;:.\-–—]+\S*$/, "")
  return `${(cut || text.slice(0, max - 1)).trimEnd()}…`
}

/** "Song 1234": the small line above the title. */
export function songEyebrow(song: CardSong): string {
  return `Prabhat Samgiita · Song ${song.number}`
}

/** The big line: the title in Latin letters, else the first line, else a plain name. */
export function songCardTitle(song: CardSong): string {
  for (const candidate of [song.title, song.first_line]) {
    const text = titleCaseTransliteration(clean(candidate))
    if (text && isDrawableText(text)) return clip(text, 80)
  }
  return `Song ${song.number}`
}

/** The small line under the title: the first line, when it is drawable and not the same as the title. */
export function songCardLine(song: CardSong): string {
  const title = songCardTitle(song)
  const text = titleCaseTransliteration(clean(song.first_line))
  if (!text || !isDrawableText(text) || text === title) return ""
  return clip(text, 90)
}

/** `<title>` of the page and of its preview. */
export function songPageTitle(song: CardSong): string {
  const title = titleCaseTransliteration(clean(song.title)) || `Song ${song.number}`
  return `${title} · Prabhat Samgiita ${song.number}`
}

/** The description a chat shows under the picture: first line, then theme and language; always plain text. */
export function songPageDescription(song: CardSong): string {
  const parts: string[] = []
  const first = clean(song.first_line)
  if (first) parts.push(clip(titleCaseTransliteration(first), 120))
  const facts = [clean(song.theme), clean(song.language)].filter(Boolean)
  if (facts.length) parts.push(facts.join(" · "))
  parts.push("Lyrics, meaning and recordings on Prabhat Samgiita AI.")
  return parts.join(". ").replace(/\.\./g, ".")
}

/** The stock photo behind a song's card: stable per song, the same in the app and in a link preview. */
export function songCardPhoto(number: number): number {
  return AUTHOR_CARD_PHOTOS[hashSeed(`song:${number}`) % AUTHOR_CARD_PHOTOS.length]!
}

/** Path of the picture; a version in the address makes chats fetch it again when the title changes. */
export function songCardPath(number: number, version?: string | number): string {
  const base = `/share/song/${number}`
  return version === undefined || version === "" ? base : `${base}?v=${encodeURIComponent(String(version))}`
}

export function isSongNumber(value: string): boolean {
  return /^\d{1,5}$/.test(value) && Number(value) > 0
}
