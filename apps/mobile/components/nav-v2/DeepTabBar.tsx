import { useEffect, useMemo, useState } from "react"
import { Keyboard } from "react-native"
import { useNavigationContainerRef, usePathname, useRouter } from "expo-router"

import { FloatingTabBar } from "@/components/nav-v2/FloatingTabBar"
import { NAV_V2_TABS, flattenRoutes, originTabId, type NavV2TabId } from "@/lib/navV2"
import { href } from "@/utils/href"

/**
 * The tab bar on the pushed browse pages (song page, a collection, an author, a recording ...). Which pages carry it is
 * the table in lib/playerPolicy.ts (docs/player-visibility.md). Mounted by MiniPlayerHost, so no screen draws it and the
 * root layout is untouched.
 *
 * It marks the tab the person came from (the shell under the page). Tapping a tab goes there in one step: the pages
 * above the shell are closed (router.dismissTo, the way Search does it). Tapping the marked tab is the same: back to
 * that tab's first screen. It steps aside while a keyboard is up, so it never sits on a text field.
 */
export function DeepTabBar() {
  const router = useRouter()
  const navigation = useNavigationContainerRef()
  const pathname = usePathname()
  // the stack changes with the path: read it again for each page
  const origin = useMemo<NavV2TabId | null>(
    () => originTabId(navigation.isReady() ? flattenRoutes(navigation.getRootState()) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation, pathname],
  )
  const [keyboard, setKeyboard] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  if (keyboard) return null
  const go = (id: NavV2TabId) => {
    const tab = NAV_V2_TABS.find((t) => t.id === id)
    if (tab) router.dismissTo(href(tab.href))
  }
  return <FloatingTabBar activeId={origin} onSelect={go} onReselect={go} />
}
