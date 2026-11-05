import { Platform, Share, type View } from "react-native"
import * as Sharing from "expo-sharing"

import { cardSize, type CardFormat } from "@/lib/share/card"
import { capturePng } from "@/lib/share/cardCapture"

/**
 * Turns the card view into a PNG and sends it. Native: view-shot writes a PNG file in the cache and
 * expo-sharing hands it to the system share sheet (Instagram, Messages, WhatsApp, Save Image...). Web:
 * html2canvas (inside view-shot) draws a data URI; the browser downloads it or shares it as a file.
 * Needs a real device to check: the web preview cannot show the native capture or the system sheet.
 */
export type CardImage = { uri: string; width: number; height: number }

/** Captures the (full-size, 1080 px wide) card view. Throws when the capture fails. */
export async function captureCard(view: View, format: CardFormat): Promise<CardImage> {
  const { width, height } = cardSize(format)
  const uri = await capturePng(view, { width, height })
  return { uri, width, height }
}

/** True when this browser can share a picture file (navigator.share with files); always false on native, which has its own sheet. */
export function canShareFileOnWeb(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function" || typeof File === "undefined") return false
  try {
    return nav.canShare({ files: [new File([""], "a.png", { type: "image/png" })] })
  } catch {
    return false
  }
}

async function fileFromDataUri(uri: string, name: string): Promise<File> {
  const blob = await (await fetch(uri)).blob()
  return new File([blob], name, { type: "image/png" })
}

export type CardShareOutcome = "shared" | "dismissed" | "unsupported"

/** Sends the PNG through the system share sheet. `message` rides along where the target accepts text. */
export async function shareCardImage(image: CardImage, fileName: string, message: string): Promise<CardShareOutcome> {
  if (Platform.OS === "web") {
    if (!canShareFileOnWeb()) return "unsupported"
    try {
      const file = await fileFromDataUri(image.uri, fileName)
      await navigator.share({ files: [file], text: message })
      return "shared"
    } catch (error) {
      return (error as { name?: string })?.name === "AbortError" ? "dismissed" : "unsupported"
    }
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(image.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: message })
    return "shared"
  }
  // no file sharing on this device: the built-in sheet takes the file link on iOS
  const result = await Share.share(Platform.OS === "ios" ? { url: image.uri } : { message })
  return result.action === Share.dismissedAction ? "dismissed" : "shared"
}

/** Web only: downloads the PNG. Returns false when there is nothing to download with. */
export function saveCardImage(image: CardImage, fileName: string): boolean {
  if (Platform.OS !== "web" || typeof document === "undefined") return false
  const link = document.createElement("a")
  link.href = image.uri
  link.download = fileName
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return true
}
