import { westernToMidi, type HarmoniumKeyboardKey } from "@prabhat/core"

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

function isBlackMidi(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(((midi % 12) + 12) % 12)
}

/**
 * Cut a window out of the 25-key layout and re-base the key geometry
 * (whiteIndex and blackLeftPercent) so the window draws as a keyboard of its own.
 * A window never starts or ends on a black key: the edges move out to the next
 * white key so every black key sits between two whites.
 */
export function sliceKeyboard(
  keys: readonly HarmoniumKeyboardKey[],
  start: number,
  length: number,
): { keys: HarmoniumKeyboardKey[]; firstIndex: number } {
  let first = Math.max(0, Math.min(keys.length - 1, start))
  let end = Math.max(first + 1, Math.min(keys.length, first + length))

  const blackAt = (index: number) => {
    const midi = westernToMidi(keys[index]!.western)
    return midi !== null && isBlackMidi(midi)
  }
  while (first > 0 && blackAt(first)) first -= 1
  while (end < keys.length && blackAt(end - 1)) end += 1

  const slice = keys.slice(first, end)
  const whiteCount = slice.filter((key) => !key.isBlack).length
  let whitesSeen = 0
  const rebased = slice.map((key) => {
    if (key.isBlack) {
      const whiteIndex = whitesSeen - 1
      return { ...key, whiteIndex, blackLeftPercent: ((whiteIndex + 0.72) / Math.max(1, whiteCount)) * 100 }
    }
    const whiteIndex = whitesSeen
    whitesSeen += 1
    return { ...key, whiteIndex, blackLeftPercent: 0 }
  })
  return { keys: rebased, firstIndex: first }
}

/** Index of the key in a sliced window that is closest to a position in the full layout. */
export function windowIndexOf(firstIndex: number, fullIndex: number, windowLength: number): number {
  const local = fullIndex - firstIndex
  return local >= 0 && local < windowLength ? local : -1
}
