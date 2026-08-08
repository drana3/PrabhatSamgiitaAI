import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "..")

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8")
}

describe("search mic UX contract", () => {
  it("defaults SearchBar mic to visible", () => {
    expect(read("components/common/SearchBar.tsx")).toMatch(/showMic\s*=\s*true/)
  })

  it("keeps a mic entry point on Home, Songs, Search, Collections, and AI", () => {
    expect(read("app/(tabs)/index.tsx")).toMatch(/HomeHeroSearch|Mic/)
    expect(read("app/(tabs)/songs.tsx")).toMatch(/showMic/)
    expect(read("app/search/index.tsx")).toMatch(/showMic/)
    expect(read("app/collections/index.tsx")).toMatch(/showMic/)
    expect(read("components/ai/AIComposer.tsx")).toMatch(/Mic/)
  })

  it("uses inline voice search on the search screen", () => {
    expect(read("app/search/index.tsx")).toMatch(/useVoiceSearch/)
    expect(read("app/search/index.tsx")).toMatch(/searchSongsByVoice/)
    expect(read("app/search/index.tsx")).toMatch(/params\.listen/)
  })
})
