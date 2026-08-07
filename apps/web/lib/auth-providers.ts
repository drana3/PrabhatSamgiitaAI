export const LOCAL_AUTH_COOKIE = "ps_member_principal"

export function localAuthEnabled() {
  return process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED !== "false"
}

export function googleAuthEnabled() {
  return (
    Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()) ||
    process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  )
}

export function facebookAuthEnabled() {
  return (
    Boolean(process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim()) ||
    process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  )
}
