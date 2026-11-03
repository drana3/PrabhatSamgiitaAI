import { useCallback } from "react"
import { useRouter } from "expo-router"

import { NAV_V2_PROFILE_SHEET_ROUTE } from "@/lib/navV2"
import { href } from "@/utils/href"

/**
 * Entry for the avatar button (top right of Today and Songs). The sheet itself is built
 * on another branch; this only opens the route named in lib/navV2.ts.
 */
export function useOpenProfileSheet(): () => void {
  const router = useRouter()
  return useCallback(() => router.push(href(NAV_V2_PROFILE_SHEET_ROUTE)), [router])
}
