import { useCallback } from "react"
import { usePathname, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { MiniPlayerPill } from "@/components/nav-v2/MiniPlayerPill"
import { NAV_V2_PLAYER_ROUTE, miniBottomFor, miniPlayerVisible, tabBarVisible } from "@/lib/navV2"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

/**
 * Mounted ONCE in the root layout, above every navigator. Decides from the route whether the pill shows
 * (not on the full player, welcome/sign-in, full-screen sheets) and where it sits: above the floating tab
 * bar on a tab screen, above the bottom safe area on a pushed screen.
 */
export function MiniPlayerHost() {
  const pathname = usePathname()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const visible = miniPlayerVisible({ pathname, hasSong })
  const bottom = miniBottomFor(insets.bottom, tabBarVisible(pathname))
  const open = useCallback(() => router.push(href(NAV_V2_PLAYER_ROUTE)), [router])
  return <MiniPlayerPill visible={visible} bottom={bottom} onOpenPlayer={open} />
}
