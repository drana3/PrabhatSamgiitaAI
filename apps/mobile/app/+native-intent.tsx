import { rewriteNativeSystemPath } from "@/lib/nativeIntent"

/** Intercept OS deep links (scheme launches, MSAL return) before Expo Router. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return rewriteNativeSystemPath(path)
  } catch {
    return "/"
  }
}
