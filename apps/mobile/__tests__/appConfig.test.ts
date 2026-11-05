import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const expo = JSON.parse(readFileSync(path.resolve(__dirname, "../app.json"), "utf8")).expo as {
  plugins: Array<string | [string, Record<string, unknown>]>
  ios: Record<string, unknown>
  userInterfaceStyle: string
}

function plugin(name: string) {
  return expo.plugins.find((entry) => (Array.isArray(entry) ? entry[0] === name : entry === name))
}

describe("app.json native config", () => {
  it("keeps the Sign in with Apple capability (plugin and entitlement flag)", () => {
    expect(plugin("expo-apple-authentication")).toBeTruthy()
    expect(expo.ios.usesAppleSignIn).toBe(true)
  })

  it("lets the system theme through (Auto must be able to go dark on iOS)", () => {
    expect(expo.userInterfaceStyle).toBe("automatic")
  })
})
