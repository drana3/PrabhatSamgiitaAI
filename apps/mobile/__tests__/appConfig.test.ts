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

  it("gives Android a monochrome notification icon (96x96 RGBA png) and an accent colour", () => {
    const entry = plugin("expo-notifications") as [string, { icon?: string; color?: string }]
    expect(Array.isArray(entry)).toBe(true)
    const { icon, color } = entry[1]
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(icon).toBe("./assets/notification-icon.png")
    const png = readFileSync(path.resolve(__dirname, "..", icon!))
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG")
    expect(png.readUInt32BE(16)).toBe(96)
    expect(png.readUInt32BE(20)).toBe(96)
    expect(png[25]).toBe(6) // colour type 6 = RGBA, so the transparent background is real
  })

  it("does not declare false photo-library permission strings in app.config.js", () => {
    const source = readFileSync(path.resolve(__dirname, "../app.config.js"), "utf8")
    expect(source).not.toMatch(/does not access your photo library/)
    expect(source).not.toMatch(/NSPhotoLibraryAddUsageDescription:/)
    const picker = plugin("expo-image-picker") as [string, { photosPermission?: string }]
    expect(picker[1].photosPermission).toMatch(/profile picture/)
  })
})
