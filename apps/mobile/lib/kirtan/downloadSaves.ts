import { kiirtanIdForNumber } from "@/lib/kirtan/track"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * A download is a save (Dada, 10 Nov 2026): when a Kiirtan or Bhajan starts to download, it is also put in Saved (when it was not there yet).
 * Saved and Downloaded are one list; "downloaded" is the little arrow on the row and the "Only on this phone" switch. Songs are not
 * touched here. Safe to call twice and for an item that is not a Kiirtan (nothing happens).
 */
export function saveKiirtanOnDownload(item: { kind: string; number: number }): void {
  if (item.kind !== "kiirtan") return
  const id = kiirtanIdForNumber(item.number)
  if (!id) return
  const store = useKirtanStore.getState()
  if (!store.savedIds.includes(id)) store.toggleSaved(id)
}
