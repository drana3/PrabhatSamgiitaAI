const NDMA_SACHET_HOME = "https://sachet.ndma.gov.in/"

export function publicContextLink(url: string | undefined | null): string | null {
  if (!url?.trim()) return null
  try {
    const parsed = new URL(url.trim())
    if (parsed.hostname === "sachet.ndma.gov.in") {
      const path = parsed.pathname.toLowerCase()
      if (path.includes("fetchxmlfile") || path.includes("/alert/") || path.endsWith(".xml")) {
        return NDMA_SACHET_HOME
      }
    }
    return parsed.toString()
  } catch {
    return null
  }
}
