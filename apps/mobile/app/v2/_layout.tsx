import { useEffect } from "react"
import { Tabs } from "expo-router"
import { View } from "react-native"

import { FloatingTabBar } from "@/components/nav-v2/FloatingTabBar"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useMockupPlayerSeed } from "@/lib/mockupPlayerSeed"
import { startPlayerV2Services } from "@/lib/playerV2/services"
import { NAV_V2_TABS, type NavV2TabId } from "@/lib/navV2"

/**
 * Navigation shell v2 (redesign). Reachable at /v2/today, /v2/songs, /v2/kiirtan, /v2/learn
 * and not linked from anywhere: the current (tabs) layout is untouched.
 * The tab list, its routes and screens come from NAV_V2_TABS in lib/navV2.ts.
 * The mini-player is NOT drawn here: components/nav-v2/MiniPlayerHost is mounted once in the root layout.
 */
export default function V2Layout() {
  const theme = useAmTheme()
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
        {/* Old link /v2/player: not a tab any more; it redirects to the full player. */}
        <Tabs.Screen name="player" options={{ href: null }} />
      </Tabs>
    </View>
  )
}
