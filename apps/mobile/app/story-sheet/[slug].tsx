import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"

import { SpStorySheet } from "@/components/song-v2/SpStorySheet"
import { useSpTheme } from "@/hooks/useSpTheme"
import { href } from "@/utils/href"

const EXIT_MS = 260

/**
 * Story sheet as a route (spec SCR-19), so Today's "Story of the week" card can open it with
 * router.push("/story-sheet/<slug>") and Collections can link to it. The screen is a transparent modal with no
 * slide of its own: the sheet inside is one interruptible spring, in and out, and the route leaves once the
 * sheet is down.
 */
export default function StorySheetRoute() {
  const router = useRouter()
  const t = useSpTheme()
  const { slug } = useLocalSearchParams<{ slug?: string }>()
  const [visible, setVisible] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const leave = useCallback(
    (then: () => void) => {
      setVisible(false)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(then, EXIT_MS)
    },
    [],
  )

  const close = useCallback(() => {
    leave(() => {
      if (router.canGoBack()) router.back()
      else router.replace(href("/songs-v2"))
    })
  }, [leave, router])

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ presentation: "transparentModal", animation: "none", headerShown: false }} />
      <SpStorySheet
        t={t}
        visible={visible}
        slug={slug ? String(slug) : null}
        onClose={close}
        onOpenSong={(target) => leave(() => router.replace(href(target)))}
      />
    </View>
  )
}
