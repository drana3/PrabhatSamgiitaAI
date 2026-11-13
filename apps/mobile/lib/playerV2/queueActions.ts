import {
  addToQueue,
  clearUpcoming,
  moveItem,
  playNext,
  removeNumber,
  restoreOrder,
  shuffleUpcoming,
} from "@/lib/playerV2/queueOps"

export type QueueActionDeps = {
  /** The list auto-advance walks, and the song that is playing in it. */
  getQueue: () => { numbers: number[]; current: number | null; random: boolean }
  replaceQueue: (numbers: number[]) => void
  getShuffleOriginal: () => number[] | null
  setShuffleOriginal: (queue: number[] | null) => void
  rng?: () => number
}

/** Queue edits for the Queue sheet and the song rows ("Play next", "Add to queue"). */
export function createQueueActions(deps: QueueActionDeps) {
  const read = () => deps.getQueue().numbers
  return {
    reorder(from: number, to: number) {
      deps.replaceQueue(moveItem(read(), from, to))
    },
    /** After a drag-and-drop list hands back the whole new order. */
    setOrder(numbers: number[]) {
      deps.replaceQueue(numbers)
    },
    remove(number: number) {
      deps.replaceQueue(removeNumber(read(), number))
    },
    clearUpcoming() {
      const { numbers, current } = deps.getQueue()
      deps.replaceQueue(clearUpcoming(numbers, current))
    },
    playNext(number: number) {
      const { numbers, current } = deps.getQueue()
      deps.replaceQueue(playNext(numbers, current, number))
    },
    add(number: number) {
      deps.replaceQueue(addToQueue(read(), number))
    },
    /** Returns whether shuffle is on afterwards. Drive random sessions cannot be shuffled. */
    toggleShuffle(): boolean {
      const { numbers, current, random } = deps.getQueue()
      if (random) return false
      const original = deps.getShuffleOriginal()
      if (original) {
        deps.replaceQueue(restoreOrder(numbers, original))
        deps.setShuffleOriginal(null)
        return false
      }
      deps.setShuffleOriginal(numbers)
      deps.replaceQueue(shuffleUpcoming(numbers, current, deps.rng))
      return true
    },
  }
}
