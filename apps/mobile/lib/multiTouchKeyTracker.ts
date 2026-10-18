/** Tracks multiple simultaneous touches per keyboard key (harmonium-style polyphony). */
export function createMultiTouchKeyTracker() {
  const touchToKey = new Map<number, number>()
  const keyTouches = new Map<number, Set<number>>()

  return {
    touchDown(touchId: number, keyIndex: number): boolean {
      if (!keyTouches.has(keyIndex)) keyTouches.set(keyIndex, new Set())
      const touches = keyTouches.get(keyIndex)!
      const firstOnKey = touches.size === 0
      touches.add(touchId)
      touchToKey.set(touchId, keyIndex)
      return firstOnKey
    },

    touchUp(touchId: number): { keyIndex: number; lastOnKey: boolean } | null {
      const keyIndex = touchToKey.get(touchId)
      if (keyIndex === undefined) return null
      touchToKey.delete(touchId)
      const touches = keyTouches.get(keyIndex)
      if (!touches) return null
      touches.delete(touchId)
      const lastOnKey = touches.size === 0
      if (lastOnKey) keyTouches.delete(keyIndex)
      return { keyIndex, lastOnKey }
    },

    touchMove(
      touchId: number,
      keyIndex: number,
    ): { releasedKey: number; releasedLast: boolean; pressedKey: number; pressedFirst: boolean } | null {
      const current = touchToKey.get(touchId)
      if (current === undefined || current === keyIndex) return null

      const currentTouches = keyTouches.get(current)
      if (!currentTouches) return null
      currentTouches.delete(touchId)
      const releasedLast = currentTouches.size === 0
      if (releasedLast) keyTouches.delete(current)

      if (!keyTouches.has(keyIndex)) keyTouches.set(keyIndex, new Set())
      const nextTouches = keyTouches.get(keyIndex)!
      const pressedFirst = nextTouches.size === 0
      nextTouches.add(touchId)
      touchToKey.set(touchId, keyIndex)

      return { releasedKey: current, releasedLast, pressedKey: keyIndex, pressedFirst }
    },

    reset() {
      touchToKey.clear()
      keyTouches.clear()
    },
  }
}

export type MultiTouchKeyTracker = ReturnType<typeof createMultiTouchKeyTracker>
