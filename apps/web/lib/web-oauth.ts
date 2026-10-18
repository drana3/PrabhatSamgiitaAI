import { buildClientPrincipal } from "@/lib/azure-principal"
import { clearExplicitSignOut } from "@/lib/explicit-sign-out"
import { safeSignInNextPath, signInReturnPath } from "@/lib/sign-in"
import { writeOAuthReturnCookie } from "@/lib/oauth-return-cookie"

const FACEBOOK_NEXT_KEY = "ps_oauth_facebook_next"

export function googleClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ""
}

export function facebookAppId() {
  return process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim() ?? ""
}

export function webGoogleOAuthConfigured() {
  return Boolean(googleClientId())
}

export function webFacebookOAuthConfigured() {
  return Boolean(facebookAppId())
}

export function googleRedirectUri() {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/auth/callback/google`
}

export function facebookRedirectUri() {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/auth/callback/facebook`
}

export function googleEasyAuthCompleteHref() {
  return `/.auth/login/google?post_login_redirect_uri=${encodeURIComponent("/api/auth/google/complete")}`
}

export function startGoogleEasyAuth(next: string | undefined) {
  clearExplicitSignOut()
  writeOAuthReturnCookie(next ?? "/")
  window.location.assign(googleEasyAuthCompleteHref())
}

export function startGoogleOAuth(next: string | undefined) {
  const clientId = googleClientId()
  if (!clientId) throw new Error("Google sign-in is not configured.")
  clearExplicitSignOut()
  const returnPath = safeSignInNextPath(next)
  window.location.assign(`/api/auth/google/begin?next=${encodeURIComponent(returnPath)}`)
}

export async function completeGoogleOAuth(code: string, state?: string | null) {
  const response = await fetch("/api/auth/google/finish", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state }),
  })
  const body = (await response.json().catch(() => null)) as {
    destination?: string
    detail?: string
  } | null
  if (!response.ok || !body?.destination) {
    throw new Error(body?.detail || "Google sign-in did not complete.")
  }
  return signInReturnPath(body.destination)
}

export function startFacebookOAuth(next: string | undefined) {
  const clientId = facebookAppId()
  if (!clientId) throw new Error("Facebook sign-in is not configured.")
  clearExplicitSignOut()

  sessionStorage.setItem(FACEBOOK_NEXT_KEY, safeSignInNextPath(next))

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: facebookRedirectUri(),
    response_type: "code",
    scope: "public_profile,email",
  })
  window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?${params}`
}

export async function completeFacebookOAuth(code: string) {
  const clientId = facebookAppId()
  const next = sessionStorage.getItem(FACEBOOK_NEXT_KEY) ?? "/"
  sessionStorage.removeItem(FACEBOOK_NEXT_KEY)

  if (!clientId) throw new Error("Facebook sign-in is not configured.")

  const tokenResponse = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: facebookRedirectUri(),
      code,
    })}`,
  )
  const tokenBody = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string
    error?: { message?: string }
  } | null
  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(tokenBody?.error?.message || "Facebook sign-in did not complete.")
  }

  const profile = (await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tokenBody.access_token)}`,
  ).then((response) => response.json())) as { id?: string; email?: string; name?: string }

  if (!profile.id) throw new Error("Could not read your Facebook profile.")

  await establishWebSession({
    provider: "facebook",
    subject: profile.id,
    email: profile.email ?? null,
    displayName: profile.name || profile.email || "Facebook member",
  })

  return signInReturnPath(next)
}

export async function establishWebSession(input: {
  provider: string
  subject: string
  email: string | null
  displayName: string
}) {
  const principal = buildClientPrincipal(
    input.subject,
    input.displayName,
    input.provider,
    input.email,
  )
  const response = await fetch("/api/auth/principal", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_principal: principal,
      identity_provider: input.provider,
      email: input.email,
      display_name: input.displayName,
    }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail || "Could not complete sign-in.")
  }
}
