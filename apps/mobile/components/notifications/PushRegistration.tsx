import { useEffect } from "react"

import { getActiveLanguage } from "@/lib/i18n/core"
import { pushController, pushPlatform, pushSupported } from "@/lib/push"
import { useAuthStore } from "@/stores/authStore"
import { useNotificationSettingsStore } from "@/stores/notificationSettingsStore"

/**
 * Registers this phone for push about replies to the member's comments, and takes it off again (docs/comment-replies.md,
 * "Push"). It draws nothing and does nothing unless the build has push on (`EXPO_PUBLIC_PUSH_ENABLED`) on a real phone.
 * The phone should be woken when the member is signed in, the notification switch is on and the OS permission is
 * granted; any change of those three, or of the member or the language, reconciles with the server.
 */
export function PushRegistration() {
  const signedIn = useAuthStore((s) => s.mode === "signed_in")
  const memberId = useAuthStore((s) => s.memberId)
  const master = useNotificationSettingsStore((s) => s.master)
  const permission = useNotificationSettingsStore((s) => s.permission)
  const language = getActiveLanguage()

  useEffect(() => {
    if (!pushSupported()) return
    const should = signedIn && master && permission === "granted"
    void pushController().reconcile(should, { memberId, language, platform: pushPlatform() })
  }, [signedIn, memberId, master, permission, language])
  return null
}
