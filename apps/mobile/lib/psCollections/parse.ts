/**
 * The Prabhat Samgiita collections (Dada's lists: feelings, times of day, seasons, themes, languages, tala, raga).
 * Pure logic. The data is a DATA LAYER: four files in data/psCollections/ (copies of Carousel/Для-Дады/коллекции-пс/
 * collections-*.json, refreshed by `node scripts/syncPsCollections.mjs`), all in one format
 * `{ status, collections: [{ id, title, description, songs: [numbers], reviewed?, section? }] }`.
 * A fresh file replaces the old one without touching the code.
 *
 * What is shown (Dada, 11 Nov 2026):
 *  - a collection with `reviewed: false` is hidden; the four weak ones (path, inner-world, society, memory) are hidden until
 *    the file says `reviewed: true` for them, because the delivered file does not carry the flag yet;
 *  - a collection with fewer than MIN_SONGS songs is hidden; "...-unspecified" collections and the tala codes nobody could
 *    explain (Df, Kf, Baet) are never shown;
 *  - a section with no visible collection does not exist (so Raga appears by itself once a raga has enough songs).
 */

export type PsSource = "assignment" | "languages" | "tala" | "raga"
export type PsSectionId = "feeling" | "time" | "season" | "theme" | "language" | "tala" | "raga" | "heart"

/** Order of the sections on the Collections page (the "From the site" block comes before the last one, see sections.ts). */
export const PS_SECTION_ORDER: readonly PsSectionId[] = ["feeling", "time", "season", "theme", "language", "tala", "raga", "heart"]

/** A collection shows only with at least this many songs. */
export const MIN_SONGS = 5

/** Weak collections of the first delivery: hidden until the data says `reviewed: true` (Dada, 11 Nov 2026). */
export const PENDING_REVIEW_IDS: ReadonlySet<string> = new Set(["path", "inner-world", "society", "memory"])

const NEVER_SHOWN_IDS: ReadonlySet<string> = new Set(["tala-df", "tala-kf", "tala-baet"])

/** Section of each collection of the main file; a collection the table does not know goes to Theme unless the file says. */
const ASSIGNMENT_SECTION: Readonly<Record<string, PsSectionId>> = {
  longing: "feeling",
  closeness: "feeling",
  surrender: "feeling",
  "tears-hope": "feeling",
  joy: "feeling",
  morning: "time",
  evening: "time",
  night: "time",
  spring: "season",
  summer: "season",
  rains: "season",
  autumn: "season",
  winter: "season",
  heart: "heart",
}

const SOURCE_SECTION: Readonly<Record<Exclude<PsSource, "assignment">, PsSectionId>> = {
  languages: "language",
  tala: "tala",
  raga: "raga",
}

export type HiddenReason = "review" | "unspecified" | "small" | null

export type PsCollection = {
  /** id in the file ("morning", "lang-hindi"); never changed */
  id: string
  /** what the route carries: "ps:<source>:<id>" */
  key: string
  source: PsSource
  section: PsSectionId
  title: string
  description: string
  /** song numbers, unique, in the file's order */
  songs: readonly number[]
  hidden: HiddenReason
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function psKey(source: PsSource, id: string): string {
  return `ps:${source}:${id}`
}

export function isPsKey(key: string): boolean {
  return /^ps:(assignment|languages|tala|raga):.+/.test(key)
}

function sectionOf(source: PsSource, id: string, declared: string): PsSectionId {
  if ((PS_SECTION_ORDER as readonly string[]).includes(declared)) return declared as PsSectionId
  if (source === "assignment") return ASSIGNMENT_SECTION[id] ?? "theme"
  return SOURCE_SECTION[source]
}

function hiddenReason(c: { id: string; reviewed: unknown; songs: readonly number[] }): HiddenReason {
  if (c.id.endsWith("-unspecified") || NEVER_SHOWN_IDS.has(c.id)) return "unspecified"
  if (c.reviewed === false) return "review"
  if (c.reviewed !== true && PENDING_REVIEW_IDS.has(c.id)) return "review"
  if (c.songs.length < MIN_SONGS) return "small"
  return null
}

/**
 * Reads one file as it is delivered (an object with `collections`, or a bare list). A broken record loses only itself,
 * a broken song number only that song. Hidden collections stay in the result with the reason, so a test and a screen can say why.
 */
export function parsePsCollections(source: PsSource, input: unknown): PsCollection[] {
  const list: unknown = Array.isArray(input) ? input : (input as { collections?: unknown } | null)?.collections
  if (!Array.isArray(list)) return []
  const out: PsCollection[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const r = raw as Record<string, unknown> | null
    const id = str(r?.id)
    if (!r || !id || seen.has(id)) continue
    seen.add(id)
    const songs: number[] = []
    const have = new Set<number>()
    if (Array.isArray(r.songs)) {
      for (const n of r.songs) {
        if (typeof n === "number" && Number.isInteger(n) && n >= 1 && !have.has(n)) {
          have.add(n)
          songs.push(n)
        }
      }
    }
    out.push({
      id,
      key: psKey(source, id),
      source,
      section: sectionOf(source, id, str(r.section)),
      title: str(r.title) || id,
      description: str(r.description),
      songs,
      hidden: hiddenReason({ id, reviewed: r.reviewed, songs }),
    })
  }
  return out
}

export function visiblePs(all: readonly PsCollection[]): PsCollection[] {
  return all.filter((c) => c.hidden === null)
}

/** The collections of a section, bigger first (the heart collection and the like keep their file order when equal). */
export function inSection(all: readonly PsCollection[], section: PsSectionId): PsCollection[] {
  return visiblePs(all)
    .filter((c) => c.section === section)
    .map((c, index) => ({ c, index }))
    .sort((a, b) => (section === "time" || section === "season" ? a.index - b.index : b.c.songs.length - a.c.songs.length || a.index - b.index))
    .map(({ c }) => c)
}

/** Song numbers for a route key, or null when the key is not one of ours or names nothing. */
export function songsForKey(all: readonly PsCollection[], key: string): number[] | null {
  if (!isPsKey(key)) return null
  const found = all.find((c) => c.key === key)
  return found ? [...found.songs] : null
}
