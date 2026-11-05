import { Redirect, useGlobalSearchParams, usePathname, useRouter } from "expo-router"

import { NoticeScreen } from "@/components/common/NoticeScreen"
import { legacyRouteTarget } from "@/lib/legacyRoutes"
import { useT } from "@/lib/i18n"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { href } from "@/utils/href"

/**
 * Anything the router does not know. An old (v1) address is sent to its redesigned screen (deep links,
 * shared cards and bookmarks keep working, lib/legacyRoutes.ts); anything else gets a visible way home.
 * Never an automatic redirect to home for unknown paths (that hides loops as a blank screen).
 */
export default function NotFound() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const params = useGlobalSearchParams() as Record<string, string | string[] | undefined>

  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    // the router adds the unmatched path segments as "not-found"
    if (key === "not-found") return
    if (typeof value === "string") query.append(key, value)
    else if (Array.isArray(value)) value.forEach((item) => query.append(key, item))
  })
  const text = query.toString()
  const moved = legacyRouteTarget(text ? `${pathname}?${text}` : pathname)
  if (moved) return <Redirect href={href(moved)} />

  return (
    <NoticeScreen
      title={t("notFound.title")}
      body={t("notFound.body")}
      primary={{ label: t("notFound.home"), onPress: () => router.replace(href(NAV_V2_HOME_ROUTE)) }}
    />
  )
}
