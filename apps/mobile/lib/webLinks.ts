import Constants from "expo-constants"

const productionWeb =
  "https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io"

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

export function songShareMessage(songNumber: number, title: string): string {
  return `Prabhat Samgiita PS ${songNumber} — ${title}\n${songShareUrl(songNumber)}`
}
