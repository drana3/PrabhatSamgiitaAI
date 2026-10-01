import { buildClientPrincipal, hasEasyAuthSessionCookie, resolveClientPrincipal } from "@/lib/azure-principal"
import {
  fetchEasyAuthClientPrincipal,
  principalFromEasyAuthMe,
} from "@/lib/easy-auth"
import { resolvePublicSiteOrigin } from "@/lib/site-origin"

function decodeHeaderValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Resolve a member principal blob on SWA after platform Easy Auth (server request). */
export async function resolveSwaAuthPrincipalFromRequest(request: Request): Promise<string | null> {
  const headers = request.headers

  const headerPrincipal = resolveClientPrincipal(headers)
  if (headerPrincipal) return headerPrincipal

  if (hasEasyAuthSessionCookie(headers)) {
    const id = headers.get("x-ms-client-principal-id")
    if (id?.trim()) {
      const name = headers.get("x-ms-client-principal-name")
      const decodedName = name ? decodeHeaderValue(name) : null
      const email = decodedName?.includes("@") ? decodedName : null
      const providerHeader = headers.get("x-ms-client-principal-idp")?.toLowerCase()
      const provider =
        providerHeader === "google" ? "google" : providerHeader === "facebook" ? "facebook" : "aad"
      return buildClientPrincipal(decodeHeaderValue(id), decodedName, provider, email)
    }
  }

  const origin = resolvePublicSiteOrigin(request)
  const cookieHeader = headers.get("cookie") ?? ""
  if (!origin || !cookieHeader) return null

  const clientPrincipal = await fetchEasyAuthClientPrincipal(origin, cookieHeader)
  return principalFromEasyAuthMe(clientPrincipal)
}
