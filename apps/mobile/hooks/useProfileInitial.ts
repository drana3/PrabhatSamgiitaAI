import { memberProfileName } from "@/lib/displayName"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { initialOf } from "@/lib/profile/validate"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"

/**
 * The letter on the round profile button (every header avatar). The name saved on Edit profile wins;
 * else the account name; the preview shows the prototype's "D".
 */
export function useProfileInitial(): string {
  const mode = useAuthStore((s) => s.mode)
  const displayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const displayNameOverridden = useAuthStore((s) => s.displayNameOverridden)
  const savedName = useProfileStore((s) => s.name)
  if (savedName) return initialOf(savedName)
  if (MOCKUP_DATA) return "D"
  return memberProfileName({ mode, email, displayName, displayNameOverridden }).trim().charAt(0).toUpperCase() || "·"
}
