import { Redirect } from "expo-router"

import { href } from "@/utils/href"

/**
 * Songs > Mine, standalone (redesign route /saved-v2). In the prototype Mine is the third segment
 * of the Songs tab (lines 1216-1250), so this route opens that segment instead of keeping a second
 * copy of the same screen.
 */
export default function SavedV2Screen() {
  return <Redirect href={href("/songs-v2?segment=mine")} />
}
