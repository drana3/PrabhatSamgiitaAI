import { useMemo } from "react"

import { effectiveSelection, type RadioCategory, type RadioCounts } from "@/lib/radio/categories"
import { radioPools } from "@/lib/radio/live"
import { useKirtanStore } from "@/stores/kirtanStore"
import { useRadioSelectionStore } from "@/stores/radioSelectionStore"

/**
 * What the Radio screen and the mini-player show: the per-category counts (recordings come and go) and the choice as it
 * really applies (a chosen category that has nothing to play is left out). Recomputed when the library or the choice changes.
 */
export function useRadioPools(): { counts: RadioCounts; selected: RadioCategory[]; chosen: RadioCategory[] } {
  const selected = useRadioSelectionStore((s) => s.selected)
  const submissions = useKirtanStore((s) => s.submissions)
  const catalog = useKirtanStore((s) => s.catalog)
  const blocked = useKirtanStore((s) => s.blockedAuthorIds)
  return useMemo(() => {
    const { counts } = radioPools()
    return { counts, selected, chosen: effectiveSelection(selected, counts) }
    // the stores above are the inputs of radioPools(): a change in any of them changes the counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, submissions, catalog, blocked])
}
