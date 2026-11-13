import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8")

describe("Shuffle and Repeat show no pop-up text", () => {
  const screen = read("app/player-v2.tsx")

  it("the screen never shows a toast for repeat or shuffle", () => {
    const repeat = screen.slice(screen.indexOf("const onRepeat"), screen.indexOf("const onShuffle"))
    expect(repeat).not.toMatch(/toast\./)
    const shuffle = screen.slice(screen.indexOf("const onShuffle"), screen.indexOf("const onShuffle") + 200)
    expect(shuffle).not.toMatch(/toast\./)
    expect(screen).not.toMatch(/repeatMessage\(/)
  })

  it("the buttons keep their state visible and spoken", () => {
    const row = read("components/player-v2/TransportRow.tsx")
    expect(row).toMatch(/accessibilityState=\{\{ selected: shuffleOn \}\}/)
    expect(row).toMatch(/accessibilityState=\{\{ selected: repeatMode !== "off" \}\}/)
    expect(row).toMatch(/accessibilityLabel=\{REPEAT_NAME\[repeatMode\]\}/)
    expect(row).toMatch(/playerColors\.gold/)
  })
})
