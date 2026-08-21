import { runtimeEnv } from "@/lib/runtime-env"

export const ADMIN_GATE_COOKIE = "psa_admin_gate"
const ADMIN_GATE_TTL_SEC = 300
const textEncoder = new TextEncoder()

function gateSecret() {
  return runtimeEnv("MEMBER_PROXY_KEY") ?? ""
}

function timingSafeEqualHex(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

async function hmacHex(secret: string, message: string, length: number) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message))
    return Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, length)
  } catch {
    return ""
  }
}

async function principalFingerprint(secret: string, principal: string) {
  return hmacHex(secret, principal, 16)
}

export async function buildAdminGateToken(
  principal: string,
  nowSec = Math.floor(Date.now() / 1000),
) {
  try {
    const secret = gateSecret()
    if (!secret || !principal.trim()) return ""
    const fingerprint = await principalFingerprint(secret, principal)
    if (!fingerprint) return ""
    const expiresAt = nowSec + ADMIN_GATE_TTL_SEC
    const payload = `${fingerprint}.${expiresAt}`
    const signature = await hmacHex(secret, payload, 24)
    if (!signature) return ""
    return `${payload}.${signature}`
  } catch {
    return ""
  }
}

export async function verifyAdminGateToken(token: string | undefined, principal: string) {
  try {
    const secret = gateSecret()
    if (!token || !secret) return false
    const [fingerprint, expiresAtRaw, signature] = token.split(".")
    if (!fingerprint || !expiresAtRaw || !signature) return false
    if (fingerprint !== await principalFingerprint(secret, principal)) return false
    const expiresAt = Number(expiresAtRaw)
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false
    const expected = await hmacHex(secret, `${fingerprint}.${expiresAtRaw}`, 24)
    if (!expected) return false
    return timingSafeEqualHex(signature, expected)
  } catch {
    return false
  }
}

export function adminGateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: ADMIN_GATE_TTL_SEC,
    path: "/",
  }
}
