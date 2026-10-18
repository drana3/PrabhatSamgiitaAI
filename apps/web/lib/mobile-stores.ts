import { qrCodeUrl } from "@/lib/quiz-events"

export type MobileStorePlatform = "ios" | "android"

export type MobileStoreLink = {
  platform: MobileStorePlatform
  label: string
  shortLabel: string
  href: string
  qrLabel: string
  badgeSrc: string
  badgeWidth: number
  badgeHeight: number
}

export const APP_STORE_BADGE = {
  src: "/brand/store-badges/app-store-badge.svg",
  width: 120,
  height: 40,
} as const

export const GOOGLE_PLAY_BADGE = {
  src: "/brand/store-badges/google-play-badge.png",
  width: 120,
  height: 40,
} as const

const ANDROID_PACKAGE = "net.prabhatasamgiita.ai"
const DEFAULT_IOS_APP_STORE_URL = "https://apps.apple.com/app/prabhat-samgiita-ai/id6802943117"
const DEFAULT_ANDROID_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

function trimUrl(value: string | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed || fallback
}

export function iosAppStoreUrl() {
  return trimUrl(process.env.NEXT_PUBLIC_IOS_APP_STORE_URL, DEFAULT_IOS_APP_STORE_URL)
}

export function androidPlayStoreUrl() {
  return trimUrl(process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL, DEFAULT_ANDROID_PLAY_STORE_URL)
}

export function mobileStoreLinks(): MobileStoreLink[] {
  return [
    {
      platform: "ios",
      label: "Download on the App Store",
      shortLabel: "App Store",
      href: iosAppStoreUrl(),
      qrLabel: "Scan for iPhone & iPad",
      badgeSrc: APP_STORE_BADGE.src,
      badgeWidth: APP_STORE_BADGE.width,
      badgeHeight: APP_STORE_BADGE.height,
    },
    {
      platform: "android",
      label: "Get it on Google Play",
      shortLabel: "Google Play",
      href: androidPlayStoreUrl(),
      qrLabel: "Scan for Android",
      badgeSrc: GOOGLE_PLAY_BADGE.src,
      badgeWidth: GOOGLE_PLAY_BADGE.width,
      badgeHeight: GOOGLE_PLAY_BADGE.height,
    },
  ]
}

export function mobileStoreQrUrl(platform: MobileStorePlatform, size = 168) {
  const href = platform === "ios" ? iosAppStoreUrl() : androidPlayStoreUrl()
  return qrCodeUrl(href, size)
}
