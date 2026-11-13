import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "..")

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8")
}

describe("search mic UX contract", () => {
  it("keeps a mic entry point on the search screen", () => {
    expect(read("components/search-v2/BrowseBlocks.tsx")).toMatch(/Mic/)
    expect(read("app/search-v2.tsx")).toMatch(/onMic=/)
  })

  it("uses inline voice search on the search screen", () => {
    expect(read("app/search-v2.tsx")).toMatch(/useVoiceSearch/)
    expect(read("app/search-v2.tsx")).toMatch(/parsed\.listen/)
  })
})
