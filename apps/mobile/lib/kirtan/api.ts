import { apiBaseUrl } from "@/lib/client"
import { authHeadersFromStore } from "@/lib/memberAuth"
import type { RemoteConfig } from "@/lib/kirtan/remote"

/**
 * The real wiring of lib/kirtan/remote.ts: the app's API base URL and the signed-in member's headers.
 * Kept apart so the rest of lib/kirtan stays free of the API client and the auth store (tests inject their own).
 */
export function remoteConfig(): RemoteConfig {
  return { baseUrl: apiBaseUrl, headers: () => authHeadersFromStore() }
}

/** The member is signed in and the build can prove it to the server (the headers are not empty). */
export function canUseServer(): boolean {
  return Object.keys(authHeadersFromStore()).length > 0
}
