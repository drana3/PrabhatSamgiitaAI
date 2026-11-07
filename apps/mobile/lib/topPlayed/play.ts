import { demoKirtanById } from "@/lib/fixtures/searchMenuDemo"
import { t } from "@/lib/i18n"
import { isAuthorBlocked } from "@/lib/kirtan/blocked"
import { kirtanById } from "@/lib/kirtan/catalog"
import { playQueue } from "@/lib/kirtan/mixPlayback"
import { fromRemote } from "@/lib/kirtan/submissions"
import { kiirtanNumber, registerKiirtans } from "@/lib/kirtan/track"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import type { TopItem } from "@/lib/topPlayed/types"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * Tap on a Top Played row: the list from that row down becomes the queue of the one player (so it carries on down the
 * chart). A song plays by its catalogue number; a recording needs the library to know it first (the server sends its
 * record with the row). Returns a message when it cannot play (a recording that left the library), null when it started.
 */

function recordingOf(item: TopItem): Kirtan | null {
  if (item.ref !== "rec") return null
  if (item.recording) {
    // The server's record bypasses the library's blocked filter, so check it here, before it is added anywhere.
    const remote = fromRemote(item.recording)
    if (isAuthorBlocked(remote)) return null
    useKirtanStore.getState().addToCatalog([item.recording])
    return remote
  }
  const known = kirtanById(`srv-${item.id}`) ?? kirtanById(item.id) ?? (MOCKUP_DATA ? demoKirtanById(item.id) : null)
  return known && !isAuthorBlocked(known) ? known : null
}

export function playTopItem(items: readonly TopItem[], index: number): string | null {
  const start = items[index]
  if (!start) return null
  const numbers: number[] = []
  let wanted: number | null = null
  const known: Kirtan[] = []
  items.slice(index).forEach((item, offset) => {
    let number: number | null = null
    if (item.ref === "ps") number = item.songNumber
    else {
      const k = recordingOf(item)
      if (k && k.status === "published") {
        known.push(k)
        number = kiirtanNumber(k.id)
      }
    }
    if (number == null) return
    numbers.push(number)
    if (offset === 0) wanted = number
  })
  if (wanted == null) return t("history.gone")
  registerKiirtans(known)
  return playQueue(numbers, { id: "top-played", name: t("top.title") }, wanted)
}
