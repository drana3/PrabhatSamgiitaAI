import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { PROFILE_INNER_ROUTES, PROFILE_SHEET, applyNav, openFromProfile } from "@/lib/profileNav"
import { PROFILE_ROUTES } from "@/lib/profileSheet"

const ROOT = join(__dirname, "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

/** The file of an expo-router route: app/<route>.tsx or app/<route>/index.tsx */
function routeSource(route: string): string {
  const bare = route.replace(/^\//, "")
  for (const candidate of [`app/${bare}.tsx`, `app/${bare}/index.tsx`]) {
    try {
      return read(candidate)
    } catch {
      // try the next form
    }
  }
  throw new Error(`no screen file for ${route}`)
}

// the stack under a person who opened the profile from Today
const FROM_TODAY = ["/v2/today", PROFILE_SHEET]

describe("Back from a setting of the profile lands on the profile", () => {
  it("lists every page the sheet opens", () => {
    for (const route of Object.values(PROFILE_ROUTES)) expect(PROFILE_INNER_ROUTES).toContain(route)
    expect(PROFILE_INNER_ROUTES).toContain("/notification-settings")
  })

  for (const route of PROFILE_INNER_ROUTES) {
    it(`${route}: opening it and pressing Back ends on the profile sheet`, () => {
      const opened = applyNav(FROM_TODAY, openFromProfile(route))
      expect(opened.at(-1)).toBe(route)
      const back = applyNav(opened, { type: "back" })
      expect(back).toEqual(FROM_TODAY)
      expect(back.at(-1)).toBe(PROFILE_SHEET)
    })
  }

  it("a sheet over a sheet (Language over Profile) and a page over that: Back goes one step at a time to the profile", () => {
    let stack = applyNav(FROM_TODAY, openFromProfile("/language"))
    stack = applyNav(stack, { type: "push", to: "/some-page" })
    stack = applyNav(stack, { type: "back" })
    expect(stack.at(-1)).toBe("/language")
    stack = applyNav(stack, { type: "back" })
    expect(stack.at(-1)).toBe(PROFILE_SHEET)
  })

  it("the old way (replace the sheet) is what lost the profile: the model shows it", () => {
    const replaced = applyNav(FROM_TODAY, { type: "replace", to: "/language" })
    expect(applyNav(replaced, { type: "back" })).toEqual(["/v2/today"])
  })

  it("the model itself: push and back behave like the navigator", () => {
    expect(applyNav(["/a"], { type: "push", to: "/b" })).toEqual(["/a", "/b"])
    expect(applyNav(["/a", "/b"], { type: "back" })).toEqual(["/a"])
    expect(applyNav(["/a"], { type: "back" })).toEqual(["/a"])
    expect(applyNav(["/a", "/b", "/c"], { type: "dismissTo", to: "/a" })).toEqual(["/a"])
  })

  it("every row pushes", () => {
    for (const route of PROFILE_INNER_ROUTES) expect(openFromProfile(route)).toEqual({ type: "push", to: route })
  })
})

describe("the profile sheet's code follows the rule", () => {
  const source = read("components/profile-v2/ProfileContent.tsx")

  it("opens its pages through openFromProfile and never replaces the sheet", () => {
    expect(source).toContain("openFromProfile(")
    expect(source).not.toContain("swapTo")
    // the only replaces left leave the app's signed-in area (sign out, delete the account)
    const replaces = [...source.matchAll(/router\.replace\(href\(([^)]*)\)\)/g)].map((m) => m[1])
    expect(replaces.every((target) => target === '"/welcome"')).toBe(true)
  })

  it("has a row for every page of PROFILE_ROUTES", () => {
    for (const key of Object.keys(PROFILE_ROUTES)) {
      expect(source, key).toContain(`PROFILE_ROUTES.${key}`)
    }
    expect(source).toContain('go("/notification-settings")')
  })
})

describe("the pages the sheet opens close with Back, not with a jump to another screen", () => {
  for (const route of PROFILE_INNER_ROUTES) {
    it(route, () => {
      const source = routeSource(route)
      // a screen either goes back itself, or its header (ScreenContainer) does
      expect(source.includes("router.back()") || source.includes("ScreenContainer"), `${route} has no way back`).toBe(true)
      // and it never opens the profile sheet again or dismisses to a tab on its way out
      expect(source).not.toMatch(/dismissTo|dismissAll/)
      expect(source).not.toContain(`href("${PROFILE_SHEET}")`)
    })
  }
})
