import Constants from "expo-constants"

import { createApiClient } from "@prabhat/core"

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "http://localhost:8000"

export const api = createApiClient({ baseUrl: apiBaseUrl })

export { colors, spacing, radii, typography } from "@prabhat/core"
