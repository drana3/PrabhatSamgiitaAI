import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { keyboardBehavior } from "@/lib/keyboardBehavior"

describe("keyboardBehavior", () => {
  it("pads on iOS and on Android (edge to edge never shrinks the window), nothing on web", () => {
    expect(keyboardBehavior("ios")).toBe("padding")
    expect(keyboardBehavior("android")).toBe("padding")
    expect(keyboardBehavior("web")).toBeUndefined()
  })
})

describe("forms keep their field above the Android keyboard", () => {
  const root = path.resolve(__dirname, "..")
  for (const file of [
    "app/signin/index.tsx",
    "app/edit-profile.tsx",
    "app/complete-profile.tsx",
    "app/feedback/index.tsx",
    "app/assistant.tsx",
  ]) {
    it(`${file} uses the shared behavior, never "undefined" on Android`, () => {
      const source = readFileSync(path.join(root, file), "utf8")
      expect(source).toContain("behavior={keyboardBehavior(Platform.OS)}")
      expect(source).not.toMatch(/"padding" : undefined/)
    })
  }

  for (const file of [
    "components/common/PhoneInput.tsx",
    "components/account/PhoneField.tsx",
  ]) {
    it(`${file} sets the translucent flags on its Modals`, () => {
      const source = readFileSync(path.join(root, file), "utf8")
      const modals = source.match(/<Modal[\s\S]*?>/g) ?? []
      expect(modals.length).toBeGreaterThan(0)
      for (const modal of modals) {
        expect(modal).toContain("statusBarTranslucent")
        expect(modal).toContain("navigationBarTranslucent")
      }
    })
  }
})
