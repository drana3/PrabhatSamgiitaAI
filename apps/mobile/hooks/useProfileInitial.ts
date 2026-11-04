import { memberProfileName } from "@/lib/displayName"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"

/** The letter on the round profile button (same rule as the Songs screen). */
export function useProfileInitial(): string {
  const mode = useAuthStore((s) => s.mode)
  const displayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const displayNameOverridden = useAuthStore((s) => s.displayNameOverridden)
  if (MOCKUP_DATA) return "D"
  return memberProfileName({ mode, email, displayName, displayNameOverridden }).trim().charAt(0).toUpperCase() || "·"
}
