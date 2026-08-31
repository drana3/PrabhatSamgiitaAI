import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { seekSecondsFromTouch } from "@/lib/seekBar"

const root = path.resolve(__dirname, "..")

describe("seekSecondsFromTouch", () => {
  it("maps the left edge, midpoint, and right edge", () => {
    expect(seekSecondsFromTouch(0, 100, 200)).toBe(0)
    expect(seekSecondsFromTouch(50, 100, 200)).toBe(100)
    expect(seekSecondsFromTouch(100, 100, 200)).toBe(200)
  })

  it("clamps drags past the bar", () => {
    expect(seekSecondsFromTouch(-40, 100, 80)).toBe(0)
    expect(seekSecondsFromTouch(180, 100, 80)).toBe(80)
  })
})

describe("song listen transport", () => {
  it("scrubs by dragging the bar after more recordings, with skip back and forward", () => {
    const seekBar = readFileSync(path.join(root, "components/player/SeekBar.tsx"), "utf8")
    const listen = readFileSync(path.join(root, "components/player/SongListenControls.tsx"), "utf8")
    expect(seekBar).toMatch(/PanResponder/)
    expect(seekBar).toMatch(/onPanResponderMove/)
    expect(seekBar).toMatch(/Drag to change playback position/)
    expect(listen).toMatch(/Jump back 10 seconds/)
    expect(listen).toMatch(/Jump forward 10 seconds/)
    expect(listen).toMatch(/Enable repeat/)
    expect(listen).toMatch(/Disable repeat/)
    expect(listen).toMatch(/More recordings/)
    const moreAt = listen.indexOf("More recordings")
    const seekAt = listen.indexOf("<SeekBar", moreAt)
    expect(seekAt).toBeGreaterThan(moreAt)
  })
})
