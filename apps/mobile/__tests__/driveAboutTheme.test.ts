import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

const themed = [
  "app/drive/index.tsx",
  "app/about/index.tsx",
  "components/drive/DriveNowPlaying.tsx",
  "components/drive/DrivePlaylistAccordion.tsx",
  "components/drive/DriveReorderableQueue.tsx",
]

describe("Radio and About follow the app theme", () => {
  it.each(themed)("%s uses useAmTheme, not the old light palette", (file) => {
    const source = read(file)
    expect(source).toContain("useAmTheme")
    expect(source).not.toContain("@/constants/colors")
  })

  it("the seek bar on the photo plate does not use the old palette either", () => {
    expect(read("components/drive/DriveSeekBar.tsx")).not.toContain("@/constants/colors")
  })

  it("Radio and About ask ScreenContainer for the themed look", () => {
    for (const file of ["app/drive/index.tsx", "app/about/index.tsx"]) {
      expect(read(file), file).toMatch(/<ScreenContainer\s+themed\b/)
    }
  })

  it("ScreenContainer stays on the old palette unless `themed` is set", () => {
    const source = read("components/common/ScreenContainer.tsx")
    expect(source).toMatch(/themed\s*=\s*false/)
  })

  it("the captions on the Radio photo plate sit on the photo scrim token", () => {
    expect(read("components/drive/DriveNowPlaying.tsx")).toContain("amScrimPhoto")
  })
})
