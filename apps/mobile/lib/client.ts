import Constants from "expo-constants"
import { createApiClient } from "@prabhat/core"

import { buildMemberAuthHeaders } from "@/lib/memberAuth"
import { useAuthStore } from "@/stores/authStore"

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "http://localhost:8000"

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getAuthHeaders: (): Record<string, string> => {
    const { mode, email, displayName, memberId, identityProvider } = useAuthStore.getState()
    if (mode !== "signed_in" || !email) return {}
    return buildMemberAuthHeaders(email, displayName, memberId, identityProvider || "aad")
  },
})

export { colors, spacing, radii, typography } from "@prabhat/core"
