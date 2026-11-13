import { Modal, Pressable, StyleSheet, Text, View } from "react-native"

import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { useT } from "@/lib/i18n"

/**
 * A confirm card that works the same on the phone and in the web preview (Alert.alert does nothing on the web).
 * Two round buttons, the destructive one filled. A tap outside, or the back button, cancels.
 */
export function ConfirmDialog({
  p,
  visible,
  title,
  body,
  note,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  p: AmProto
  visible: boolean
  title: string
  body: string
  /** a second line, for what stays */
  note?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useT()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={s.scrim}>
        {/* the dim area is a sibling of the card, not its parent: a button inside a button is not valid on the web */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={t("common.cancel")} accessibilityRole="button" />
        <View style={[s.card, { backgroundColor: p.white, borderColor: p.sand300 }]} accessibilityViewIsModal>
          <Text style={[s.title, { color: p.ink800 }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[s.body, { color: p.ink500 }]}>{body}</Text>
          {note ? <Text style={[s.body, { color: p.ink500 }]}>{note}</Text> : null}
          <View style={s.buttons}>
            <TodayPress accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onCancel} pressedScale={0.97} style={[s.button, { backgroundColor: p.sand300 }]}>
              <Text style={[s.buttonText, { color: p.ink800 }]}>{t("common.cancel")}</Text>
            </TodayPress>
            <TodayPress accessibilityRole="button" accessibilityLabel={confirmLabel} onPress={onConfirm} pressedScale={0.97} style={[s.button, { backgroundColor: p.dangerText }]}>
              <Text style={[s.buttonText, { color: "#FFFFFF" }]}>{confirmLabel}</Text>
            </TodayPress>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(30,30,30,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 360, borderRadius: 24, borderWidth: 1, padding: 24, gap: 10 },
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, textTransform: "uppercase", letterSpacing: -0.5 },
  body: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  buttons: { flexDirection: "row", gap: 8, paddingTop: 12 },
  button: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
