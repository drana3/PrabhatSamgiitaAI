/**
 * Consent to send questions to the AI service (App Store 5.1.2(i), Play Data safety).
 * Pure: no React, no storage. The persisted record lives in stores/aiConsentStore.ts; this module holds the rule
 * and a plain mirror of "is consent given right now", which lib/client.ts reads so that no code path can reach
 * the AI endpoint without it, whatever screen calls it.
 */

/** Bump when the wording changes in a way that needs a fresh yes. */
export const AI_CONSENT_VERSION = 1

export type AiConsentRecord = {
  /** ISO time the person tapped Agree; null when there is no consent. */
  agreedAt: string | null
  version: number
}

export function isConsentValid(record: AiConsentRecord | null | undefined): boolean {
  if (!record || !record.agreedAt) return false
  if (Number.isNaN(Date.parse(record.agreedAt))) return false
  return record.version === AI_CONSENT_VERSION
}

export class AiConsentRequiredError extends Error {
  constructor() {
    super("Agree to send your questions to the AI service first.")
    this.name = "AiConsentRequiredError"
  }
}

let mirror = false

export function setAiConsentMirror(granted: boolean) {
  mirror = granted
}

export function aiConsentGranted(): boolean {
  return mirror
}

/** Wraps a function that sends a question to the AI: it throws before any network call without consent. */
export function requireAiConsent<Args extends unknown[], Result>(
  send: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    if (!mirror) throw new AiConsentRequiredError()
    return send(...args)
  }
}
