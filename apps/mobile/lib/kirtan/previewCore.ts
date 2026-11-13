/**
 * The logic of the small preview player of the duplicate card ("Is this the song you want to upload?"), apart from the audio
 * engine so it can be tested without a phone. Rules:
 *
 *  - One preview at a time: starting another stops the first; tapping the one that plays stops it.
 *  - Every start takes a ticket. A load that finishes after a newer start (or after a stop) is thrown away, so a slow download
 *    never plays over the answer the person already gave, and a stopped card never makes a sound.
 *  - The engine is told to yield other audio first (a song or the radio pauses; the queue is NOT replaced or changed).
 *  - A clip that ends by itself returns the state to "nothing playing".
 *  - A failure to load ends in "error" with nothing playing; it never throws at the card.
 *
 * The expo-av engine and the hook are in `lib/kirtan/preview.ts`.
 */

export type PreviewHandle = { stop: () => Promise<void> }
export type PreviewEngine = {
  /** pauses whatever else plays (a song, the radio) and sets the audio session; does not touch the queue */
  yieldOthers: () => Promise<void>
  /** loads the clip and starts it; `onEnd` is called when it plays to the end */
  load: (url: string, onEnd: () => void) => Promise<PreviewHandle>
}
export type PreviewResult = "playing" | "stopped" | "error"

export function createPreviewCore(engine: PreviewEngine) {
  let playingId: string | null = null
  let handle: PreviewHandle | null = null
  let ticket = 0
  const listeners = new Set<() => void>()

  const emit = () => {
    for (const listener of [...listeners]) listener()
  }
  const setPlaying = (id: string | null) => {
    if (playingId === id) return
    playingId = id
    emit()
  }
  const release = async () => {
    const current = handle
    handle = null
    if (!current) return
    try {
      await current.stop()
    } catch {
      /* already stopped */
    }
  }

  const stop = async (): Promise<void> => {
    ticket += 1
    setPlaying(null)
    await release()
  }

  const play = async (id: string, url: string): Promise<PreviewResult> => {
    if (playingId === id) {
      await stop()
      return "stopped"
    }
    ticket += 1
    const mine = ticket
    setPlaying(id)
    await release()
    try {
      await engine.yieldOthers()
      if (mine !== ticket) return "stopped"
      const created = await engine.load(url, () => {
        if (mine === ticket) {
          ticket += 1
          handle = null
          setPlaying(null)
        }
      })
      if (mine !== ticket) {
        // replaced or stopped while loading
        await created.stop().catch(() => undefined)
        return "stopped"
      }
      handle = created
      return "playing"
    } catch {
      if (mine === ticket) setPlaying(null)
      return "error"
    }
  }

  return {
    play,
    stop,
    playing: () => playingId,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
