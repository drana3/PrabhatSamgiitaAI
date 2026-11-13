import Constants from "expo-constants"
import { Platform } from "react-native"
import { createApiClient } from "@prabhat/core"

import { requireAiConsent } from "@/lib/aiConsent"
import { authHeadersFromStore } from "@/lib/memberAuth"
import { configureMemberSession, ensureFreshAccessToken, ensureMemberSessionHydrated } from "@/lib/memberSession"

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

configureMemberSession(apiBaseUrl)

const rawApi = createApiClient({
  baseUrl: apiBaseUrl,
  // Refresh the access token first when it is about to expire, so a request never goes out with a dead one.
  getAuthHeaders: async (): Promise<Record<string, string>> => {
    await ensureMemberSessionHydrated()
    await ensureFreshAccessToken(apiBaseUrl)
    return authHeadersFromStore()
  },
})

/**
 * The only request that sends the person's own words to a third-party AI (Azure OpenAI) is
 * streamExplanation. It cannot run until the person agreed (see lib/aiConsent.ts), whichever screen calls it.
 */
export const api = {
  ...rawApi,
  streamExplanation: requireAiConsent(rawApi.streamExplanation),
}

export { colors, spacing, radii, typography } from "@prabhat/core"
