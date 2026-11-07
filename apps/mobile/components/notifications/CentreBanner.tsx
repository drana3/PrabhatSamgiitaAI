import { StyleSheet, Text, View } from "react-native"
import { AlertTriangle, BellOff, BellRing } from "lucide-react-native"

import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { useT } from "@/lib/i18n"

export type BannerKind = "denied" | "undetermined" | "failed"

/**
 * The strip above the list when reminders cannot reach the person: the system switch is off (`denied`:
 * the button opens system settings), the OS was never asked (`undetermined`: the button asks), or the phone
 * refused some of the reminders the app tried to schedule (`failed`: the button tries again). One at a time,
 * the most blocking first. Soft corners (20) like the cards of the song page.
 */
export function CentreBanner({ p, kind, onPress }: { p: AmProto; kind: BannerKind; onPress: () => void }) {
  const t = useT()
  const Icon = kind === "denied" ? BellOff : kind === "failed" ? AlertTriangle : BellRing
  const title = t(`notif.banner.${kind === "undetermined" ? "ask" : kind}.title`)
  const body = t(`notif.banner.${kind === "undetermined" ? "ask" : kind}.body`)
  const action = kind === "denied" ? t("notif.permission.openSettings") : kind === "failed" ? t("common.tryAgain") : t("notif.permission.ask.title")
  return (
    <View style={[s.card, { backgroundColor: p.orange100, borderColor: p.orange700 }]} accessibilityRole="alert">
      <View style={s.head}>
        <View style={[s.icon, { backgroundColor: p.white }]}>
          <Icon size={20} color={p.orange700} strokeWidth={1.9} />
        </View>
        <View style={s.text}>
          <Text style={[s.title, { color: p.ink800 }]}>{title}</Text>
          <Text style={[s.body, { color: p.ink800 }]}>{body}</Text>
        </View>
      </View>
      <TodayPress accessibilityRole="button" accessibilityLabel={action} onPress={onPress} pressedScale={0.97} style={[s.button, { backgroundColor: p.action }]}>
        <Text style={[s.buttonText, { color: p.onAction }]}>{action}</Text>
      </TodayPress>
    </View>
  )
}

const s = StyleSheet.create({
  card: { marginHorizontal: 10, borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  button: { minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 20 },
  buttonText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
})
