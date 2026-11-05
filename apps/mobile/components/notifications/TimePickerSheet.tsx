import { useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Minus } from "lucide-react-native"

import { TimeWheel, WHEEL_HEIGHT, WHEEL_ITEM } from "@/components/notifications/TimeWheel"
import { Sheet } from "@/components/player-v2/Sheet"
import { TodayPress } from "@/components/today/TodayPress"
import type { AmTheme } from "@/constants/tokens/amColors"
import type { AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { everyDayAt, formatMinutes, fromParts12, hasTime, timeParts, toMinutes } from "@/lib/notifications/settings"

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1))
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
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
  hour12: boolean
  onCancel: () => void
  onDone: (minutes: number) => void
}

/**
 * The time picker, as a bottom sheet: an hour wheel and a minute wheel (any minute, 0 to 59), AM and PM
 * on a 12-hour clock, a live line saying what will happen ("Every day at 7:45 AM"), Cancel and Done.
 * Nothing is saved until Done. Dragging the sheet down, or tapping outside it, is Cancel.
 */
export function TimePickerSheet({ visible, target, theme, p, hour12, onCancel, onDone }: Props) {
  // keep the last target while the sheet slides away, so its content does not change mid-flight
  const last = useRef<PickerTarget | null>(null)
  if (target) last.current = target
  const current = target ?? last.current
  return (
    <Sheet visible={visible} onClose={onCancel} title={current?.title ?? ""} theme={theme} hideDone>
      {current ? <PickerBody key={current.key} p={p} hour12={hour12} target={current} onCancel={onCancel} onDone={onDone} /> : null}
    </Sheet>
  )
}

function PickerBody({
  p,
  hour12,
  target,
  onCancel,
  onDone,
}: {
  p: AmProto
  hour12: boolean
  target: PickerTarget
  onCancel: () => void
  onDone: (minutes: number) => void
}) {
  const [minutes, setMinutes] = useState(target.minutes)
  const parts = timeParts(minutes)
  const taken = hasTime(target.others, minutes)

  const setHourIndex = (i: number) => setMinutes(hour12 ? fromParts12(i + 1, parts.minute, parts.pm) : toMinutes(i, parts.minute))
  const setMinute = (i: number) => setMinutes(toMinutes(parts.hour24, i))
  const setPm = (pm: boolean) => setMinutes(fromParts12(parts.hour12, parts.minute, pm))

  return (
    <View>
      <Text style={[s.preview, { color: p.ink800 }]} accessibilityRole="header" accessibilityLiveRegion="polite">
        {everyDayAt(minutes, hour12)}
      </Text>

      <View style={[s.wheels, { backgroundColor: p.white, borderColor: p.sand300 }]}>
        <View pointerEvents="none" style={[s.band, { backgroundColor: p.sand300 }]} />
        <TimeWheel
          p={p}
          label="Hour"
          labels={hour12 ? HOURS_12 : HOURS_24}
          index={hour12 ? parts.hour12 - 1 : parts.hour24}
          onIndex={setHourIndex}
          width={88}
        />
        <Text style={[s.colon, { color: p.ink800 }]} accessibilityElementsHidden importantForAccessibility="no">
          :
        </Text>
        <TimeWheel p={p} label="Minute" labels={MINUTES} index={parts.minute} onIndex={setMinute} width={88} />
        {hour12 ? (
          <View style={s.ampm}>
            {(["AM", "PM"] as const).map((label) => {
              const on = (label === "PM") === parts.pm
              return (
                <TodayPress
                  key={label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  onPress={() => setPm(label === "PM")}
                  pressedScale={0.95}
                  style={[s.ampmChip, on ? { backgroundColor: p.action, borderColor: p.action } : { backgroundColor: p.white, borderColor: p.sand300 }]}
                >
                  <Text style={[s.ampmText, { color: on ? p.onAction : p.ink800 }]}>{label}</Text>
                </TodayPress>
              )
            })}
          </View>
        ) : null}
      </View>

      {taken ? (
        <Text style={[s.warn, { color: p.dangerText }]} accessibilityLiveRegion="polite">
          {`${formatMinutes(minutes, hour12)} is already one of your times.`}
        </Text>
      ) : null}

      {target.onRemove ? (
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel="Remove this time"
          onPress={target.onRemove}
          pressedScale={0.97}
          style={[s.remove, { borderColor: p.sand300, backgroundColor: p.white }]}
        >
          <Minus size={18} color={p.ink800} strokeWidth={2} />
          <Text style={[s.removeText, { color: p.ink800 }]}>Remove this time</Text>
        </TodayPress>
      ) : null}

      <View style={s.buttons}>
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          pressedScale={0.98}
          style={[s.button, { backgroundColor: p.white, borderColor: p.sand300, borderWidth: 1 }]}
        >
          <Text style={[s.buttonText, { color: p.ink800 }]}>Cancel</Text>
        </TodayPress>
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel="Done"
          accessibilityState={{ disabled: taken }}
          disabled={taken}
          onPress={() => onDone(minutes)}
          pressedScale={0.98}
          style={[s.button, { backgroundColor: p.action, opacity: taken ? 0.45 : 1 }]}
        >
          <Text style={[s.buttonText, { color: p.onAction }]}>Done</Text>
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
  wheels: {
    marginHorizontal: 10,
    height: WHEEL_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  band: { position: "absolute", left: 10, right: 10, top: (WHEEL_HEIGHT - WHEEL_ITEM) / 2, height: WHEEL_ITEM, borderRadius: 14, opacity: 0.7 },
  colon: { fontFamily: amFonts.semi, fontSize: 30, lineHeight: 36, marginBottom: 4 },
  ampm: { gap: 8, marginLeft: 12 },
  ampmChip: { width: 64, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ampmText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  warn: { paddingHorizontal: 20, paddingTop: 12, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  remove: {
    marginHorizontal: 20,
    marginTop: 16,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  removeText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  buttons: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  button: { flex: 1, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
