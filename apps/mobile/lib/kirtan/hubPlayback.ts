import { ensureKirtansRegistered } from "@/lib/kirtan/catalog"
import { listKindOf } from "@/lib/kirtan/kind"
import { playQueue } from "@/lib/kirtan/mixPlayback"
import { kiirtanListSourceName, kiirtanQueue, shuffled } from "@/lib/kirtan/queueBuild"
import type { Kirtan } from "@/lib/kirtan/types"
import { t } from "@/lib/i18n"

/**
 * "Shuffle this list" of a category or of Saved: the list's recordings in a random order as one queue named after the list. The plain
 * order is kept so the Shuffle button of the player can undo it. ("Play all" is `playKiirtans` of lib/kirtan/mixPlayback.)
 * Returns a message when nothing can play.
 */
export function playListShuffled(list: readonly Kirtan[], label?: string | null, rng: () => number = Math.random): string | null {
  const ordered = kiirtanQueue(list)
  ensureKirtansRegistered()
  if (!ordered.length) return t("kt.nothingToPlay")
  const queue = shuffled(ordered, rng)
  const name = kiirtanListSourceName(label, listKindOf(list))
  return playQueue(queue, { id: `kiirtans:${name}:shuffle`, name }, queue[0] ?? null, ordered)
}
