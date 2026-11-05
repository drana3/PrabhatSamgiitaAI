import { existsSync, readFileSync } from "node:fs"
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

  it("declares iOS required-reason APIs in the privacy manifest with valid reason codes", () => {
    const manifest = (expo.ios as { privacyManifests?: { NSPrivacyAccessedAPITypes: Array<Record<string, unknown>> } })
      .privacyManifests
    const byType = new Map(
      manifest!.NSPrivacyAccessedAPITypes.map((e) => [e.NSPrivacyAccessedAPIType, e.NSPrivacyAccessedAPITypeReasons]),
    )
    expect(byType.get("NSPrivacyAccessedAPICategoryFileTimestamp")).toEqual(["C617.1"])
    expect(byType.get("NSPrivacyAccessedAPICategoryUserDefaults")).toEqual(["CA92.1"])
    expect(byType.get("NSPrivacyAccessedAPICategorySystemBootTime")).toEqual(["35F9.1"])
    expect(byType.get("NSPrivacyAccessedAPICategoryDiskSpace")).toEqual(["E174.1"])
  })

  it("is a phone app on iOS (iPad runs it in phone mode until the layout is made for wide screens)", () => {
    expect(expo.ios.supportsTablet).toBe(false)
  })

  it("keeps Android in left-to-right layout (the interface is not translated for RTL languages)", () => {
    const entry = plugin("expo-localization") as [string, { supportsRTL?: boolean }]
    expect(entry[1].supportsRTL).toBe(false)
  })

  it("blocks legacy storage permissions and gives the microphone one honest explanation", () => {
    const android = (expo as unknown as { android: { blockedPermissions?: string[] } }).android
    expect(android.blockedPermissions).toEqual(
      expect.arrayContaining(["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"]),
    )
    const av = plugin("expo-av") as [string, { microphonePermission?: string }]
    const speech = plugin("expo-speech-recognition") as [string, { microphonePermission?: string }]
    // expo-av would otherwise write its generic "access your microphone" string over the voice-search one
    expect(av[1].microphonePermission).toBe(speech[1].microphonePermission)
    expect(speech[1].microphonePermission).toMatch(/voice search/)
  })

  it("has no dead native build pieces left behind", () => {
    const root = path.resolve(__dirname, "..")
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"))
    expect(pkg.dependencies).not.toHaveProperty("@gorhom/bottom-sheet")
    expect(existsSync(path.join(root, "plugins/withTrackPlayerAndroid.js"))).toBe(false)
  })

  it("ships a themed (monochrome) Android icon inside the adaptive safe zone", () => {
    const android = (expo as unknown as { android: { adaptiveIcon: { monochromeImage?: string } } }).android
    const file = android.adaptiveIcon.monochromeImage
    expect(file).toBe("./assets/adaptive-icon-monochrome.png")
    const png = readFileSync(path.resolve(__dirname, "..", file!))
    expect(png.readUInt32BE(16)).toBe(1024)
    expect(png.readUInt32BE(20)).toBe(1024)
    expect(png[25]).toBe(6) // RGBA: the background is transparent, Android tints the shape
  })
})
