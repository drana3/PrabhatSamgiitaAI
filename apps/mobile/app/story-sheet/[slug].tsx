import { View } from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"

import { StorySheet } from "@/components/songs-v2/StorySheet"
import { useAmTheme } from "@/hooks/useAmTheme"
import { href } from "@/utils/href"

/**
 * Story sheet as a route (spec SCR-19), so Today's "Story of the week" card
 * can open it with router.push("/story-sheet/<slug>") and Collections can
 * link to it. The screen is a transparent modal with no slide of its own: the
 * sheet inside animates, so the whole thing is one interruptible spring.
 * The older /stories/[slug] page is untouched.
 */
export default function StorySheetRoute() {
  const router = useRouter()
  const theme = useAmTheme()
  const { slug } = useLocalSearchParams<{ slug?: string }>()

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ presentation: "transparentModal", animation: "none", headerShown: false }} />
      <StorySheet
        open
        theme={theme}
        slug={slug ? String(slug) : null}
        onClose={() => router.back()}
        onOpenSong={(target) => router.replace(href(target))}
      />
    </View>
  )
}
