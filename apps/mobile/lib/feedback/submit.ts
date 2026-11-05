import Constants from "expo-constants"
import { Platform } from "react-native"

import { api } from "@/lib/client"
import type { AppDetails, FeedbackRequest } from "@/lib/feedback/model"

/** Version, system and phone model, for the "Include app details" switch. Read on the phone, sent only if the switch is on. */
export function readAppDetails(): AppDetails {
  const constants = Constants as unknown as { deviceName?: string | null }
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    os: Platform.OS,
    osVersion: Platform.OS === "web" ? null : Platform.Version,
    device: Platform.OS === "web" ? null : (constants.deviceName ?? null),
  }
}

/**
 * Send one message with the existing client (POST /api/v1/feedback, the same endpoint as the website and the
 * old page). Resolves with the server's thank-you line; throws with a readable message on failure.
 */
export async function sendFeedback(request: FeedbackRequest): Promise<string> {
  const result = await api.submitFeedback(request)
  return result.message
}
