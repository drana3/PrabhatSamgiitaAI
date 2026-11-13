import { useEffect, useMemo, type ReactNode } from "react"
import { Platform } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"

import { useResolvedAppearance } from "@/hooks/useAmTheme"
import { postFrameStatusBar, readFrameInsets } from "@/lib/framePreview"
import { statusBarStyleFor } from "@/lib/appearance"

/**
 * Edge to edge, in one place. The app draws under the status bar, the camera cut-out and the home indicator;
 * screens keep their own content clear of them with useSafeAreaInsets(). In the browser preview
 * (public/phone.html) the frame supplies the insets a browser cannot report. Everywhere else this passes
 * the real insets through untouched.
 */
export function FrameSafeArea({ children }: { children: ReactNode }) {
  const frame = useMemo(() => (Platform.OS === "web" ? readFrameInsets() : null), [])
  if (!frame) return <>{children}</>
  return <SafeAreaInsetsContext.Provider value={frame}>{children}</SafeAreaInsetsContext.Provider>
}

/** The system status bar: content colour follows the resolved Light / Dark theme; the frame mirrors it. */
export function AppStatusBar() {
  const resolved = useResolvedAppearance()
  const style = statusBarStyleFor(resolved)
  useEffect(() => {
    if (Platform.OS === "web") postFrameStatusBar(style)
  }, [style])
  return <StatusBar style={style} />
}
