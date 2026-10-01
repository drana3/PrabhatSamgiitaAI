import { buildClientPrincipal, hasEasyAuthSessionCookie, resolveClientPrincipal } from "@/lib/azure-principal"
import {
  fetchEasyAuthClientPrincipal,
  principalFromEasyAuthMe,
  requestOriginFromHeaders,
} from "@/lib/easy-auth"

function decodeHeaderValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Resolve a member principal blob on SWA after Microsoft Easy Auth (server request). */
export async function resolveMicrosoftPrincipalFromRequest(request: Request): Promise<string | null> {
  const headers = request.headers

  const headerPrincipal = resolveClientPrincipal(headers)
  if (headerPrincipal) return headerPrincipal

  if (hasEasyAuthSessionCookie(headers)) {
    const id = headers.get("x-ms-client-principal-id")
    if (id?.trim()) {
      const name = headers.get("x-ms-client-principal-name")
      const decodedName = name ? decodeHeaderValue(name) : null
      const email = decodedName?.includes("@") ? decodedName : null
      return buildClientPrincipal(decodeHeaderValue(id), decodedName, "aad", email)
    }
  }

  const origin = requestOriginFromHeaders(headers)
  const cookieHeader = headers.get("cookie") ?? ""
  if (!origin || !cookieHeader) return null

  const clientPrincipal = await fetchEasyAuthClientPrincipal(origin, cookieHeader)
  return principalFromEasyAuthMe(clientPrincipal)
}
