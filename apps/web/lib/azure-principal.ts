type Claim = { typ: string; val: string }

function decodeHeaderValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function buildClientPrincipal(id: string, name?: string | null, provider = "aad") {
  const claims: Claim[] = [
    {
      typ: "http://schemas.microsoft.com/identity/claims/objectidentifier",
      val: id,
    },
    {
      typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
      val: id,
    },
  ]

  if (name) {
    claims.push({ typ: "name", val: name })
    claims.push({
      typ: "http://schemas.microsoft.com/identity/claims/displayname",
      val: name,
    })
    if (name.includes("@")) {
      claims.push({ typ: "email", val: name })
      claims.push({ typ: "preferred_username", val: name })
      claims.push({
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        val: name,
      })
    }
  }

  const payload = { auth_typ: provider, claims }
  return Buffer.from(JSON.stringify(payload)).toString("base64")
}

export function resolveClientPrincipal(source: Headers) {
  const existing = source.get("x-ms-client-principal")
  if (existing) return existing

  const id = source.get("x-ms-client-principal-id")
  if (!id) return null

  const name = source.get("x-ms-client-principal-name")
  return buildClientPrincipal(decodeHeaderValue(id), name ? decodeHeaderValue(name) : null)
}

export function azureAuthForwardHeaders(source: Headers) {
  const headers = new Headers()
  for (const name of [
    "x-ms-client-principal",
    "x-ms-client-principal-id",
    "x-ms-client-principal-name",
    "cookie",
  ]) {
    const value = source.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}
