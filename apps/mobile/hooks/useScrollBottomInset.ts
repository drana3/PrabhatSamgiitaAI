import { usePathname } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { scrollBottomInset } from "@/lib/navV2"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * Bottom padding for the content of a long page, so its last row and its last button are never behind the
 * mini-player, the tab pill or the home indicator. Use it as `paddingBottom` of the scroll content (add the
 * page's own air with `extra`). One rule for every screen: lib/navV2.ts scrollBottomInset.
 */
export function useScrollBottomInset(extra = 0): number {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  return scrollBottomInset({ safeBottom: insets.bottom, pathname, hasSong }) + extra
}
