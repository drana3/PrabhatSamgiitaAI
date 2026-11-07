import type { Kirtan } from "@/lib/kirtan/types"
import { DEMO_BABA } from "@/lib/fixtures/searchMenuDemo"
import { allKirtans, ensureKirtansRegistered } from "@/lib/kirtan/catalog"
import { kiirtanNumber } from "@/lib/kirtan/track"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { playableNumbersList, setRadioPicker } from "@/lib/playableAudio"
import { getPopularity } from "@/lib/radio/popularity"
import { effectiveSelection } from "@/lib/radio/categories"
import { createRadioPicker, type PickerDeps, type RadioPicker } from "@/lib/radio/picker"
import type { PoolSource } from "@/lib/radio/pool"
import { useListeningHistoryStore } from "@/stores/listeningHistoryStore"
import { topPlayedApi } from "@/lib/topPlayed/api"
import { loadPopularity } from "@/lib/topPlayed/popularityLoad"
import { useRadioSelectionStore } from "@/stores/radioSelectionStore"

/**
 * The real wiring of the Radio picker: the person's stores in, `setRadioPicker` out. Importing this file installs the
 * picker (radioAdvance and the Radio screen import it); a change of the choice is applied by `applyRadioSelection`.
 */

/** A recording the Radio may play: published, and with a file (the preview has none and simulates the clock). */
function playableRecordings(): Kirtan[] {
  // the preview also has its three sample discourses (they are not in the library, only on the Search menu shelf)
  const base = allKirtans()
  const all = MOCKUP_DATA ? [...base, ...DEMO_BABA.filter((d) => !base.some((k) => k.id === d.id))] : base
  return all.filter((k) => k.status === "published" && (MOCKUP_DATA || Boolean(k.audioUrl?.trim())))
}

export function liveSource(): PoolSource {
  return {
    psNumbers: playableNumbersList(),
    recordings: playableRecordings(),
    plays: getPopularity(),
  }
}

export const livePickerDeps: PickerDeps = {
  selected: () => useRadioSelectionStore.getState().selected,
  source: liveSource,
  history: () => useListeningHistoryStore.getState().entries,
  now: () => Date.now(),
  recordingNumber: (id) => {
    // The number must be handed out and the track registered before the player is asked to load it.
    ensureKirtansRegistered()
    return kiirtanNumber(id)
  },
}

let picker: RadioPicker | null = null

export function radioPicker(): RadioPicker {
  if (!picker) picker = createRadioPicker(livePickerDeps)
  return picker
}

/** Counts and pools as the chips show them. */
export function radioPools() {
  return radioPicker().pools()
}

/** A fresh session: a new seed and no memory of earlier picks (the Radio screen calls it when a radio starts). */
export function startRadioMix(seed?: number): void {
  radioPicker().reset(seed)
  // the popularity boost reads the server's Top Played counts; fetched in the background, never awaited
  void loadPopularity(topPlayedApi())
}

export function installRadioPicker(): void {
  setRadioPicker((exclude) => radioPicker().next(exclude))
}

/** Is the last prefetched pick still allowed by the choice? (If not, the Radio swaps the upcoming track.) */
export function lastPickStillAllowed(): boolean {
  const last = radioPicker().lastPick()
  if (!last) return true
  const chosen = effectiveSelection(useRadioSelectionStore.getState().selected, radioPools().counts)
  return chosen.includes(last.category)
}

installRadioPicker()
