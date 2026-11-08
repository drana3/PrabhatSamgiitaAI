import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import { createPreviewCore, type PreviewEngine } from "@/lib/kirtan/previewCore"

/** An engine whose loads finish when the test says so, and that remembers what it started and stopped. */
function fakeEngine() {
  const started: string[] = []
  const stopped: string[] = []
  const ends = new Map<string, () => void>()
  const gates: Array<{ url: string; open: () => void }> = []
  let hold = false
  let fail = false
  const engine: PreviewEngine = {
    yieldOthers: vi.fn(async () => undefined),
    load: async (url, onEnd) => {
      if (fail) throw new Error("no network")
      if (hold) await new Promise<void>((resolve) => gates.push({ url, open: resolve }))
      started.push(url)
      ends.set(url, onEnd)
      return { stop: async () => void stopped.push(url) }
    },
  }
  return {
    engine,
    started,
    stopped,
    ends,
    gates,
    holdLoads: (on: boolean) => (hold = on),
    failLoads: (on: boolean) => (fail = on),
  }
}

describe("the duplicate card's preview player", () => {
  it("plays one clip and says which one", async () => {
    const f = fakeEngine()
    const core = createPreviewCore(f.engine)
    expect(await core.play("a", "https://x/a.mp3")).toBe("playing")
    expect(core.playing()).toBe("a")
    expect(f.engine.yieldOthers).toHaveBeenCalledTimes(1)
  })

  it("a tap on the clip that plays stops it", async () => {
    const f = fakeEngine()
    const core = createPreviewCore(f.engine)
    await core.play("a", "https://x/a.mp3")
    expect(await core.play("a", "https://x/a.mp3")).toBe("stopped")
    expect(core.playing()).toBeNull()
    expect(f.stopped).toEqual(["https://x/a.mp3"])
  })

  it("starting another clip stops the first (one at a time)", async () => {
    const f = fakeEngine()
    const core = createPreviewCore(f.engine)
    await core.play("a", "https://x/a.mp3")
    await core.play("b", "https://x/b.mp3")
    expect(core.playing()).toBe("b")
    expect(f.stopped).toEqual(["https://x/a.mp3"])
  })

  it("stop() silences it, and a clip that was still loading never starts to sound", async () => {
    const f = fakeEngine()
    f.holdLoads(true)
    const core = createPreviewCore(f.engine)
    const pending = core.play("a", "https://x/a.mp3")
    await new Promise((r) => setTimeout(r, 0)) // the load is under way
    expect(f.gates).toHaveLength(1)
    await core.stop() // the card closed while the file was loading
    f.gates[0]!.open()
    expect(await pending).toBe("stopped")
    expect(core.playing()).toBeNull()
    expect(f.stopped).toEqual(["https://x/a.mp3"]) // the late clip was let go at once
  })

  it("a load that comes after a newer tap is thrown away", async () => {
    const f = fakeEngine()
    f.holdLoads(true)
    const core = createPreviewCore(f.engine)
    const first = core.play("a", "https://x/a.mp3")
    await new Promise((r) => setTimeout(r, 0)) // a's load is under way
    const second = core.play("b", "https://x/b.mp3")
    await new Promise((r) => setTimeout(r, 0))
    expect(f.gates).toHaveLength(2)
    f.gates.forEach((g) => g.open())
    expect(await first).toBe("stopped")
    expect(await second).toBe("playing")
    expect(core.playing()).toBe("b")
    expect(f.stopped).toContain("https://x/a.mp3")
  })

  it("a clip that ends by itself leaves nothing playing", async () => {
    const f = fakeEngine()
    const core = createPreviewCore(f.engine)
    await core.play("a", "https://x/a.mp3")
    f.ends.get("https://x/a.mp3")!()
    expect(core.playing()).toBeNull()
  })

  it("a file that cannot be loaded ends in error with nothing playing", async () => {
    const f = fakeEngine()
    f.failLoads(true)
    const core = createPreviewCore(f.engine)
    expect(await core.play("a", "https://x/a.mp3")).toBe("error")
    expect(core.playing()).toBeNull()
  })

  it("tells the card when the playing clip changes", async () => {
    const f = fakeEngine()
    const core = createPreviewCore(f.engine)
    const seen: Array<string | null> = []
    const off = core.subscribe(() => seen.push(core.playing()))
    await core.play("a", "https://x/a.mp3")
    await core.stop()
    off()
    expect(seen).toEqual(["a", null])
  })
})

describe("the duplicate card is its own player", () => {
  const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8")

  it("does not touch the app's player, its queue or the radio", () => {
    for (const file of ["components/kirtan/add/DuplicateCard.tsx", "lib/kirtan/preview.ts", "lib/kirtan/previewCore.ts"]) {
      const source = read(file)
      expect(source, file).not.toMatch(/useKirtanActions|playerStore|playerV2|rntp|TrackPlayer|\.open\(/)
    }
  })

  it("stops the sound when the card closes and when the person answers", () => {
    const source = read("components/kirtan/add/DuplicateCard.tsx")
    expect(source).toMatch(/useEffect\(\(\) => \(\) => void stopPreview\(\), \[\]\)/)
    expect(source).toMatch(/const answer = \(go: \(\) => void\) => \{\s*void stopPreview\(\)/)
  })

  it("the queue row, and so the single form and the playlist track, use the card", () => {
    expect(read("components/kirtan/add/QueueRows.tsx")).toContain("<DuplicateCard")
    expect(read("components/kirtan/sets/SetTrackRow.tsx")).toContain("QueueRow")
  })

  it("'Yes, this is it' tells the person and goes back to choosing a file, in the form and in the playlist", () => {
    expect(read("app/add-kirtan.tsx")).toMatch(/ugc\.similar\.already[\s\S]*focusFirst\(\["file"\]/)
    expect(read("app/upload-set.tsx")).toMatch(/ugc\.similar\.already[\s\S]*setStep\(0\)/)
  })
})
