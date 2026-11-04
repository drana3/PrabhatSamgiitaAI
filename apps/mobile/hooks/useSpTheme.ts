import type { SpTheme } from "@/constants/tokens/amSong"
import { spDark, spLight } from "@/constants/tokens/amSong"
import { useResolvedAppearance } from "@/hooks/useAmTheme"

/** Song-area theme: the prototype's `--am-*` variables for light or dark, from Profile > Appearance. */
export function useSpTheme(): SpTheme {
  return useResolvedAppearance() === "dark" ? spDark : spLight
}
