import { Linking } from "react-native"

/**
 * Opens a link in the browser or the app that handles it. When nothing can open it (no browser, a
 * link the phone does not know) this returns false instead of throwing, so a button never ends in
 * an unhandled error. Callers that want to tell the person check the result.
 */
export async function openExternal(url: string | null | undefined): Promise<boolean> {
  const target = (url ?? "").trim()
  if (!target) return false
  try {
    await Linking.openURL(target)
    return true
  } catch {
    return false
  }
}
