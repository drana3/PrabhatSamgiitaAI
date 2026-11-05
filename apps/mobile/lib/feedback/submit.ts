import Constants from "expo-constants"
import { Platform } from "react-native"

import { api } from "@/lib/client"
import type { AppDetails, FeedbackRequest } from "@/lib/feedback/model"

/**
 * App version and system version, for the "Include app details" switch. Read on the phone, sent only if the
 * switch is on. `device` stays null on purpose: `Constants.deviceName` is the name the owner gave the phone
 * ("Dada's iPhone"), which is personal. TODO: send the hardware model (expo-device `Device.modelName`) once
 * that package is added, and then say "phone model" in APP_DETAILS_NOTE again.
 */
export function readAppDetails(): AppDetails {
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    os: Platform.OS,
    osVersion: Platform.OS === "web" ? null : Platform.Version,
    device: null,
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
