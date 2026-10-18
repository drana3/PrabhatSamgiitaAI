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
    expect(seekBar).toMatch(/onPressIn/)
    expect(seekBar).toMatch(/Drag to change playback position/)
    expect(listen).toMatch(/Jump back 10 seconds/)
    expect(listen).toMatch(/Turn off repeat/)
    expect(listen).toMatch(/Repeat this song/)
    expect(listen).toMatch(/Recordings/)
    expect(listen).not.toMatch(/Saved to:/)
    expect(listen).not.toMatch(/Share downloaded recording/)
    expect(listen).toMatch(/Remove from this app/)
    const recordingsAt = listen.indexOf("Recordings")
    const seekAt = listen.indexOf("<SeekBar", recordingsAt)
    expect(seekAt).toBeGreaterThan(recordingsAt)
  })
})
