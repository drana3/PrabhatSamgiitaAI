import type { Href } from "expo-router"

/** Temporary cast until Expo regenerates typed routes for the new file tree. */
export function href(path: string): Href {
  return path as Href
}
