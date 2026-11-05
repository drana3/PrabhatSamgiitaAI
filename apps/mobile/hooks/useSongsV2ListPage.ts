import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter } from "expo-router"

import type { MenuPlaylist } from "@/components/songs-v2/ListSheets"
import type { ToastAction } from "@/components/songs-v2/Toast"
import { useSongsV2Actions } from "@/hooks/useSongsV2Actions"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { MOCK_PLAYLISTS, MOCK_RECENT } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { playlistSongNumbers, starterSongForNumber } from "@/lib/playPlaylist"
import { demoDownloadKey, useDemoDownloads } from "@/lib/playerV2/demoDownloads"
import { addToQueue, playNext } from "@/lib/playerV2/queueOps"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import {
  CATEGORY_CHIPS,
  DEFAULT_LIST_SORT,
  DOWNLOAD_ALL_LIMIT,
  LIST_SORTS,
  buildPlayPlan,
  buildShufflePlan,
  downloadAllState,
  emptyMessage,
  filterByChip,
  listSourceId,
  metaLine,
  pendingDownloads,
  sortList,
  visibleChips,
  withoutHidden,
  type DownloadAllState,
  type ListContext,
  type ListSortKey,
  type PlayPlan,
} from "@/lib/songsV2/listPage"
import { useSongsListState } from "@/lib/songsV2/listState"
import { queueToast } from "@/lib/songsV2/playAll"
import { UNDO_MS, hiddenToast, removedToast, rowRemoval } from "@/lib/songsV2/rowMenu"
import { useAuthStore } from "@/stores/authStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

const EMPTY: readonly number[] = []

/** State and actions of a playlist-style page. `entries` is the whole list; hidden songs are dropped here. */
export function useSongsV2ListPage({ listId, listName, entries }: { listId: string; listName: string; entries: readonly CatalogEntry[] }) {
  const router = useRouter()
  const actions = useSongsV2Actions()

  const [chip, setChip] = useState("all")
  const [sort, setSort] = useState<ListSortKey>(DEFAULT_LIST_SORT)
  const [toast, setToast] = useState<string | null>(null)
  const [toastAction, setToastAction] = useState<ToastAction | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** A short message; with `action` (Undo) it stays `ms` (5 s) and shows the action. A newer message replaces it. */
  const flash = useCallback((message: string, action?: ToastAction, ms = 2200) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    setToastAction(action ?? null)
    toastTimer.current = setTimeout(() => {
      setToast(null)
      setToastAction(null)
    }, ms)
  }, [])
  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(null)
    setToastAction(null)
  }, [])

  /* ---- what the listener has */
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const recentPlays = usePreferencesStore((s) => s.recentPlays)
  const hiddenMap = useSongsListState((s) => s.hidden)
  const offlineFiles = useOfflineAudioStore((s) => s.files)
  const activeBySong = useOfflineAudioStore((s) => s.activeBySong)
  const demoDone = useDemoDownloads((d) => d.done)
  const demoProgress = useDemoDownloads((d) => d.progress)
  const authMode = useAuthStore((s) => s.mode)
  const playlists = usePlaylistStore((s) => s.playlists)
  const currentNumber = usePlayerStore((s) => s.currentSong?.number ?? null)
  const playingFrom = usePlayerStore((s) => s.activePlaylist?.id ?? null)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const [mockPlaylistSongs, setMockPlaylistSongs] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(MOCK_PLAYLISTS.map((p) => [p.id, [...p.songs]])),
  )

  // The preview seeds the same store (lib/playerV2/demoEngine.ts), so Mine is one list everywhere.
  const saved = useMemo(
    () => new Set(savedSongIds.map((id) => Number(id.replace(/^ps-/i, ""))).filter(Number.isFinite)),
    [savedSongIds],
  )
  const downloaded = useMemo(
    () =>
      MOCKUP_DATA
        ? new Set(Object.keys(demoDone).map((key) => Number(key.split("-")[0])))
        : new Set(Object.values(offlineFiles).map((f) => f.songNumber)),
    [demoDone, offlineFiles],
  )
  const downloading = useMemo(
    () =>
      MOCKUP_DATA
        ? new Set(Object.keys(demoProgress).map((key) => Number(key.split("-")[0])))
        : new Set(Object.keys(activeBySong).map(Number)),
    [demoProgress, activeBySong],
  )
  const recent = useMemo<readonly number[]>(
    () => (MOCKUP_DATA ? MOCK_RECENT : recentPlays.map((r) => r.number)),
    [recentPlays],
  )

  /* ---- the list */
  const hidden = useMemo(() => new Set(hiddenMap[listId] ?? EMPTY), [hiddenMap, listId])
  const base = useMemo(() => withoutHidden(entries, hidden), [entries, hidden])
  const categories = useMemo<ListContext["categories"]>(
    () =>
      Object.fromEntries(
        CATEGORY_CHIPS.map((c) => [c.id, new Set(songNumbersForCategory(c.id))]),
      ),
    [],
  )
  const ctx = useMemo<ListContext>(() => ({ saved, downloaded, categories }), [saved, downloaded, categories])
  const chips = useMemo(() => visibleChips(base, ctx), [base, ctx])
  const activeChip = chips.some((c) => c.id === chip) ? chip : "all"
  const shown = useMemo(() => sortList(filterByChip(base, activeChip, ctx), sort, recent), [base, activeChip, ctx, sort, recent])
  const shownNumbers = useMemo(() => shown.map((e) => e.number), [shown])
  const meta = useMemo(() => metaLine(base), [base])
  const chipLabel = chips.find((c) => c.id === activeChip)?.label ?? "All"
  const empty = base.length === 0 ? "" : emptyMessage(activeChip, chipLabel)
  const download = downloadAllState(shownNumbers, downloaded, downloading)
  const downloadedHere = useMemo(() => shownNumbers.filter((n) => downloaded.has(n)), [shownNumbers, downloaded])
  const source = listSourceId(listId)
  const playingHere = playingFrom === source && isPlaying

  /* ---- playing */
  const start = useCallback(
    (plan: PlayPlan | null) => {
      if (!plan) return
      usePlayerStore.setState({ activePlaylist: { id: source, name: listName } })
      usePlayerStore.getState().loadSong(starterSongForNumber(plan.start), plan.queue, "playlist")
    },
    [source, listName],
  )
  const play = useCallback(() => {
    if (playingFrom === source) {
      usePlayerStore.getState().togglePlay()
      return
    }
    start(buildPlayPlan(shownNumbers, hasPlayableAudio))
  }, [playingFrom, source, shownNumbers, start])
  const shuffle = useCallback(() => start(buildShufflePlan(shownNumbers, hasPlayableAudio)), [shownNumbers, start])
  const playRow = useCallback(
    (entry: CatalogEntry) => {
      if (!hasPlayableAudio(entry.number)) return actions.open(entry)
      if (currentNumber === entry.number && playingFrom === source) {
        usePlayerStore.getState().togglePlay()
        return
      }
      start(buildPlayPlan(shownNumbers, hasPlayableAudio, entry.number))
    },
    [actions, currentNumber, playingFrom, source, shownNumbers, start],
  )

  /* ---- downloads */
  const needSignIn = useCallback(() => {
    flash("Sign in to download songs")
    router.push(href("/signin"))
  }, [flash, router])

  const removeDownload = useCallback((number: number) => {
    if (MOCKUP_DATA) {
      const demo = useDemoDownloads.getState()
      Object.keys(demo.done)
        .filter((key) => Number(key.split("-")[0]) === number)
        .forEach((key) => demo.toggle(key))
      return
    }
    const store = useOfflineAudioStore.getState()
    Object.values(store.files)
      .filter((f) => f.songNumber === number)
      .forEach((f) => {
        void store.remove(f.remoteUrl).then(() => usePlayerStore.getState().stopIfPlayingLocalUri(f.fileUri))
      })
  }, [])

  const startDownload = useCallback(
    (number: number) => {
      if (MOCKUP_DATA) {
        useDemoDownloads.getState().toggle(demoDownloadKey(number, 0))
        return
      }
      void useOfflineAudioStore
        .getState()
        .download("", number, { userInitiated: true })
        .catch((error: unknown) => flash(error instanceof Error ? error.message : "Could not download this song"))
    },
    [flash],
  )

  const toggleDownload = useCallback(
    (entry: CatalogEntry) => {
      if (downloaded.has(entry.number)) {
        removeDownload(entry.number)
        flash("Removed from this phone")
        return
      }
      if (downloading.has(entry.number)) return
      if (!MOCKUP_DATA && authMode !== "signed_in") return needSignIn()
      if (!hasPlayableAudio(entry.number)) return flash("No audio to download for this song yet")
      startDownload(entry.number)
      flash(`Downloading PS ${entry.number}`)
    },
    [downloaded, downloading, authMode, needSignIn, removeDownload, startDownload, flash],
  )

  const downloadAll = useCallback(() => {
    if (download === "done") return flash("Downloaded. Remove them from the three dots.")
    if (download === "downloading") return flash("Still downloading")
    const pending = pendingDownloads(shownNumbers, downloaded, downloading, hasPlayableAudio)
    if (!pending.length) return flash("No audio to download in this list yet")
    if (pending.length > DOWNLOAD_ALL_LIMIT) {
      return flash(`Up to ${DOWNLOAD_ALL_LIMIT} songs at a time. Narrow the list with a chip first.`)
    }
    if (!MOCKUP_DATA && authMode !== "signed_in") return needSignIn()
    pending.forEach(startDownload)
    flash(`Downloading ${pending.length} ${pending.length === 1 ? "song" : "songs"}`)
  }, [download, shownNumbers, downloaded, downloading, authMode, needSignIn, startDownload, flash])

  const removeAllDownloads = useCallback(() => {
    downloadedHere.forEach(removeDownload)
    flash("Removed from this phone")
  }, [downloadedHere, removeDownload, flash])

  /* ---- row menu */
  const playNextEntry = useCallback(
    (entry: CatalogEntry) => {
      const state = usePlayerStore.getState()
      state.setQueue(playNext(state.queue, state.currentSong?.number ?? null, entry.number))
      flash(state.currentSong ? `PS ${entry.number} plays next` : `Added PS ${entry.number} to the queue`)
    },
    [flash],
  )
  const queueEntry = useCallback(
    (entry: CatalogEntry) => {
      const state = usePlayerStore.getState()
      flash(queueToast(state.queue, entry.number))
      state.setQueue(addToQueue(state.queue, entry.number))
    },
    [flash],
  )
  const queueAll = useCallback(() => {
    const state = usePlayerStore.getState()
    const next = shownNumbers.reduce((queue, n) => addToQueue(queue, n), state.queue)
    state.setQueue(next)
    flash(`Added ${shownNumbers.length} ${shownNumbers.length === 1 ? "song" : "songs"} to the queue`)
  }, [shownNumbers, flash])

  /** The circle-plus, the swipe and the row menu all open the one "Save to" sheet, which says what happened. */
  const toggleSave = useCallback((entry: CatalogEntry) => actions.toggleSave(entry), [actions])

  const playlistRows = useCallback(
    (entry: CatalogEntry | null): MenuPlaylist[] => {
      if (!entry) return []
      const count = (n: number) => `${n} ${n === 1 ? "song" : "songs"}`
      if (MOCKUP_DATA) {
        return MOCK_PLAYLISTS.map((p) => {
          const songs = mockPlaylistSongs[p.id] ?? []
          return { id: p.id, name: p.name, meta: count(songs.length), has: songs.includes(entry.number) }
        })
      }
      return playlists.map((p) => ({
        id: p.id,
        name: p.name,
        meta: count(p.songs.length),
        has: playlistSongNumbers(p).includes(entry.number),
      }))
    },
    [playlists, mockPlaylistSongs],
  )

  const reportPlaylistFailure = useCallback(
    (result: unknown) => {
      if (result && typeof result === "object" && "needsAuth" in result) router.push(href("/signin"))
      else if (result && typeof result === "object" && "error" in result) flash(String((result as { error: string }).error))
    },
    [router, flash],
  )

  const togglePlaylist = useCallback(
    (entry: CatalogEntry, id: string, has: boolean) => {
      const name = (MOCKUP_DATA ? MOCK_PLAYLISTS : playlists).find((p) => p.id === id)?.name ?? "playlist"
      if (MOCKUP_DATA) {
        setMockPlaylistSongs((all) => {
          const songs = all[id] ?? []
          return { ...all, [id]: has ? songs.filter((n) => n !== entry.number) : [...songs, entry.number] }
        })
        flash(has ? `Removed from ${name}` : `Saved to ${name}`)
        return
      }
      const store = usePlaylistStore.getState()
      void (has ? store.removeSong(id, entry.number) : store.addSong(id, entry.number)).then((result) => {
        if (!isPlaylist(result)) return reportPlaylistFailure(result)
        flash(has ? `Removed from ${name}` : `Saved to ${name}`)
        void store.flushSync()
      })
    },
    [playlists, flash, reportPlaylistFailure],
  )

  const newPlaylist = useCallback(
    (entry: CatalogEntry) => {
      if (MOCKUP_DATA) return flash("Playlists are not available in the preview")
      const store = usePlaylistStore.getState()
      const name = `Playlist ${store.playlists.length + 1}`
      void store.createPlaylist(name).then((created) => {
        if (!isPlaylist(created)) return reportPlaylistFailure(created)
        void store.addSong(created.id, entry.number).then((result) => {
          if (!isPlaylist(result)) return reportPlaylistFailure(result)
          flash(`Created ${name}`)
          void store.flushSync()
        })
      })
    },
    [flash, reportPlaylistFailure],
  )

  const removal = useMemo(() => rowRemoval(listId), [listId])

  /** Catalogue and system lists: hide the song from this list on this phone only (nothing is deleted). */
  const hide = useCallback(
    (entry: CatalogEntry) => {
      useSongsListState.getState().hide(listId, entry.number)
      flash(hiddenToast(listName))
    },
    [listId, listName, flash],
  )

  /** Own playlist: really remove the song through the playlist store; Undo puts it back for 5 s. */
  const removeFromPlaylist = useCallback(
    (entry: CatalogEntry) => {
      if (removal.kind !== "playlist") return
      const { playlistId } = removal
      const store = usePlaylistStore.getState()
      void store.removeSong(playlistId, entry.number).then((result) => {
        if (!isPlaylist(result)) return reportPlaylistFailure(result)
        flash(
          removedToast(listName),
          {
            label: "Undo",
            onPress: () => {
              dismissToast()
              void usePlaylistStore
                .getState()
                .addSong(playlistId, entry.number)
                .then((back) => {
                  if (!isPlaylist(back)) return reportPlaylistFailure(back)
                  void usePlaylistStore.getState().flushSync()
                })
            },
          },
          UNDO_MS,
        )
        void usePlaylistStore.getState().flushSync()
      })
    },
    [removal, listName, flash, dismissToast, reportPlaylistFailure],
  )

  /** The last row of the song menu: hides or removes, by the kind of list. */
  const removeRow = useCallback(
    (entry: CatalogEntry) => (removal.kind === "playlist" ? removeFromPlaylist(entry) : hide(entry)),
    [removal, removeFromPlaylist, hide],
  )
  const showHidden = useCallback(() => {
    useSongsListState.getState().unhideAll(listId)
    flash("Hidden songs are back")
  }, [listId, flash])

  const sortOptionTitle = LIST_SORTS.find((s) => s.key === sort)?.title ?? "Number"

  return {
    toast,
    toastAction,
    removal,
    chips,
    chip: activeChip,
    setChip,
    sort,
    setSort,
    sortOptionTitle,
    base,
    shown,
    meta,
    empty,
    saved,
    downloaded,
    downloading,
    currentNumber,
    download: download as DownloadAllState,
    downloadedCount: downloadedHere.length,
    hiddenCount: hidden.size,
    playingHere,
    open: actions.open,
    share: actions.share,
    play,
    shuffle,
    playRow,
    toggleDownload,
    downloadAll,
    removeAllDownloads,
    playNextEntry,
    queueEntry,
    queueAll,
    toggleSave,
    playlistRows,
    togglePlaylist,
    newPlaylist,
    hide,
    removeFromPlaylist,
    removeRow,
    showHidden,
  }
}
