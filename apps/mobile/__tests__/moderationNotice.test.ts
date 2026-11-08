import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { MODERATION_KEYS } from "@/lib/moderationNotice"
import { dictionaries } from "@/locales"
import review from "@/locales/review.json"

/**
 * The moderation warning (docs/kiirtan-publishing.md "Warning in the forms"): ONE component and ONE set of strings, shown
 * at the very end of every form that sends something to the library, just above the send button. A new upload form must
 * be added to FINALS or this test cannot see it; a form that drops the notice fails here.
 */
const ROOT = join(__dirname, "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx$/.test(name)) out.push(rel)
  }
  return out
}

/** file, what it sends (recording or chords) and the send control that comes right after the notice */
const FINALS: { file: string; kind: "recording" | "chords"; send: RegExp }[] = [
  { file: "app/add-kirtan.tsx", kind: "recording", send: /<KPress\s+accessibilityRole="button"\s+accessibilityLabel=\{buttonLabel\}/ },
  { file: "app/upload-set.tsx", kind: "recording", send: /<Primary theme=\{theme\} label=\{label\} onPress=\{\(\) => void send\(\)\}/ },
  { file: "app/upload-chords.tsx", kind: "chords", send: /<ActionButton theme=\{theme\} label=\{sendLabel\}/ },
  { file: "app/recording-chart.tsx", kind: "chords", send: /<ActionButton theme=\{theme\} label=\{sendLabel\}/ },
  { file: "app/recording-cycle.tsx", kind: "chords", send: /<ActionButton theme=\{theme\} label=\{sendLabel\}/ },
  { file: "app/recording-chords.tsx", kind: "chords", send: /<ActionButton theme=\{theme\} label=\{busy \?/ },
]

describe("ModerationNotice: shown in every final upload form", () => {
  for (const { file, kind, send } of FINALS) {
    const source = read(file)
    it(`${file}: imports the shared component and shows it as ${kind}`, () => {
      expect(source).toContain('from "@/components/common/ModerationNotice"')
      expect(source).toContain(`<ModerationNotice kind="${kind}" />`)
    })

    it(`${file}: the notice is the last block before the send button`, () => {
      const at = source.indexOf(`<ModerationNotice kind="${kind}" />`)
      const button = source.search(send)
      expect(button, "send control not found").toBeGreaterThan(-1)
      expect(at).toBeLessThan(button)
      // nothing but the notice (the closing brace of its condition, a comment) between it and the button
      const between = source.slice(at + `<ModerationNotice kind="${kind}" />`.length, button).replace(/^\}/, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").trim()
      expect(between).toBe("")
    })

    it(`${file}: has no second copy of the wording`, () => {
      expect(source).not.toMatch(/reviewed by our moderators|very poor quality/i)
    })
  }

  it("no other screen sends a recording or a chord chart without the notice", () => {
    // a screen that starts an upload or sends a chart must be in FINALS; screens that only read the stores are exempt
    const SENDS = /useUploadQueueStore|useUploadSetStore|chordOffer\.sending|recChordsForm\.sending|recChart\.send\b/
    const READ_ONLY = new Set(["app/my-sets.tsx", "app/recording-set/[id].tsx"])
    const found = walk("app").filter((file) => SENDS.test(read(file)) && !READ_ONLY.has(file))
    expect(found.sort()).toEqual(FINALS.map((f) => f.file).sort())
  })
})

describe("ModerationNotice: one set of strings in three languages", () => {
  const keys = Object.values(MODERATION_KEYS)

  it("English, Russian and Spanish all have the title and both bodies", () => {
    for (const language of ["en", "ru", "es"] as const) {
      for (const key of keys) expect(dictionaries[language][key], `${language}:${key}`).toBeTruthy()
    }
  })

  it("the new Russian and Spanish strings are marked not yet read by a native speaker", () => {
    const data = review as Record<string, Record<string, boolean>>
    for (const language of ["ru", "es"]) for (const key of keys) expect(data[language]?.[key], `${language}:${key}`).toBe(false)
  })

  it("English says moderators review it and a poor one may be declined or removed, never that it waits for approval", () => {
    const en = dictionaries.en
    for (const key of [MODERATION_KEYS.recording, MODERATION_KEYS.chords]) {
      expect(en[key]).toMatch(/reviewed by our moderators/)
      expect(en[key]).toMatch(/declined or removed/)
      expect(en[key]).not.toMatch(/before (it is )?publish|waits for|until/i)
    }
    expect(en[MODERATION_KEYS.recording]).toMatch(/very poor quality \(heavy noise, cut-offs, a wrong or silent file\)/)
  })

  it("spelling: Kiirtan keeps its two i's wherever the notice names it", () => {
    for (const language of ["en", "ru", "es"] as const) for (const key of keys) expect(dictionaries[language][key]).not.toMatch(/\bKirtan\b/)
  })
})
