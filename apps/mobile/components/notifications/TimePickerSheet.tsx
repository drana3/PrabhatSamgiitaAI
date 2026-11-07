import { useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Minus } from "lucide-react-native"

import { TimeWheel, WHEEL_HEIGHT, WHEEL_ITEM } from "@/components/notifications/TimeWheel"
import { Sheet } from "@/components/player-v2/Sheet"
import { TodayPress } from "@/components/today/TodayPress"
import type { AmTheme } from "@/constants/tokens/amColors"
import type { AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { everyDayAt, formatMinutes, hasTime, timeParts, toMinutes } from "@/lib/notifications/settings"
import { useT } from "@/lib/i18n"

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
/** the two accent lines sit on the top and bottom edge of the middle row */
const LINE_TOP = (WHEEL_HEIGHT - WHEEL_ITEM) / 2
const LINE_BOTTOM = LINE_TOP + WHEEL_ITEM - 2
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

export type PickerTarget = {
  /** changes with every opening ("song:2" or "words:new"): a fresh picker starts from `minutes` */
  key: string
  /** "Song of the day" */
  title: string
  /** the time the wheels start on */
  minutes: number
  /** the other times of this kind (a time already there cannot be chosen again) */
  others: readonly number[]
  /** an existing time that can be removed, or null when adding a new one */
  onRemove: (() => void) | null
}

type Props = {
  visible: boolean
  target: PickerTarget | null
  theme: AmTheme
  p: AmProto
  onCancel: () => void
  onDone: (minutes: number) => void
}

/**
 * The time picker, as a bottom sheet: an hour wheel (00 to 23) and a minute wheel (any minute, 00 to 59)
 * on a 24-hour clock, a live line saying what will happen ("Every day at 07:45"), Cancel and Done. The
 * chosen row is marked by a pair of thin accent lines and accent text, with no frame around the wheels.
 * Nothing is saved until Done. Dragging the sheet down, or tapping outside it, is Cancel.
 */
export function TimePickerSheet({ visible, target, theme, p, onCancel, onDone }: Props) {
  // keep the last target while the sheet slides away, so its content does not change mid-flight
  const last = useRef<PickerTarget | null>(null)
  if (target) last.current = target
  const current = target ?? last.current
  return (
    <Sheet visible={visible} onClose={onCancel} title={current?.title ?? ""} theme={theme} hideDone>
      {current ? <PickerBody key={current.key} p={p} target={current} onCancel={onCancel} onDone={onDone} /> : null}
    </Sheet>
  )
}

function PickerBody({
  p,
  target,
  onCancel,
  onDone,
}: {
  p: AmProto
  target: PickerTarget
  onCancel: () => void
  onDone: (minutes: number) => void
}) {
  const t = useT()
  const [minutes, setMinutes] = useState(target.minutes)
  const parts = timeParts(minutes)
  const taken = hasTime(target.others, minutes)

  const setHourIndex = (i: number) => setMinutes(toMinutes(i, parts.minute))
  const setMinute = (i: number) => setMinutes(toMinutes(parts.hour24, i))

  return (
    <View>
      <Text style={[s.preview, { color: p.ink800 }]} accessibilityRole="header" accessibilityLiveRegion="polite">
        {everyDayAt(minutes)}
      </Text>

      <View style={s.wheels}>
        <View style={s.face}>
          <View pointerEvents="none" style={[s.line, { top: LINE_TOP, backgroundColor: p.action }]} />
          <View pointerEvents="none" style={[s.line, { top: LINE_BOTTOM, backgroundColor: p.action }]} />
          <TimeWheel p={p} label={t("notif.picker.hour")} labels={HOURS} index={parts.hour24} onIndex={setHourIndex} width={96} />
          <Text style={[s.colon, { color: p.orange700 }]} accessibilityElementsHidden importantForAccessibility="no">
            :
          </Text>
          <TimeWheel p={p} label={t("notif.picker.minute")} labels={MINUTES} index={parts.minute} onIndex={setMinute} width={96} />
        </View>
      </View>

      {taken ? (
        <Text style={[s.warn, { color: p.dangerText }]} accessibilityLiveRegion="polite">
          {t("notif.picker.taken", { time: formatMinutes(minutes) })}
        </Text>
      ) : null}

      {target.onRemove ? (
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel={t("notif.picker.remove")}
          onPress={target.onRemove}
          pressedScale={0.97}
          style={[s.remove, { borderColor: p.sand300, backgroundColor: p.white }]}
        >
          <Minus size={18} color={p.ink800} strokeWidth={2} />
          <Text style={[s.removeText, { color: p.ink800 }]}>{t("notif.picker.remove")}</Text>
        </TodayPress>
      ) : null}

      <View style={s.buttons}>
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={onCancel}
          pressedScale={0.98}
          style={[s.button, { backgroundColor: p.white, borderColor: p.sand300, borderWidth: 1 }]}
        >
          <Text style={[s.buttonText, { color: p.ink800 }]}>{t("common.cancel")}</Text>
        </TodayPress>
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel={t("common.done")}
          accessibilityState={{ disabled: taken }}
          disabled={taken}
          onPress={() => onDone(minutes)}
          pressedScale={0.98}
          style={[s.button, { backgroundColor: p.action, opacity: taken ? 0.45 : 1 }]}
        >
          <Text style={[s.buttonText, { color: p.onAction }]}>{t("common.done")}</Text>
        </TodayPress>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  preview: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    fontFamily: amFonts.display,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -0.56,
    textTransform: "uppercase",
  },
  wheels: { height: WHEEL_HEIGHT, alignItems: "center", justifyContent: "center" },
  face: { height: WHEEL_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12 },
  line: { position: "absolute", left: 0, right: 0, height: 2, borderRadius: 1 },
  colon: { fontFamily: amFonts.semi, fontSize: 32, lineHeight: 38, marginBottom: 4 },
  warn: { paddingHorizontal: 20, paddingTop: 12, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  remove: {
    marginHorizontal: 20,
    marginTop: 16,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  removeText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  buttons: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  button: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
