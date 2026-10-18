import Constants from "expo-constants"

const productionWeb = "https://www.prabhatasamgiita.org"
const IOS_APP_STORE_URL = "https://apps.apple.com/app/prabhat-samgiita-ai/id6802943117"
const ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=net.prabhatasamgiita.ai"

export function iosAppStoreUrl(): string {
  return IOS_APP_STORE_URL
}

export function androidPlayStoreUrl(): string {
  return ANDROID_PLAY_STORE_URL
}

/** Public website origin used for share links and deep references. */
export function webBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim()
  const fromExtra = (Constants.expoConfig?.extra?.webBaseUrl as string | undefined)?.trim()
  const base = (fromEnv || fromExtra || productionWeb).replace(/\/$/, "")
  return base
}

export function songShareUrl(songNumber: number): string {
  return `${webBaseUrl()}/songs/${songNumber}?open=app`
}

/** Public instructions for account/data deletion (Play / App Store data safety). */
export function deleteAccountHelpUrl(): string {
  return `${webBaseUrl()}/delete-account`
}

function foldShareText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
}

function isGenericPerformer(value: string): boolean {
  const folded = foldShareText(value)
  return !folded || folded === "prabhat samgiita collection" || folded === "prabhat samgiita"
}

function isSameShareLine(left: string, right: string): boolean {
  const a = foldShareText(left)
  const b = foldShareText(right)
  return Boolean(a) && a === b
}

export function songShareMessage(
  songNumber: number,
  title: string,
  extras?: { performer?: string | null; detail?: string | null },
): string {
  const cleanTitle = title.trim() || `Prabhat Samgiita ${songNumber}`
  const lines: string[] = [
    "Prabhat Samgiita AI",
    "────────────────",
    `PS ${songNumber} · ${cleanTitle}`,
  ]

  const detail = extras?.detail?.trim()
  if (detail && !isSameShareLine(detail, cleanTitle)) {
    lines.push(detail)
  }

  const performer = extras?.performer?.trim()
  if (
    performer &&
    !isGenericPerformer(performer) &&
    !isSameShareLine(performer, cleanTitle) &&
    !(detail && isSameShareLine(performer, detail))
  ) {
    lines.push(`Singer · ${performer}`)
  }

  lines.push("", "Listen & read lyrics", songShareUrl(songNumber))

  return lines.join("\n")
}
