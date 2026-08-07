import { buildClientPrincipal } from "@/lib/azure-principal"
import { safeSignInNextPath, signInReturnPath } from "@/lib/sign-in"

const GOOGLE_VERIFIER_KEY = "ps_oauth_google_verifier"
const GOOGLE_NEXT_KEY = "ps_oauth_google_next"
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

function randomString(length = 48) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function googleRedirectUri() {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/auth/callback/google`
}

export function facebookRedirectUri() {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/auth/callback/facebook`
}

export async function startGoogleOAuth(next: string | undefined) {
  const clientId = googleClientId()
  if (!clientId) throw new Error("Google sign-in is not configured.")

  const verifier = randomString(32)
  const challenge = await pkceChallenge(verifier)
  sessionStorage.setItem(GOOGLE_VERIFIER_KEY, verifier)
  sessionStorage.setItem(GOOGLE_NEXT_KEY, safeSignInNextPath(next))

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid profile email",
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function startFacebookOAuth(next: string | undefined) {
  const clientId = facebookAppId()
  if (!clientId) throw new Error("Facebook sign-in is not configured.")

  sessionStorage.setItem(FACEBOOK_NEXT_KEY, safeSignInNextPath(next))

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: facebookRedirectUri(),
    response_type: "code",
    scope: "public_profile,email",
  })
  window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?${params}`
}

export async function completeGoogleOAuth(code: string) {
  const clientId = googleClientId()
  const verifier = sessionStorage.getItem(GOOGLE_VERIFIER_KEY) ?? ""
  const next = sessionStorage.getItem(GOOGLE_NEXT_KEY) ?? "/"
  sessionStorage.removeItem(GOOGLE_VERIFIER_KEY)
  sessionStorage.removeItem(GOOGLE_NEXT_KEY)

  if (!clientId || !verifier) {
    throw new Error("Google sign-in expired. Please try again.")
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  })
  const tokenBody = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string
    error_description?: string
  } | null
  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(tokenBody?.error_description || "Google sign-in did not complete.")
  }

  const profile = (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  }).then((response) => response.json())) as { sub?: string; email?: string; name?: string }

  if (!profile.sub) throw new Error("Could not read your Google profile.")

  await establishWebSession({
    provider: "google",
    subject: profile.sub,
    email: profile.email ?? null,
    displayName: profile.name || profile.email || "Google member",
  })

  return signInReturnPath(next)
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

async function establishWebSession(input: {
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
