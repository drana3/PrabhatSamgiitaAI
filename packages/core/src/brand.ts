/** Public product name — never include “AI” here. */
export const PRODUCT_NAME = "Prabhat Samgiita" as const

/** Companion is a feature, not part of the product name. */
export const COMPANION_FEATURE_NAME = "AI Companion" as const

/** Short label in chat transcripts */
export const COMPANION_CHAT_NAME = "Companion" as const

export const COMPOSER_NAME = "Shrii Prabhat Ranjan Sarkar" as const

export const COMPOSER_PORTRAIT_ALT = "Shrii Prabhat Ranjan Sarkar at dawn" as const

export function songShareCredit(): string {
  return PRODUCT_NAME
}