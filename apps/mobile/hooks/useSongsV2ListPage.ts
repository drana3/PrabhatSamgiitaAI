import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter } from "expo-router"

import type { MenuPlaylist } from "@/components/songs-v2/ListSheets"
import type { ToastAction } from "@/components/songs-v2/Toast"
import { useSongsV2Actions } from "@/hooks/useSongsV2Actions"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { MOCK_PLAYLISTS, MOCK_RECENT } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { confirmRemoveMany } from "@/lib/offline/downloadActions"
import { songDownloadItem } from "@/lib/offline/downloadItems"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { playlistSongNumbers, starterSongForNumber } from "@/lib/playPlaylist"
import { useDemoDownloads } from "@/lib/playerV2/demoDownloads"
import { addToQueue, playNext } from "@/lib/playerV2/queueOps"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import {
  CATEGORY_CHIPS,
  DEFAULT_LIST_SORT,
  LIST_SORTS,
  buildPlayPlan,
  buildShufflePlan,
  emptyMessage,
  filterByChip,
  listSourceId,
  metaLine,
  sortList,
  visibleChips,
  withoutHidden,
  type ListContext,
  type ListSortKey,
  type PlayPlan,
} from "@/lib/songsV2/listPage"
import { useSongsListState } from "@/lib/songsV2/listState"
import { queueToast } from "@/lib/songsV2/playAll"
import { UNDO_MS, hiddenToast, removedToast, rowRemoval } from "@/lib/songsV2/rowMenu"
import { askNewPlaylist } from "@/stores/playlistSheetsStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

const EMPTY: readonly number[] = []

/** State and actions of a playlist-style page. `entries` is the whole list; hidden songs are dropped here. */
export function useSongsV2ListPage({ listId, listName, entries }: { listId: string; listName: string; entries: readonly CatalogEntry[] }) {
  const router = useRouter()
  const t = useT()
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
  const chips = useMemo(() => visibleChips(base, ctx), [base, ctx, t])
  const activeChip = chips.some((c) => c.id === chip) ? chip : "all"
  const shown = useMemo(() => sortList(filterByChip(base, activeChip, ctx), sort, recent), [base, activeChip, ctx, sort, recent])
  const shownNumbers = useMemo(() => shown.map((e) => e.number), [shown])
  const meta = useMemo(() => metaLine(base), [base, t])
  const chipLabel = chips.find((c) => c.id === activeChip)?.label ?? t("home.filter.all")
  const empty = base.length === 0 ? "" : emptyMessage(activeChip, chipLabel)
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

  /* ---- downloads: the one shared flow (lib/offline/downloadActions.ts) asks first, then removes */
  const removeAllDownloads = useCallback(() => {
    void confirmRemoveMany(
      listName,
      downloadedHere.map((n) => songDownloadItem(n)),
    )
  }, [listName, downloadedHere])

  /* ---- row menu */
  const playNextEntry = useCallback(
    (entry: CatalogEntry) => {
      const state = usePlayerStore.getState()
      state.setQueue(playNext(state.queue, state.currentSong?.number ?? null, entry.number))
      flash(state.currentSong ? t("songs.toast.playsNext", { number: entry.number }) : t("songs.toast.addedQueue", { number: entry.number }))
    },
    [flash, t],
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
    flash(t("songs.toast.addedMany", { count: shownNumbers.length }))
  }, [shownNumbers, flash, t])

  /** The circle-plus, the swipe and the row menu all open the one "Save to" sheet, which says what happened. */
  const toggleSave = useCallback((entry: CatalogEntry) => actions.toggleSave(entry), [actions])

  const playlistRows = useCallback(
    (entry: CatalogEntry | null): MenuPlaylist[] => {
      if (!entry) return []
      const count = (n: number) => t("songs.count", { count: n })
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
    [playlists, mockPlaylistSongs, t],
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
      const name = (MOCKUP_DATA ? MOCK_PLAYLISTS : playlists).find((p) => p.id === id)?.name ?? t("songs.playlistFallback")
      if (MOCKUP_DATA) {
        setMockPlaylistSongs((all) => {
          const songs = all[id] ?? []
          return { ...all, [id]: has ? songs.filter((n) => n !== entry.number) : [...songs, entry.number] }
        })
        flash(has ? t("songs.toast.removedFrom", { name }) : t("songs.toast.savedTo", { name }))
        return
      }
      const store = usePlaylistStore.getState()
      void (has ? store.removeSong(id, entry.number) : store.addSong(id, entry.number)).then((result) => {
        if (!isPlaylist(result)) return reportPlaylistFailure(result)
        flash(has ? t("songs.toast.removedFrom", { name }) : t("songs.toast.savedTo", { name }))
        void store.flushSync()
      })
    },
    [playlists, flash, reportPlaylistFailure, t],
  )

  // "New playlist" in a song's menu: the name sheet (default name selected), then the song goes in.
  // The menu sheet that asked is a native modal too, so the name sheet waits a moment for it to leave.
  const newPlaylist = useCallback(
    (entry: CatalogEntry) => {
      if (MOCKUP_DATA) return flash(t("songs.toast.noPreviewPlaylists"))
      setTimeout(
        () =>
          askNewPlaylist((created) =>
            usePlaylistStore
              .getState()
              .addSong(created.id, entry.number)
              .then((result) => {
                if (!isPlaylist(result)) return reportPlaylistFailure(result)
                flash(t("songs.toast.created", { name: created.name }))
                void usePlaylistStore.getState().flushSync()
              }),
          ),
        280,
      )
    },
    [flash, reportPlaylistFailure, t],
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
            label: t("common.undo"),
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
    [removal, listName, flash, dismissToast, reportPlaylistFailure, t],
  )

  /** The last row of the song menu: hides or removes, by the kind of list. */
  const removeRow = useCallback(
    (entry: CatalogEntry) => (removal.kind === "playlist" ? removeFromPlaylist(entry) : hide(entry)),
    [removal, removeFromPlaylist, hide],
  )
  const showHidden = useCallback(() => {
    useSongsListState.getState().unhideAll(listId)
    flash(t("songs.toast.hiddenBack"))
  }, [listId, flash, t])

  const sortOptionTitle = LIST_SORTS.find((s) => s.key === sort)?.title ?? t("songs.lsort.num.title")

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
    downloadedCount: downloadedHere.length,
    hiddenCount: hidden.size,
    playingHere,
    open: actions.open,
    share: actions.share,
    play,
    shuffle,
    playRow,
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
