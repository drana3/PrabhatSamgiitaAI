export const EXPLICIT_SIGN_OUT_KEY = "ps_explicit_sign_out"

export function markExplicitSignOut() {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(EXPLICIT_SIGN_OUT_KEY, "1")
  } catch {
    // ignore quota / private mode
  }
}

export function clearExplicitSignOut() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(EXPLICIT_SIGN_OUT_KEY)
  } catch {
    // ignore
  }
}

export function hasExplicitSignOut() {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(EXPLICIT_SIGN_OUT_KEY) === "1"
  } catch {
    return false
  }
}
