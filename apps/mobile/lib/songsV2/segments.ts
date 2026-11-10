import { t } from "@/lib/i18n"

/**
 * The chips of Songs (one navigation layer, one swipeable row): All, Saved, Playlists, Learning, Learned.
 * There is no "Downloaded" chip (Dada, 10 Nov 2026): saved and downloaded are the same thing. A download is a state of a saved
 * song (the Downloaded mark on its row, the Download switch of the list and "Downloaded only" inside Saved).
 * Learning and Learned list the songs of the person's Learn progress (lib/learn/learnChips.ts).
 */
export const SONG_CHIPS = [
  { id: "all", get label() { return t("home.filter.all") } },
  { id: "saved", get label() { return t("songs.chip.saved") } },
  { id: "playlists", get label() { return t("songs.chip.playlists") } },
  { id: "learning", get label() { return t("songs.chip.learning") } },
  { id: "learned", get label() { return t("songs.chip.learned") } },
] as const

export type SongChipId = (typeof SONG_CHIPS)[number]["id"]

export function isSongChip(value: unknown): value is SongChipId {
  return SONG_CHIPS.some((c) => c.id === value)
}

/**
 * Query parameter `?segment=` (or `?chip=`) -> a chip, default All. Old links keep working:
 * `catalog` is All, `collections` is All (they are a shelf there now), `mine` is Saved, and `downloaded` is Saved with
 * "Downloaded only" on (see `isLegacyDownloadedChip`).
 */
export function parseSongChip(value: string | string[] | undefined): SongChipId {
  const raw = Array.isArray(value) ? value[0] : value
  if (isSongChip(raw)) return raw
  if (raw === "mine" || raw === "downloaded") return "saved"
  return "all"
}

/** An old `?chip=downloaded` link: it opens Saved with the "Downloaded only" switch already on. */
export function isLegacyDownloadedChip(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === "downloaded"
}

/**
 * Old links to the removed source switch: `/songs-v2?source=kirtan` and `?source=mixes` belong to the
 * Kiirtan tab now. Returns the path to redirect to, or null for Prabhat Samgiita and unknown values.
 */
export function legacySourceRedirect(source: string | string[] | undefined): string | null {
  const raw = Array.isArray(source) ? source[0] : source
  return raw === "kirtan" || raw === "mixes" ? "/v2/kiirtan" : null
}
