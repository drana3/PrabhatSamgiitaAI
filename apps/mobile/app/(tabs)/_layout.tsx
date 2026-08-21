import { Tabs } from "expo-router"
import { Home, Library, Sparkles, Heart, User } from "lucide-react-native"
import { Platform, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { MiniPlayer } from "@/components/player/MiniPlayer"
import { colors } from "@/constants/colors"
import { usePlayerStore } from "@/stores/playerStore"

function TabIcon({
  Icon,
  color,
  focused,
}: {
  Icon: typeof Home
  color: string
  focused: boolean
}) {
  return <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const tabBarHeight = (Platform.OS === "ios" ? 52 : 58) + Math.max(insets.bottom, 8)

  return (
    <View style={styles.root}>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          lazy: true,
          // freezeOnBlur left screens unresponsive after quick tab / button presses on Android.
          freezeOnBlur: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: tabBarHeight,
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          tabBarLabelStyle: {
            fontFamily: "Inter_500Medium",
            fontSize: 11,
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={Home} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="songs"
          options={{
            title: "Songs",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={Library} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="ai"
          options={{
            title: "AI",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={Sparkles} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="saved"
          options={{
            title: "Saved",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={Heart} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={User} color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
      {hasSong ? (
        <View style={[styles.miniSlot, { bottom: tabBarHeight }]} pointerEvents="box-none">
          <MiniPlayer />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  miniSlot: {
    position: "absolute",
    left: 0,
    right: 0,
  },
})
