import { useCallback } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { SheetShell } from "@/components/profile-v2/SheetShell"
import { useProfileContent } from "@/components/profile-v2/ProfileContent"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { href } from "@/utils/href"

/**
 * Profile sheet (prototype PROFILE SHEET). Opened by the avatar button on Today and Songs; presented as
 * a transparent modal so the screen behind stays visible under the scrim. The sheet animates itself
 * (drag, spring, momentum).
 */
export default function ProfileSheetScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const resolved = useResolvedAppearance()
  const { body, overlay, p } = useProfileContent(theme)

  const onClosed = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/today"))
  }, [router])

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyleFor(resolved)} />
      <SheetShell p={p} label="Profile and settings" onClosed={onClosed} overlay={overlay}>
        {body}
      </SheetShell>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
