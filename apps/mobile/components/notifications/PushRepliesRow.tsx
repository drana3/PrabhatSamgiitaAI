import { useCallback, useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Toggle } from "@/components/notifications/Toggle"
import { Group, SheetTitle } from "@/components/profile-v2/SheetBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { useT } from "@/lib/i18n"
import { remoteConfig } from "@/lib/kirtan/api"
import { pushSupported } from "@/lib/push"
import { getPreferences, setRepliesPreference } from "@/lib/push/remote"
import { useAuthStore } from "@/stores/authStore"

/**
 * "Replies to my comments" in the notification settings: the switch the server keeps (`replies`, on by default). Shown
 * only in a build with push on, to a signed-in member. It saves at once; if the server cannot be reached the switch
 * goes back and says so.
 */
export function PushRepliesRow({ p }: { p: AmProto }) {
  const t = useT()
  const signedIn = useAuthStore((s) => s.mode === "signed_in")
  const [on, setOn] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)
  const visible = pushSupported() && signedIn

  useEffect(() => {
    if (!visible) return
    let active = true
    getPreferences(remoteConfig())
      .then((prefs) => active && setOn(prefs.replies))
      .catch(() => active && setOn(true))
    return () => {
      active = false
    }
  }, [visible])

  const change = useCallback(
    async (next: boolean) => {
      const before = on
      setOn(next)
      setFailed(false)
      try {
        await setRepliesPreference(remoteConfig(), next)
      } catch {
        setOn(before)
        setFailed(true)
      }
    },
    [on],
  )

  if (!visible || on === null) return null
  return (
    <View>
      <SheetTitle p={p} label={t("push.section")} />
      <Group p={p}>
        <TodayPress
          accessibilityRole="switch"
          accessibilityLabel={t("push.replies")}
          accessibilityHint={t("push.replies.sub")}
          accessibilityState={{ checked: on }}
          onPress={() => void change(!on)}
          pressedScale={0.98}
          style={s.row}
        >
          <View style={s.text}>
            <Text style={[s.label, { color: p.ink800 }]}>{t("push.replies")}</Text>
            <Text style={[s.sub, { color: failed ? p.orange700 : p.ink500 }]}>{failed ? t("push.failed") : t("push.replies.sub")}</Text>
          </View>
          <Toggle p={p} on={on} />
        </TodayPress>
      </Group>
    </View>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 64, paddingVertical: 10, paddingLeft: 20, paddingRight: 16 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  sub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
})
