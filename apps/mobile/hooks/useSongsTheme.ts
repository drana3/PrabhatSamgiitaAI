import { useMemo } from "react"

import { songsTheme, type SongsTheme } from "@/constants/tokens/amSongs"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"

/** AmTheme plus the Songs-area extras (ink-300, on-ink, peach). Follows Profile > Appearance. */
export function useSongsTheme(): SongsTheme {
  const am = useAmTheme()
  const resolved = useResolvedAppearance()
  return useMemo(() => songsTheme(am, resolved === "dark"), [am, resolved])
}
