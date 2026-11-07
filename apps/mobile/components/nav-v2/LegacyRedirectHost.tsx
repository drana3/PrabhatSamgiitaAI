import { useEffect } from "react"
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router"

import { legacyRouteTarget } from "@/lib/legacyRoutes"
import { href } from "@/utils/href"

/** Old screens that stay in the repository but have a working screen of their own: they are not redirected. */
const KEPT_ROUTES = ["/drive"]

/**
 * The team's v1 screens stay in the repository (app/(tabs), app/song, ...), so their addresses match a real
 * file and the not-found screen never sees them. This sends any such address to its redesigned screen
 * (lib/legacyRoutes.ts), so an old bookmark, a shared link or a stale tab opens the redesign, not the old list.
 */
export function LegacyRedirectHost() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useGlobalSearchParams() as Record<string, string | string[] | undefined>

  useEffect(() => {
    if (KEPT_ROUTES.some((kept) => pathname === kept || pathname.startsWith(`${kept}/`))) return
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string") query.append(key, value)
      else if (Array.isArray(value)) value.forEach((item) => query.append(key, item))
    })
    const text = query.toString()
    const moved = legacyRouteTarget(text ? `${pathname}?${text}` : pathname)
    if (moved) router.replace(href(moved))
  }, [pathname, params, router])

  return null
}
