import { runtimeEnv } from "@/lib/runtime-env"

export function defaultAdminEmails(): Set<string> {
  const raw = runtimeEnv("DEFAULT_ADMIN_EMAILS") ?? ""
  return new Set(
    raw.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
  )
}

export function isDefaultAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return defaultAdminEmails().has(email.trim().toLowerCase())
}
