import type { View } from "react-native"
// react-native-view-shot's captureRef calls findNodeHandle, which react-native-web does not have; its own web
// capture (html2canvas) takes the DOM node, which is what a View ref is on the web.
// @ts-expect-error a Flow file without types
import viewShotWeb from "react-native-view-shot/src/RNViewShot.web"

/** Web: html2canvas draws the element and the result is a PNG data URI, resized to exactly `size`. */
export async function capturePng(view: View, size: { width: number; height: number }): Promise<string> {
  return viewShotWeb.captureRef(view as unknown as HTMLElement, { format: "png", quality: 1, result: "data-uri", width: size.width, height: size.height })
}
