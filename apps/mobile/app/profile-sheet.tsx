import { useCallback } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { ProfileSheet } from "@/components/profile-v2/ProfileSheet"
import { useProfileContent } from "@/components/profile-v2/ProfileContent"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { href } from "@/utils/href"

/**
 * Profile sheet (spec SCR-14). Opened by the avatar button on Today and Songs;
 * presented as a transparent modal so the screen behind stays visible under
 * the scrim. The sheet animates itself (drag, spring, momentum).
 */
export default function ProfileSheetScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const resolved = useResolvedAppearance()
  const { body, overlay } = useProfileContent(theme)

  const onClosed = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/today"))
  }, [router])

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyleFor(resolved)} />
      <ProfileSheet theme={theme} onClosed={onClosed} overlay={overlay}>
        {body}
      </ProfileSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
