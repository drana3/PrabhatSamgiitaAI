import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { dictionaries } from "@/locales"
import review from "@/locales/review.json"

/**
 * The broadcast screens (docs/broadcasts.md): what the code must keep doing so that a link a stranger posted can do no
 * harm, and the layout of the form (docs/layout-rules.md).
 */
const ROOT = join(__dirname, "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

const FILES = ["app/upload-broadcast.tsx", "app/broadcast/[id].tsx", "app/broadcasts.tsx", "components/broadcasts/BroadcastCard.tsx", "components/broadcasts/BroadcastsShelf.tsx", "components/broadcasts/LiveMark.tsx", "hooks/useBroadcasts.ts"]

describe("a posted link is only ever opened by a person, outside the app", () => {
  const page = read("app/broadcast/[id].tsx")

  it("opens a link outside the app in one place only, after the stored address is parsed again", () => {
    for (const file of [...FILES, "lib/broadcasts/backend.ts", "lib/broadcasts/remote.ts", "lib/broadcasts/mock.ts", "lib/broadcasts/rules.ts"]) {
      const source = read(file)
      const opens = (source.match(/Linking\.openURL/g) ?? []).length
      expect(opens, file).toBe(file === "app/broadcast/[id].tsx" ? 1 : 0)
    }
    const openAt = page.indexOf("Linking.openURL")
    expect(page.lastIndexOf("addressToOpen(url)", openAt)).toBeGreaterThan(-1)
    expect(page).toContain("Linking.openURL(address)")
  })

  it("never loads a posted link in a web view or a frame: only the YouTube embed, through the existing video layer", () => {
    for (const file of FILES) {
      expect(read(file), file).not.toMatch(/react-native-webview|WebView\b|<iframe|createElement\("iframe"/)
    }
    expect(page).toContain('from "@/components/recording-extras/VideoEmbed"')
    expect(page).toContain("playsInApp(item.provider)")
    expect(page).toContain('videoEmbed({ provider: "youtube"')
  })

  it("never fetches the link itself", () => {
    for (const file of [...FILES, "lib/broadcasts/rules.ts", "lib/broadcasts/mock.ts"]) {
      expect(read(file), file).not.toMatch(/\bfetch\(|XMLHttpRequest/)
    }
  })

  it("matches no link with a regular expression: the rules parse it with new URL()", () => {
    const rules = read("lib/broadcasts/rules.ts")
    const link = rules.slice(rules.indexOf("export function parseBroadcastLink"), rules.indexOf("export function addressToOpen"))
    expect(link).toContain("new URL(")
    expect(link).not.toMatch(/\.(?:test|exec|match)\(|\.replace\(\//)
  })

  it("loads a thumbnail only from YouTube's own image host", () => {
    expect(read("components/broadcasts/BroadcastCard.tsx")).toContain("safeThumbnail(item.thumbnailUrl)")
  })
})

describe("the Live and upcoming shelf", () => {
  const kiirtan = read("app/kiirtan.tsx")
  it("is drawn on the Kiirtan screen only when there is at least one broadcast, so an empty shelf takes no room", () => {
    expect(kiirtan).toMatch(/\{liveBroadcasts\.length \? \(\s*<Reveal index=\{next\(\)\} style=\{styles\.section\}>\s*<BroadcastsShelf p=\{p\} items=\{liveBroadcasts\} \/>/)
    expect(kiirtan).toContain("shelfOrder(broadcasts.items)")
  })
  it("leads to the list and a card leads to the broadcast's page", () => {
    const shelf = read("components/broadcasts/BroadcastsShelf.tsx")
    expect(shelf).toContain('href("/broadcasts")')
    expect(shelf).toContain("href(`/broadcast/${b.id}`)")
  })
})

describe("the form and the pages", () => {
  const form = read("app/upload-broadcast.tsx")
  it("keeps the blocks of the form 24 apart and the note and the button 16 apart", () => {
    expect(form).toMatch(/\bcontent:\s*\{[^}]*\bgap:\s*24\b/)
    expect(form).toMatch(/\bfields:\s*\{\s*gap:\s*24\s*\}/)
    expect(form).toMatch(/\bsend:\s*\{\s*gap:\s*16\s*\}/)
    expect(form).toMatch(/\bfield:\s*\{\s*gap:\s*8\s*\}/)
    expect(form).toMatch(/<Reveal index=\{1\} style=\{s\.fields\}>/)
  })
  it("checks everything on the phone before it sends, with the same rules as the server", () => {
    for (const call of ["parseBroadcastLink(link)", "cleanBroadcastTitle(title)", "resolveStart({ date, time })", "cleanBroadcastText(about, DESCRIPTION_MAX)", "cleanBroadcastText(organizer, ORGANIZER_MAX)"]) expect(form).toContain(call)
  })
  it("uses the phone's own zone for the start", () => {
    expect(form).toContain("deviceZone()")
  })
  for (const file of ["app/broadcast/[id].tsx", "app/broadcasts.tsx"]) {
    it(`${file}: its content blocks are 24 apart`, () => {
      expect(read(file)).toMatch(/\bcontent:\s*\{[^}]*\bgap:\s*24\b/)
    })
  }
  it("tells the person the phase with a word, not colour alone", () => {
    const mark = read("components/broadcasts/LiveMark.tsx")
    expect(mark).toContain('t("bc.p.live")')
    expect(mark).toContain('accessibilityLabel={label}')
  })
})

describe("the words", () => {
  const used = new Set<string>()
  for (const file of FILES) for (const m of read(file).matchAll(/\bt\("(bc\.[A-Za-z0-9_.]+)"/g)) used.add(m[1] as string)
  for (const m of read("lib/broadcasts/when.ts").matchAll(/\bt\("(bc\.[A-Za-z0-9_.]+)"/g)) used.add(m[1] as string)

  it("every sentence the screens use is in English, Russian and Spanish", () => {
    expect(used.size).toBeGreaterThan(40)
    for (const language of ["en", "ru", "es"] as const) for (const key of used) expect((dictionaries[language] as Record<string, string>)[key], `${language}:${key}`).toBeTruthy()
  })

  it("has a sentence for every failure and every report reason", () => {
    const failures = ["signin", "empty", "badLink", "notHttps", "notPublic", "channel", "bareSite", "tooLong", "titleShort", "titleLong", "titleLatin", "titleLink", "textLink", "startBad", "startPast", "startFar", "dailyLimit", "liveLimit", "duplicate", "slowDown", "refused", "network", "gone", "server"]
    const reasons = ["broken", "not_a_broadcast", "offensive", "spam", "other"]
    const providers = ["youtube", "zoom", "facebook", "instagram", "other"]
    for (const language of ["en", "ru", "es"] as const) {
      const words = dictionaries[language] as Record<string, string>
      for (const f of failures) expect(words[`bc.err.${f}`], `${language}:${f}`).toBeTruthy()
      for (const r of reasons) expect(words[`bc.r.${r}`], `${language}:${r}`).toBeTruthy()
      for (const p of providers) expect(words[`bc.p.provider.${p}`], `${language}:${p}`).toBeTruthy()
    }
  })

  it("marks every new Russian and Spanish sentence as not yet read by a native speaker", () => {
    const data = review as unknown as Record<string, Record<string, boolean>>
    const keys = Object.keys(dictionaries.en).filter((k) => k.startsWith("bc."))
    expect(keys.length).toBeGreaterThan(100)
    for (const language of ["ru", "es"]) for (const key of keys) expect(data[language]?.[key], `${language}:${key}`).toBe(false)
  })
})
