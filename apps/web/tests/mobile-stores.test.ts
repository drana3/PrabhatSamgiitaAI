import { afterEach, describe, expect, it } from "vitest"

import {
  APP_STORE_BADGE,
  GOOGLE_PLAY_BADGE,
  androidPlayStoreUrl,
  iosAppStoreUrl,
  mobileStoreLinks,
  mobileStoreQrUrl,
} from "@/lib/mobile-stores"

describe("mobile store links", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_IOS_APP_STORE_URL
    delete process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL
  })

  it("returns App Store and Google Play links with QR helpers", () => {
    const links = mobileStoreLinks()
    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({
      platform: "ios",
      shortLabel: "App Store",
      href: iosAppStoreUrl(),
      badgeSrc: APP_STORE_BADGE.src,
    })
    expect(links[1]).toMatchObject({
      platform: "android",
      shortLabel: "Google Play",
      href: androidPlayStoreUrl(),
      badgeSrc: GOOGLE_PLAY_BADGE.src,
    })
    expect(iosAppStoreUrl()).toContain("apps.apple.com")
    expect(androidPlayStoreUrl()).toContain("play.google.com/store/apps/details?id=net.prabhatasamgiita.ai")
  })

  it("honours env overrides for store URLs", () => {
    process.env.NEXT_PUBLIC_IOS_APP_STORE_URL = "https://apps.apple.com/custom"
    process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=custom"

    expect(iosAppStoreUrl()).toBe("https://apps.apple.com/custom")
    expect(androidPlayStoreUrl()).toBe("https://play.google.com/store/apps/details?id=custom")
    expect(mobileStoreQrUrl("ios")).toContain(encodeURIComponent("https://apps.apple.com/custom"))
  })
})
