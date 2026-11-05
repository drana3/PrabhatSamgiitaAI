import { t } from "@/lib/i18n"

/** The chips of Songs (one navigation layer): All, Saved, Downloaded, Playlists. */
export const SONG_CHIPS = [
  { id: "all", get label() { return t("home.filter.all") } },
  { id: "saved", get label() { return t("songs.chip.saved") } },
  { id: "downloaded", get label() { return t("home.filter.downloaded") } },
  { id: "playlists", get label() { return t("songs.chip.playlists") } },
] as const

export type SongChipId = (typeof SONG_CHIPS)[number]["id"]

export function isSongChip(value: unknown): value is SongChipId {
  return SONG_CHIPS.some((c) => c.id === value)
}

/**
 * Query parameter `?segment=` (or `?chip=`) -> a chip, default All. Old links keep working:
 * `catalog` is All, `collections` is All (they are a shelf there now) and `mine` is Saved.
 */
export function parseSongChip(value: string | string[] | undefined): SongChipId {
  const raw = Array.isArray(value) ? value[0] : value
  if (isSongChip(raw)) return raw
  if (raw === "mine") return "saved"
  return "all"
}

/**
 * Old links to the removed source switch: `/songs-v2?source=kirtan` and `?source=mixes` belong to the
 * Kiirtan tab now. Returns the path to redirect to, or null for Prabhat Samgiita and unknown values.
 */
export function legacySourceRedirect(source: string | string[] | undefined): string | null {
  const raw = Array.isArray(source) ? source[0] : source
  return raw === "kirtan" || raw === "mixes" ? "/v2/kiirtan" : null
}
