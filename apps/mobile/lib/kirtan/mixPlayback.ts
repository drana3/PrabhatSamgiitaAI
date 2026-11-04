import { runFrom, type Mix, type MixItem } from "@/lib/kirtan/mix"
import { starterSongForNumber } from "@/lib/playPlaylist"
import { useKirtanPlayerStore, type MixSession } from "@/stores/kirtanPlayerStore"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * Playing a mix. Songs play in the song player, kirtans in the kirtan player, so the mix hands over
 * between the two by opening the other screen. That is NOT gapless: there is a short pause while the
 * other player opens. A run of songs in a row plays in the song player as one queue.
 */

export type Navigate = (path: string) => void

export function newSession(mix: Pick<Mix, "id">, items: readonly MixItem[], index = 0): MixSession {
  return { mixId: mix.id, items: [...items], index }
}

/** Starts the item at `index` of the session in the right player. */
export function startMixItem(navigate: Navigate, session: MixSession, index: number): void {
  const item = session.items[index]
  if (!item) return
  useKirtanPlayerStore.getState().startMix({ ...session, index })
  if (item.kind === "kirtan") {
    navigate(`/kirtan-player?id=${encodeURIComponent(item.id)}`)
    return
  }
  const run = runFrom(session.items, index)
  const numbers = (run?.items ?? [item]).flatMap((i) => (i.kind === "ps" ? [i.number] : []))
  usePlayerStore.getState().loadSong(starterSongForNumber(numbers[0]), numbers, "playlist")
  navigate("/player-v2")
}
