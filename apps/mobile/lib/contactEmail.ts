import Constants from "expo-constants"

/** Where rights holders write about a recording (docs/takedown-process.md). The same address the API puts in its letters. */
export const DEFAULT_COPYRIGHT_EMAIL = "info@anandamarga.org"

export function copyrightEmail(): string {
  const fromEnv = process.env.EXPO_PUBLIC_COPYRIGHT_EMAIL?.trim()
  const fromExtra = (Constants.expoConfig?.extra?.copyrightEmail as string | undefined)?.trim()
  const value = fromEnv || fromExtra || ""
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? value : DEFAULT_COPYRIGHT_EMAIL
}
