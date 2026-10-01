import Constants from "expo-constants"

const productionWeb = "https://www.prabhatasamgiita.org"

/** Public website origin used for share links and deep references. */
export function webBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim()
  const fromExtra = (Constants.expoConfig?.extra?.webBaseUrl as string | undefined)?.trim()
  const base = (fromEnv || fromExtra || productionWeb).replace(/\/$/, "")
  return base
}

export function songShareUrl(songNumber: number): string {
  return `${webBaseUrl()}/songs/${songNumber}`
}

export function songShareMessage(
  songNumber: number,
  title: string,
  extras?: { performer?: string | null; detail?: string | null },
): string {
  const lines = ["Prabhat Samgiita", `PS ${songNumber} — ${title}`]
  const performer = extras?.performer?.trim()
  if (performer && performer !== "Prabhat Samgiita Collection") {
    lines.push(`Singer: ${performer}`)
  }
  const detail = extras?.detail?.trim()
  if (detail && detail !== title) lines.push(detail)
  // Own line so WhatsApp, Messages, Mail, and Telegram can linkify it.
  lines.push(songShareUrl(songNumber))
  return lines.join("\n")
}
