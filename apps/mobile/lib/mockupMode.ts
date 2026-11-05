/**
 * Preview-only switch. When EXPO_PUBLIC_MOCKUP_DATA=1 (set by `npm run web`), screens show the
 * Claude design prototype's sample data (songs, words, durations, stats, playing state) instead
 * of live API data, so the app can be compared 1:1 with the mockup.
 *
 * The flag is read from the build environment, so a release build made with it set by mistake would
 * ship fake data. Outside the web preview it therefore only counts in a development build.
 */
export function mockupEnabled(flag: string | undefined, platform: string | undefined, dev: boolean): boolean {
  return flag === "1" && (platform === "web" || dev)
}

function currentPlatform(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("react-native") as { Platform?: { OS?: string } }).Platform?.OS
  } catch {
    return undefined
  }
}

const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : false

export const MOCKUP_DATA: boolean = mockupEnabled(process.env.EXPO_PUBLIC_MOCKUP_DATA, currentPlatform(), isDev)
