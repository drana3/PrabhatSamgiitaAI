/** Canonical custom-scheme redirect registered on Entra app `prabhatai-members`. */
export const MICROSOFT_REDIRECT_SCHEME = "prabhatai"
export const MICROSOFT_REDIRECT_PATH = "auth"

/** Stable URI to register in Azure (Azure rejects bare `prabhatai://`). */
export function microsoftRedirectHint() {
  return `${MICROSOFT_REDIRECT_SCHEME}://${MICROSOFT_REDIRECT_PATH}`
}
