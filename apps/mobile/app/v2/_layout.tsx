import { useEffect } from "react"
import { Tabs, usePathname, useRouter } from "expo-router"
import { View } from "react-native"

import { FloatingTabBar } from "@/components/nav-v2/FloatingTabBar"
import { MiniPlayerPill } from "@/components/nav-v2/MiniPlayerPill"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useMockupPlayerSeed } from "@/lib/mockupPlayerSeed"
import { startPlayerV2Services } from "@/lib/playerV2/services"
import { NAV_V2_TABS, miniPlayerVisible, type NavV2TabId } from "@/lib/navV2"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

/**
 * Navigation shell v2 (redesign). Reachable at /v2/today, /v2/songs, /v2/player, /v2/learn
 * and not linked from anywhere: the current (tabs) layout is untouched.
 * The tab list, its routes and screens come from NAV_V2_TABS in lib/navV2.ts.
 */
export default function V2Layout() {
  const theme = useAmTheme()
  const router = useRouter()
  const pathname = usePathname()
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  useMockupPlayerSeed()

  // The redesigned player services only run inside the v2 shell, so the
  // current app behaves exactly as before until the redesign replaces it.
  useEffect(() => {
    startPlayerV2Services()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: theme.page }}>
      <Tabs
        initialRouteName={NAV_V2_TABS[0].screen}
        screenOptions={{ headerShown: false, lazy: true, sceneStyle: { backgroundColor: theme.page } }}
        tabBar={(props) => {
          const route = props.state.routes[props.state.index]
          const active = NAV_V2_TABS.find((tab) => tab.screen === route?.name)?.id ?? NAV_V2_TABS[0].id
          const select = (id: NavV2TabId) => {
            const tab = NAV_V2_TABS.find((t) => t.id === id)
            if (tab) props.navigation.navigate(tab.screen)
          }
          return <FloatingTabBar activeId={active} onSelect={select} />
        }}
      >
        {NAV_V2_TABS.map((tab) => (
          <Tabs.Screen key={tab.id} name={tab.screen} options={{ title: tab.label }} />
        ))}
      </Tabs>
      <MiniPlayerPill
        visible={miniPlayerVisible({ pathname, hasSong })}
        onOpenPlayer={() => router.navigate(href(NAV_V2_TABS.find((tab) => tab.id === "player")!.href))}
      />
    </View>
  )
}
