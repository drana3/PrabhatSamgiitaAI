import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { KIIRTAN_TABS } from "@/lib/recordingExtras/kiirtanTabs"

const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8")

describe("the tabs of a Kiirtan page look like the Prabhat Samgiita song page menu (Dada, 9 Nov 2026)", () => {
  const tabs = read("components/recording-extras/KiirtanTabs.tsx")
  it("are the song page's own SectionTabs, not a look of their own", () => {
    expect(tabs).toContain('import { SectionTabs } from "@/components/song-page/ui"')
    expect(tabs).toContain("<SectionTabs")
    // no styles, no fonts, no colours of their own: type, spacing, the underline and the touch-down answer come from SectionTabs
    expect(tabs).not.toMatch(/StyleSheet|amFonts|borderRadius|fontSize|SpPress/)
  })
  it("keep the four tabs in Dada's order", () => {
    expect(KIIRTAN_TABS).toEqual(["chords", "video", "notes", "story"])
    expect(tabs).toContain("KIIRTAN_TABS.map")
  })
  it("sit on the page without a side padding of their own (the song page strip is full width too)", () => {
    expect(read("app/recording/[id].tsx")).toMatch(/tabs: \{ paddingTop: 24 \}/)
  })
})
