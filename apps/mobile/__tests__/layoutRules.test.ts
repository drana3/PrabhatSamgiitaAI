import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

import { amSpace } from "@/constants/tokens/amSpacing"
import { MIN_BLOCK_GAP, SECTION_GAP, SECTION_TOP, SPACE, isOnScale, nearestSpace } from "@/lib/layout"

const ROOT = join(__dirname, "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx$/.test(name)) out.push(rel)
  }
  return out
}

const SCREEN_FILES = [...walk("app"), ...walk("components")]

describe("lib/layout: the spacing scale", () => {
  it("is the design system's scale, 4 to 128", () => {
    expect([...SPACE]).toEqual(Object.values(amSpace))
    expect(SPACE).toEqual([4, 8, 12, 16, 24, 32, 48, 64, 96, 128])
  })

  it("section air and gaps are on the scale and not tighter than a block gap", () => {
    expect(isOnScale(SECTION_TOP)).toBe(true)
    expect(isOnScale(SECTION_GAP)).toBe(true)
    expect(isOnScale(MIN_BLOCK_GAP)).toBe(true)
    expect(SECTION_TOP).toBeGreaterThanOrEqual(SECTION_GAP)
    expect(SECTION_GAP).toBeGreaterThanOrEqual(MIN_BLOCK_GAP)
  })

  it("nearestSpace turns an off-scale number into a scale one", () => {
    expect(nearestSpace(30)).toBe(32)
    expect(nearestSpace(28)).toBe(32)
    expect(nearestSpace(10)).toBe(12)
    expect(nearestSpace(22)).toBe(24)
    expect(nearestSpace(5)).toBe(4)
    expect(nearestSpace(1000)).toBe(128)
    expect(isOnScale(30)).toBe(false)
    expect(isOnScale(24)).toBe(true)
  })
})

describe("Safe area: a modal screen uses the shared top", () => {
  const layout = read("app/_layout.tsx")
  const TOP_MECHANISM = /SheetTopBar|useSheetTop|useScreenTop|ModalHeader|topInset\(|screenTopInset\(/

  const modalRoutes = [...layout.matchAll(/name="([^"]+)"\s+options=\{\{\s*presentation:\s*"(modal|formSheet|fullScreenModal)"/g)].map((m) => m[1])

  it("finds the modal routes of the app", () => {
    expect(modalRoutes.length).toBeGreaterThanOrEqual(6)
    expect(modalRoutes).toContain("add-kirtan")
    expect(modalRoutes).toContain("upload")
  })

  for (const route of modalRoutes) {
    it(`${route} starts below the island through the shared top`, () => {
      const candidates = [`app/${route}.tsx`, `app/${route}/index.tsx`]
      const file = candidates.find((c) => {
        try {
          read(c)
          return true
        } catch {
          return false
        }
      })
      expect(file, `no file for ${route}`).toBeDefined()
      expect(read(file as string), `${file} does not use the shared top (SheetTopBar / useSheetTop / useScreenTop)`).toMatch(TOP_MECHANISM)
    })
  }

  // A native <Modal> that is not transparent is a pageSheet of its own: nothing draws a safe area in it. Only SheetModal may open one.
  const OPAQUE_MODAL_ALLOWED = ["components/common/SheetModal.tsx", "components/admin/AdminSargamFullscreenStudio.tsx"]

  it("no screen opens an opaque <Modal> by hand: use SheetModal", () => {
    const offenders: string[] = []
    for (const file of SCREEN_FILES) {
      const source = read(file)
      for (const match of source.matchAll(/<Modal\b([^>]*)>/g)) {
        const props = match[1]
        const opaque = !/\btransparent\b/.test(props)
        if (opaque && !OPAQUE_MODAL_ALLOWED.includes(file)) offenders.push(file)
      }
      // multi-line <Modal ...> tags
      for (const match of source.matchAll(/<Modal\s*\n([\s\S]*?)\n\s*>/g)) {
        if (!/\btransparent\b/.test(match[1]) && !OPAQUE_MODAL_ALLOWED.includes(file)) offenders.push(file)
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })

  it("presentationStyle is set in SheetModal only", () => {
    const offenders = SCREEN_FILES.filter((f) => /presentationStyle=/.test(read(f)) && f !== "components/common/SheetModal.tsx")
    expect(offenders).toEqual([])
  })

  it("the pickers that used to sit under the island now use SheetModal", () => {
    for (const file of ["components/kirtan/add/PsSongChooser.tsx", "components/kirtan/add/KindFields.tsx", "components/kirtan/sets/ChoiceSheet.tsx"]) {
      expect(read(file), file).toContain("<SheetModal")
    }
  })

  it("SheetModal measures the inset inside the sheet and its header uses the shared top", () => {
    const source = read("components/common/SheetModal.tsx")
    expect(source).toContain("SafeAreaProvider")
    expect(source).toContain("useSheetTop")
    expect(source).toContain('presentationStyle="pageSheet"')
  })

  // The old way: `Platform.OS === "web" ? 54 : insets.top` (a magic 54 per screen). The team's own screens that still have it are
  // not ours to change (docs/layout-rules.md), so they are listed here; any NEW use fails.
  const MAGIC_TOP_ALLOWED = ["app/feedback/index.tsx", "app/stories/index.tsx", "app/stories/[slug].tsx"]

  it("no new screen hard-codes a top inset for the web", () => {
    const offenders = SCREEN_FILES.filter((f) => /Platform\.OS\s*===\s*"web"\s*\?\s*\d+\s*:\s*insets\.top/.test(read(f)) && !MAGIC_TOP_ALLOWED.includes(f))
    expect(offenders).toEqual([])
  })
})

describe("Space between blocks: the converted screens", () => {
  // Screens built from <Section> and <BlockStack>. Their vertical spacing numbers stay on the scale.
  const SPACING_FILES = [
    "components/authors/AuthorShowcase.tsx",
    "app/author/[slug].tsx",
    "app/my-author.tsx",
    "app/kirtan-artist.tsx",
    "components/authors/ClaimsCard.tsx",
    "app/recording/[id].tsx",
  ]

  const VERTICAL = /\b(gap|rowGap|paddingTop|paddingBottom|paddingVertical|marginTop|marginBottom|marginVertical)\s*:\s*(\d+)\b/g
  // Text lines and icon-to-text nudges may be tighter than a block gap: 0, 1, 2, 3, 6 are allowed for these small things only.
  const TEXT_NUDGE = new Set([0, 1, 2, 3, 6])

  for (const file of SPACING_FILES) {
    it(`${file}: vertical spacing is on the 4/8/12/16/24/32/48/64/96/128 scale`, () => {
      const source = read(file)
      const off: string[] = []
      for (const match of source.matchAll(VERTICAL)) {
        const value = Number(match[2])
        if (!isOnScale(value) && !TEXT_NUDGE.has(value)) off.push(`${match[1]}: ${value}`)
      }
      expect(off).toEqual([])
    })

    it(`${file}: uses Section and no hand-made section heading`, () => {
      const source = read(file)
      expect(source).toContain("Section")
      expect(source).not.toContain("SectionTitle")
    })

    it(`${file}: every <BlockStack gap> and <Section top> is on the scale and not under ${MIN_BLOCK_GAP}`, () => {
      const source = read(file)
      for (const match of source.matchAll(/<BlockStack\b[^>]*\bgap=\{(\d+)\}/g)) {
        const value = Number(match[1])
        expect(isOnScale(value), `BlockStack gap ${value}`).toBe(true)
        expect(value, `BlockStack gap ${value}`).toBeGreaterThanOrEqual(MIN_BLOCK_GAP)
      }
      for (const match of source.matchAll(/<Section\b[^>]*\b(?:top|gap)=\{(\d+)\}/g)) {
        const value = Number(match[1])
        expect(isOnScale(value), `Section top/gap ${value}`).toBe(true)
        expect(value).toBeGreaterThanOrEqual(MIN_BLOCK_GAP)
      }
    })
  }

  it("Section always gives a heading its top gap (the hole that stuck 'All recordings' to the last song)", () => {
    const source = read("components/common/Layout.tsx")
    expect(source).toMatch(/paddingTop:\s*top/)
    expect(source).toContain("SECTION_TOP")
    expect(source).toContain("SECTION_GAP")
  })

  it("the artist page: Popular and All recordings are the same Section with the same top", () => {
    const source = read("app/kirtan-artist.tsx")
    const sections = [...source.matchAll(/<Section\b([^>]*)\/?>/g)].map((m) => m[1])
    expect(sections.length).toBeGreaterThanOrEqual(3)
    expect(sections.some((props) => /\btop=/.test(props))).toBe(false)
  })

  it("the page link stays hidden behind one flag", () => {
    const constants = read("lib/authors/constants.ts")
    expect(constants).toMatch(/export const SHOW_PAGE_LINK\s*=\s*false/)
    expect(read("app/my-author.tsx")).toContain("SHOW_PAGE_LINK")
    expect(read("components/authors/AuthorFormParts.tsx")).toContain("SHOW_PAGE_LINK")
    expect(read("app/become-author.tsx")).toContain("SHOW_PAGE_LINK")
  })

  it("the layout rules are written down", () => {
    const doc = readFileSync(join(ROOT, "../../docs/layout-rules.md"), "utf8")
    expect(doc).toContain("Safe area")
    expect(doc).toContain("Space between blocks")
    expect(relative(ROOT, join(ROOT, "lib/layout.ts"))).toBe("lib/layout.ts")
  })
})

describe("Space between blocks: the upload forms", () => {
  // The form fields of the add-recording and playlist screens. Their vertical spacing is on the scale (the legacy numbers of the two
  // screens themselves are not checked line by line, but the blocks of the playlist's details step are).
  const FORM_FILES = [
    "components/kirtan/sets/EventDateField.tsx",
    "components/kirtan/add/InstrumentField.tsx",
    "components/kirtan/add/SoundFields.tsx",
    "components/kirtan/add/AuthorTick.tsx",
    "components/kirtan/add/KindFields.tsx",
    "components/kirtan/add/QueueRows.tsx",
    "components/kirtan/add/OwnWord.tsx",
    "app/my-sets.tsx",
    "app/upload-chords.tsx",
    "app/upload-broadcast.tsx",
    "app/broadcast/[id].tsx",
    "app/broadcasts.tsx",
    "components/broadcasts/BroadcastCard.tsx",
    "components/broadcasts/BroadcastsShelf.tsx",
    "components/broadcasts/LiveMark.tsx",
  ]
  const VERTICAL = /\b(gap|rowGap|paddingTop|paddingBottom|paddingVertical|marginTop|marginBottom|marginVertical)\s*:\s*(\d+)\b/g
  const TEXT_NUDGE = new Set([0, 1, 2, 3, 6])

  for (const file of FORM_FILES) {
    it(`${file}: vertical spacing is on the 4/8/12/16/24/32/48/64/96/128 scale`, () => {
      const off: string[] = []
      for (const match of read(file).matchAll(VERTICAL)) {
        const value = Number(match[2])
        if (!isOnScale(value) && !TEXT_NUDGE.has(value)) off.push(`${match[1]}: ${value}`)
      }
      expect(off).toEqual([])
    })
  }

  it("the playlist's details step keeps its blocks 24 apart (title, place and date had stuck to each other at 16)", () => {
    const source = read("app/upload-set.tsx")
    const gap = /\bdetails:\s*\{\s*gap:\s*(\d+)\s*\}/.exec(source)
    expect(gap, "styles.details is missing").not.toBeNull()
    expect(Number(gap![1])).toBeGreaterThanOrEqual(24)
    // the step is drawn with that style, not with the 16 of the other steps
    expect(source).toMatch(/<Reveal index=\{1\} style=\{styles\.details\}>\s*\{textField\("title"/)
  })

  it("a label and its field are 8 apart in the playlist's fields (not 10)", () => {
    expect(read("app/upload-set.tsx")).toMatch(/\bfield:\s*\{\s*gap:\s*8\s*\}/)
    expect(read("components/kirtan/sets/EventDateField.tsx")).toMatch(/\bfield:\s*\{\s*gap:\s*8\s*\}/)
  })
})

describe("Nothing overlaps and nothing sticks: neighbours are not closer than 16", () => {
  const GAP = (source: string, name: string) => {
    const match = new RegExp(`\\b${name}\\s*=\\s*(\\d+)`).exec(source)
    return match ? Number(match[1]) : null
  }

  it("an input beside a group of tags (style, instrument, language) is 16 below the tags and 16 above its suggestion card", () => {
    const own = read("components/kirtan/add/OwnWord.tsx")
    expect(GAP(own, "export const TAG_INPUT_GAP")).toBeGreaterThanOrEqual(16)
    // OwnWord's own stack: input, then the "Did you mean" card, 16 apart; the note belongs to the input (8)
    expect(own).toMatch(/\broot:\s*\{\s*gap:\s*16\s*\}/)
    expect(own).toMatch(/\binputGroup:\s*\{\s*gap:\s*8\s*\}/)
  })

  // Style, Mood and the main instrument are the compact picker (TagPicker): no bare TextInput of their own, and no input beside a wall of chips
  const TAG_FIELDS = ["components/kirtan/add/StyleField.tsx", "components/kirtan/add/MoodField.tsx", "components/kirtan/add/InstrumentField.tsx"]
  for (const file of TAG_FIELDS) {
    it(`${file}: draws the compact TagPicker, not chips with a bare TextInput under them`, () => {
      const source = read(file)
      expect(source).toContain("<TagPicker")
      expect(source).not.toContain("<TextInput")
      expect(source).not.toContain("<Press")
    })
  }

  it("the compact picker keeps its own word in the sheet's search row (never beside the chips), rows 8 apart, and a one-line field", () => {
    const source = read("components/kirtan/add/TagPicker.tsx")
    // the field on the form is ONE line: the chips and the plus sit in one box (rail), they do not wrap
    expect(source).toMatch(/\brail:\s*\{[^}]*flexDirection:\s*"row"/)
    expect(source).toMatch(/\brailChips:\s*\{[^}]*flexWrap|\brailChips:\s*\{[^}]*overflow:\s*"hidden"/)
    expect(source).not.toMatch(/\brailChips:\s*\{[^}]*flexWrap:\s*"wrap"/)
    // inside the sheet: search, then the list, then the footer, 12 apart; the rows are 8 apart and at least 48 high
    expect(source).toMatch(/\bsheetBody:\s*\{[^}]*\bgap:\s*12/)
    expect(source).toMatch(/\blistContent:\s*\{[^}]*\bgap:\s*8/)
    expect(Number(/\brow:\s*\{[^}]*minHeight:\s*(\d+)/.exec(source)![1])).toBeGreaterThanOrEqual(48)
    // the only TextInput is the search/own-word box; the typed word is added through a row, so no input sits next to chips
    expect((source.match(/<TextInput/g) ?? []).length).toBe(1)
    expect(source).not.toContain("<OwnWord")
  })

  it("the language picker writes its own word with OwnWord and keeps its stack TAG_INPUT_GAP apart", () => {
    const source = read("components/kirtan/add/KindFields.tsx")
    expect(source).toContain("<OwnWord")
    expect(source).toMatch(/\bnameBody:\s*\{[^}]*gap:\s*TAG_INPUT_GAP/)
  })

  it("a picker sheet's header: 16 between the title and the close button, 16 between the header and the search", () => {
    const top = read("lib/screenTop.ts")
    expect(GAP(top, "export const MODAL_HEADER_GAP_BELOW")).toBeGreaterThanOrEqual(16)
    const sheet = read("components/common/SheetModal.tsx")
    expect(sheet).toMatch(/paddingBottom:\s*MODAL_HEADER_GAP_BELOW/)
    expect(sheet).toMatch(/\bheader:\s*\{[^}]*\bgap:\s*(\d+)/)
    const gap = Number(/\bheader:\s*\{[^}]*\bgap:\s*(\d+)/.exec(sheet)![1])
    expect(gap).toBeGreaterThanOrEqual(16)
    // the title shrinks (flex 1, minWidth 0) instead of running under the close button
    expect(sheet).toMatch(/\bheading:\s*\{[^}]*flex:\s*1[^}]*minWidth:\s*0/)
  })

  it("the add form keeps the playlist link 16 under the playlist card, and its blocks 24 apart", () => {
    const source = read("app/add-kirtan.tsx")
    expect(source).toMatch(/\bsetStack:\s*\{\s*gap:\s*16\s*\}/)
    expect(source).toMatch(/<Reveal index=\{1\} style=\{styles\.setStack\}>/)
    expect(source).toMatch(/\bcontent:\s*\{[^}]*\bgap:\s*24\b/)
    expect(read("app/upload-set.tsx")).toMatch(/\bcontent:\s*\{[^}]*\bgap:\s*24\b/)
  })

  it("the chord offer's last step keeps 24 between the ticks, the notice and the button, and 16 between the notice and the button", () => {
    const source = read("app/upload-chords.tsx")
    expect(source).toMatch(/\bsend:\s*\{\s*gap:\s*24\s*\}/)
    expect(source).toMatch(/\bsendRow:\s*\{\s*gap:\s*16\s*\}/)
    expect(source).toMatch(/<View style=\{s\.sendRow\}>\s*<ModerationNotice kind="chords" \/>\s*<ActionButton/)
  })

  it("a row of a picker (a field and its button) wraps instead of squeezing the text to dots", () => {
    expect(read("components/kirtan/add/KindFields.tsx")).toMatch(/\bbox:\s*\{[^}]*flexWrap:\s*"wrap"/)
  })

  it("the rule is written down in docs/layout-rules.md", () => {
    const doc = readFileSync(join(ROOT, "../../docs/layout-rules.md"), "utf8")
    expect(doc).toContain("An input beside a group of tags")
    expect(doc).toContain("Nothing overlaps and nothing sticks")
  })
})
