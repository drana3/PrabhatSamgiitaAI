import Constants from "expo-constants"
import { Platform } from "react-native"
import { createApiClient } from "@prabhat/core"

import { buildMemberAuthHeaders } from "@/lib/memberAuth"
import { useAuthStore } from "@/stores/authStore"

const productionApi =
  "https://prabhatai-api.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io"

function isLoopback(url: string | undefined) {
  return Boolean(url && /localhost|127\.0\.0\.1/i.test(url))
}

const configured =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  productionApi

/** A phone cannot reach the Mac via localhost; keep loopback only on simulators. */
export const apiBaseUrl =
  isLoopback(configured) && Platform.OS !== "web" && Constants.isDevice !== false
    ? productionApi
    : configured

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getAuthHeaders: (): Record<string, string> => {
    const { mode, email, displayName, memberId, identityProvider } = useAuthStore.getState()
    // Member sync must work with OID alone — Microsoft sometimes omits email claims.
    if (mode !== "signed_in" || (!email && !memberId)) return {}
    return buildMemberAuthHeaders(
      email ?? "",
      displayName || email || "Member",
      memberId,
      identityProvider || "aad",
    )
  },
})

export { colors, spacing, radii, typography } from "@prabhat/core"
