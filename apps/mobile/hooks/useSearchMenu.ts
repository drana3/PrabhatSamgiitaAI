import { useEffect, useMemo, useState } from "react"

import { useKirtans } from "@/hooks/useKirtans"
import { demoCatalog, demoHistory, parseStage, stageHasBaba, type MenuStage } from "@/lib/fixtures/searchMenuDemo"
import { remoteConfig } from "@/lib/kirtan/api"
import { authorsApi } from "@/lib/authors/api"
import type { HistoryEntry } from "@/lib/listening/history"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { realCollectionEntries } from "@/lib/searchBrowse"
import { buildLiveMenu, type DirectoryAuthor, type MenuKirtan } from "@/lib/searchMenu/live"
import { fetchMenuPins } from "@/lib/searchMenu/remote"
import type { MenuResult, MenuStats } from "@/lib/searchMenu/types"
import { useListeningHistoryStore } from "@/stores/listeningHistoryStore"
import { useSearchMenuStore } from "@/stores/searchMenuStore"

/** Pins are read at most once a day (the list is tiny and rarely changes). */
const PINS_EVERY_MS = 24 * 60 * 60 * 1000
const DIRECTORY_LIMIT = 50

export type SearchMenu = {
  result: MenuResult
  stats: MenuStats
  /** the recordings the menu was counted from (the shelves list from the same set) */
  kirtans: readonly MenuKirtan[]
  now: number
  /** this phone's own listening history for the "Listen again" strip (the preview's early stages show none) */
  history: readonly HistoryEntry[]
  /** the preview's sample stage, when one is shown (`?menu=new|early|grown`) */
  stage: MenuStage | null
}

/**
 * The Search menu for this open of the screen: the recordings the app holds, the real author listener counts, the team's
 * pins and this phone's own listening history go through `buildMenu`. The preview shows a sample stage instead (default
 * "grown"); the stage never writes the remembered menu. Counted once per open and whenever the data changes.
 */
export function useSearchMenu(stageParam?: string): SearchMenu {
  const { playable } = useKirtans()
  const history = useListeningHistoryStore((s) => s.entries)
  const storedPins = useSearchMenuStore((s) => s.pins)
  const [directory, setDirectory] = useState<readonly DirectoryAuthor[]>([])
  const stage = MOCKUP_DATA ? (parseStage(stageParam) ?? "grown") : null
  const [now] = useState(() => (MOCKUP_DATA ? Date.UTC(2026, 10, 7, 12) : Date.now()))

  useEffect(() => {
    if (MOCKUP_DATA) return undefined
    let live = true
    const { pinsAt, setPins } = useSearchMenuStore.getState()
    if (Date.now() - pinsAt >= PINS_EVERY_MS) {
      fetchMenuPins(remoteConfig()).then(
        (pins) => live && setPins(pins, Date.now()),
        () => undefined,
      )
    }
    authorsApi()
      .directory({ sort: "listeners", limit: DIRECTORY_LIMIT, kind: "kiirtan" })
      .then(
        (page) =>
          live &&
          setDirectory(page.items.map((a) => ({ name: a.display_name, recordings: a.recordings_count, listeners30: a.monthly_listeners ?? null }))),
        () => undefined,
      )
    return () => {
      live = false
    }
  }, [])

  const computed = useMemo(() => {
    const kirtans: readonly MenuKirtan[] = stage ? demoCatalog(playable, stage) : playable
    const entries = stage ? demoHistory(stage, now) : history
    const { result, stats } = buildLiveMenu({
      kirtans,
      psCollections: psCollectionCounts(),
      history: entries,
      pins: stage ? [] : storedPins,
      memory: stage ? undefined : useSearchMenuStore.getState().memory,
      directory: stage ? undefined : directory,
      now,
    })
    return { result, stats, kirtans }
  }, [playable, history, storedPins, directory, stage, now])

  // Remember what the menu showed so a shelf at its threshold does not blink (never from the preview's sample stages).
  useEffect(() => {
    if (!stage) useSearchMenuStore.getState().setMemory(computed.result.memory)
  }, [computed.result.memory, stage])

  // the preview's early stages show no history; the others show the sample history of what that sample library holds
  const shownHistory = !stage ? history : stage === "new" || stage === "early" ? [] : stageHasBaba(stage) ? history : history.filter((e) => e.kind !== "baba_audio")
  return { ...computed, now, stage, history: shownHistory }
}

/** Collection kinds with how many non-empty collections each holds, in display order. */
function psCollectionCounts(): { kind: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const entry of realCollectionEntries()) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1)
  return [...counts].map(([kind, count]) => ({ kind, count }))
}
