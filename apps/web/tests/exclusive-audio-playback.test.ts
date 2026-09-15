import { bindExclusiveAudioPlayback } from "@/lib/exclusive-audio-playback"

describe("exclusive audio playback", () => {
  it("pauses other audio elements when one starts playing", () => {
    const first = document.createElement("audio")
    const second = document.createElement("audio")
    document.body.append(first, second)

    const releaseFirst = bindExclusiveAudioPlayback(first)
    const releaseSecond = bindExclusiveAudioPlayback(second)

    second.pause = vi.fn()
    Object.defineProperty(first, "paused", { configurable: true, get: () => false })
    Object.defineProperty(second, "paused", { configurable: true, get: () => false })

    first.dispatchEvent(new Event("play"))

    expect(second.pause).toHaveBeenCalledTimes(1)

    releaseFirst()
    releaseSecond()
    first.remove()
    second.remove()
  })
})
