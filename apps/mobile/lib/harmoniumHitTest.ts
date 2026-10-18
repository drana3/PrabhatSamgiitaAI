import type { HarmoniumKeyboardKey } from "@prabhat/core"

export type HarmoniumHitLayout = {
  width: number
  height: number
  blackKeyWidth: number
  blackKeyHeight: number
}

/** Black keys win over whites — matches real harmonium komal/tivra placement. */
export function hitTestHarmoniumKey(
  x: number,
  y: number,
  layout: HarmoniumHitLayout,
  keys: HarmoniumKeyboardKey[],
  whiteKeys: HarmoniumKeyboardKey[],
  blackKeys: HarmoniumKeyboardKey[],
): number {
  if (layout.width <= 0 || layout.height <= 0) return -1
  const clampedX = Math.max(0, Math.min(layout.width - 1, x))
  const clampedY = Math.max(0, Math.min(layout.height - 1, y))

  if (clampedY <= layout.blackKeyHeight) {
    for (const key of blackKeys) {
      const index = keys.indexOf(key)
      const left = (key.blackLeftPercent / 100) * layout.width - layout.blackKeyWidth / 2
      if (clampedX >= left && clampedX <= left + layout.blackKeyWidth) return index
    }
  }

  const whiteWidth = layout.width / Math.max(1, whiteKeys.length)
  const whiteIndex = Math.floor(clampedX / whiteWidth)
  if (whiteIndex < 0 || whiteIndex >= whiteKeys.length) return -1
  return keys.indexOf(whiteKeys[whiteIndex]!)
}
