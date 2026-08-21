import { createHmac, timingSafeEqual } from "crypto"

import { runtimeEnv } from "@/lib/runtime-env"

export const ADMIN_GATE_COOKIE = "psa_admin_gate"
const ADMIN_GATE_TTL_SEC = 300

function gateSecret() {
  return runtimeEnv("MEMBER_PROXY_KEY") ?? ""
}

function principalFingerprint(principal: string) {
  return createHmac("sha256", gateSecret()).update(principal).digest("hex").slice(0, 16)
}

export function buildAdminGateToken(
  principal: string,
  nowSec = Math.floor(Date.now() / 1000),
) {
  const fingerprint = principalFingerprint(principal)
  const expiresAt = nowSec + ADMIN_GATE_TTL_SEC
  const payload = `${fingerprint}.${expiresAt}`
  const signature = createHmac("sha256", gateSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 24)
  return `${payload}.${signature}`
}

export function verifyAdminGateToken(token: string | undefined, principal: string) {
  if (!token || !gateSecret()) return false
  const [fingerprint, expiresAtRaw, signature] = token.split(".")
  if (!fingerprint || !expiresAtRaw || !signature) return false
  if (fingerprint !== principalFingerprint(principal)) return false
  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false
  const payload = `${fingerprint}.${expiresAtRaw}`
  const expected = createHmac("sha256", gateSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 24)
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
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
