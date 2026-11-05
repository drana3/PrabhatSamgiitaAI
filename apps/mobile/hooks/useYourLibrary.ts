import { useEffect, useMemo } from "react"

import { useDownloadsStorage } from "@/components/profile-v2/useDownloadsStorage"
import { MOCK_PLAYLISTS, MOCK_SAVED, MOCK_STORAGE } from "@/lib/fixtures/songsMock"
import { buildLibraryRows, type LibraryInput, type LibraryRow } from "@/lib/library/yourLibrary"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { totalBytes } from "@/lib/storageCache"
import { useAuthStore } from "@/stores/authStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useLanguage } from "@/lib/i18n"

/** TODO(api): the preview shows two saved Kiirtans; real counts come from kirtanStore.savedIds. */
const MOCK_SAVED_KIIRTANS = 2

/**
 * Everything that is the person's own, as rows. Reads the stores that already hold it (saved songs,
 * saved Kiirtans, playlists, offline files, the person's Kiirtan uploads); nothing new is kept.
 * In the preview (MOCKUP_DATA) the prototype's sample data stands in, like on the Songs screens.
 * TODO(api): "last used" times per list, so the order can follow what was opened last (rows already sort by it).
 */
export function useYourLibrary(forceGuest = false): { rows: LibraryRow[]; signedIn: boolean } {
  const language = useLanguage()
  const mode = useAuthStore((s) => s.mode)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const savedKiirtanIds = useKirtanStore((s) => s.savedIds)
  const submissions = useKirtanStore((s) => s.submissions)
  const playlists = usePlaylistStore((s) => s.playlists)
  const storage = useDownloadsStorage()

  // The preview starts with two uploads of the person (one live, one removed), put there once the stored state is read.
  useEffect(() => {
    if (!MOCKUP_DATA) return
    const seed = () => useKirtanStore.getState().seedDemo()
    if (useKirtanStore.persist.hasHydrated()) seed()
    return useKirtanStore.persist.onFinishHydration(seed)
  }, [])

  const rows = useMemo(() => {
    const input: LibraryInput = MOCKUP_DATA
      ? {
          savedSongCount: MOCK_SAVED.length,
          savedKiirtanCount: Math.max(savedKiirtanIds.length, MOCK_SAVED_KIIRTANS),
          downloads: { count: MOCK_STORAGE.length, bytes: totalBytes(MOCK_STORAGE) },
          uploads: { total: submissions.length, removed: submissions.filter((k) => k.status === "removed").length },
          playlists: MOCK_PLAYLISTS.map((p) => ({ id: p.id, name: p.name, songNumbers: p.songs })),
        }
      : {
          savedSongCount: savedSongIds.length,
          savedKiirtanCount: savedKiirtanIds.length,
          downloads: { count: storage.fileCount, bytes: storage.bytes },
          uploads: { total: submissions.length, removed: submissions.filter((k) => k.status === "removed").length },
          playlists: playlists.map((p) => ({ id: p.id, name: p.name, songNumbers: p.songs.map((song: { song_number: number }) => song.song_number) })),
        }
    return buildLibraryRows(input)
  }, [savedSongIds, savedKiirtanIds, submissions, playlists, storage.fileCount, storage.bytes, language])

  return { rows, signedIn: !forceGuest && (MOCKUP_DATA || mode === "signed_in") }
}
