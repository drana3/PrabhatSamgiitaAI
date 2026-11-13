import { Platform } from "react-native"

import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * Push for replies to the member's comments (docs/comment-replies.md, "Push"). It is OFF until a build says so: the
 * flag `EXPO_PUBLIC_PUSH_ENABLED=true` is set at build time, together with the Expo project id, the APNs key and the
 * FCM credentials on EAS (see the doc). Off, and on the web preview, in the mock-data preview and in Expo Go
 * without credentials, nothing in `lib/push` talks to the OS or the server.
 */
export function pushFlagOn(env: string | undefined = process.env.EXPO_PUBLIC_PUSH_ENABLED): boolean {
  return ["1", "true", "yes", "on"].includes((env ?? "").trim().toLowerCase())
}

export function pushSupportedFor(input: { flag: boolean; platform: string; mock: boolean }): boolean {
  return input.flag && !input.mock && (input.platform === "ios" || input.platform === "android")
}

/** True when this build may register for push. */
export function pushSupported(): boolean {
  return pushSupportedFor({ flag: pushFlagOn(), platform: Platform.OS, mock: MOCKUP_DATA })
}
