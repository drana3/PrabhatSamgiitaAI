import { Linking, Platform, Share } from "react-native"
import * as Clipboard from "expo-clipboard"

import { shareTargetUrl, type ShareOutcome, type SharePayload, type SharePlatform, type ShareTargetId } from "@/lib/playerV2/playerShare"

/** Copies text. On the web it falls back to the old copy command when the browser refuses the clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text)
    return true
  } catch {
    if (Platform.OS !== "web" || typeof document === "undefined") return false
    try {
      const area = document.createElement("textarea")
      area.value = text
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.opacity = "0"
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

function platform(): SharePlatform {
  return Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web"
}

/**
 * Sends a share. "Copy link" copies the link. WhatsApp, Telegram and Messages open their own link when the
 * platform has one; every other channel opens the system share sheet (navigator.share on the web),
 * and when that is not available the link is copied instead.
 */
export async function runShare(target: ShareTargetId, payload: SharePayload): Promise<ShareOutcome> {
  if (target === "copy") return (await copyText(payload.url)) ? "copied" : "copy-failed"

  const direct = shareTargetUrl(target, payload, platform())
  if (direct) {
    try {
      await Linking.openURL(direct)
      return "opened"
    } catch {
      // fall through to the system sheet
    }
  }
  try {
    const result = await Share.share({ message: payload.message, title: payload.title })
    return result.action === Share.dismissedAction ? "dismissed" : "shared"
  } catch {
    return (await copyText(payload.url)) ? "copied" : "copy-failed"
  }
}
