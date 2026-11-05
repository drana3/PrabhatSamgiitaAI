import { isPublicWebHost } from "@/lib/deepLinks"

/**
 * What a link inside an assistant answer may do. The answer is model text, so a link can be anything:
 * only https links to the project's own website open (in the browser). Everything else (tel:, sms:,
 * mailto:, custom schemes, http, other sites) does nothing, and images in answers are never loaded
 * (a remote image would tell its host the reader's IP address).
 */
export function isSafeAssistantLink(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    return url.protocol === "https:" && isPublicWebHost(url.hostname)
  } catch {
    return false
  }
}
