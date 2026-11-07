import type { View } from "react-native"
import { captureRef } from "react-native-view-shot"

/** Native: view-shot draws the view into a PNG file in the cache and returns its file:// uri. The web has its own file (cardCapture.web.ts). */
export async function capturePng(view: View, size: { width: number; height: number }): Promise<string> {
  return captureRef(view, { format: "png", quality: 1, result: "tmpfile", width: size.width, height: size.height })
}
