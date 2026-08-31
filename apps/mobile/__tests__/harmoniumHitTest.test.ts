import { describe, expect, it } from "vitest"
import { harmoniumKeyboardLayout } from "@prabhat/core"

import { hitTestHarmoniumKey } from "@/lib/harmoniumHitTest"

describe("harmoniumHitTest", () => {
  const keys = harmoniumKeyboardLayout("C")
  const whiteKeys = keys.filter((key) => !key.isBlack)
  const blackKeys = keys.filter((key) => key.isBlack)
  const layout = { width: 700, height: 220, blackKeyWidth: 40, blackKeyHeight: 140 }

  it("prefers black keys over overlapping white keys", () => {
    const black = blackKeys[0]
    if (!black) return
    const x = (black.blackLeftPercent / 100) * layout.width
    const index = hitTestHarmoniumKey(x, layout.blackKeyHeight * 0.5, layout, keys, whiteKeys, blackKeys)
    expect(index).toBe(keys.indexOf(black))
  })

  it("maps white key touches in the lower keyboard area", () => {
    const white = whiteKeys[3]
    if (!white) return
    const whiteWidth = layout.width / whiteKeys.length
    const x = whiteKeys.indexOf(white) * whiteWidth + whiteWidth / 2
    const index = hitTestHarmoniumKey(x, layout.height - 10, layout, keys, whiteKeys, blackKeys)
    expect(index).toBe(keys.indexOf(white))
  })
})
