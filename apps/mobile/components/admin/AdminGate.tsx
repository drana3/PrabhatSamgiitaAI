import type { ReactNode } from "react"
import { useRouter } from "expo-router"

import { NoticeScreen } from "@/components/common/NoticeScreen"
import { useT } from "@/lib/i18n"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

/**
 * Admin-only screens open for a signed-in admin and for nobody else, whatever link reached them.
 * (The server checks the admin role on every call too; this keeps the tools themselves out of sight.)
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const t = useT()
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  if (mode === "signed_in" && isAdmin) return <>{children}</>
  return (
    <NoticeScreen
      title={t("admin.only.title")}
      body={t("admin.only.body")}
      primary={{ label: t("notFound.home"), onPress: () => router.replace(href(NAV_V2_HOME_ROUTE)) }}
    />
  )
}

/** Internal development pages (the website parity map): a release build shows the not-found page instead. */
export function DevOnly({ children }: { children: ReactNode }) {
  const t = useT()
  const router = useRouter()
  if (__DEV__) return <>{children}</>
  return (
    <NoticeScreen
      title={t("notFound.title")}
      body={t("notFound.body")}
      primary={{ label: t("notFound.home"), onPress: () => router.replace(href(NAV_V2_HOME_ROUTE)) }}
    />
  )
}
