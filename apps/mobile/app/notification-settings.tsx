import { useEffect, type ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BellOff, BellRing, ChevronLeft } from "lucide-react-native"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { Toggle } from "@/components/notifications/Toggle"
import { Chip, Group, SheetNote, SheetTitle } from "@/components/profile-v2/SheetBlocks"
import { Reveal } from "@/components/today/motion"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { nativeNotificationsAvailable, openSystemSettings } from "@/lib/notifications/native"
import { ensurePermission, refreshPermission } from "@/lib/notifications/permission"
import {
  MAX_PER_DAY,
  QUIET_FROM_TIMES,
  QUIET_TO_TIMES,
  SONG_TIMES,
  WORDS_TIMES,
  formatMinutes,
  type TimedKind,
  type ToggleKind,
} from "@/lib/notifications/settings"
import { useNotificationSettingsStore, type PermissionState } from "@/stores/notificationSettingsStore"
import { href } from "@/utils/href"

/* ------------------------------------------------------------------ rows */

/** A whole row is the switch: label, one line of what it does, the switch on the right. */
function ToggleRow({
  p,
  label,
  sub,
  on,
  disabled,
  onChange,
  last,
}: {
  p: AmProto
  label: string
  sub: string
  on: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
  last?: boolean
}) {
  return (
    <TodayPress
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={sub}
      accessibilityState={{ checked: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!on)}
      pressedScale={0.98}
      style={[s.row, { borderBottomWidth: last ? 0 : 1, borderBottomColor: p.sand300 }]}
    >
      <View style={s.rowText}>
        <Text style={[s.rowLabel, { color: p.ink800 }]}>{label}</Text>
        <Text style={[s.rowSub, { color: p.ink500 }]}>{sub}</Text>
      </View>
      <Toggle p={p} on={on} />
    </TodayPress>
  )
}

/** A row of time choices (30-minute or hourly steps) that scrolls sideways. */
function TimeRow({
  p,
  label,
  options,
  value,
  onPick,
  last,
}: {
  p: AmProto
  label: string
  options: readonly number[]
  value: number
  onPick: (minutes: number) => void
  last?: boolean
}) {
  return (
    <View style={[s.timeRow, { borderBottomWidth: last ? 0 : 1, borderBottomColor: p.sand300 }]}>
      <Text style={[s.timeLabel, { color: p.ink500 }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {options.map((minutes) => (
          <Chip key={minutes} p={p} label={formatMinutes(minutes)} on={value === minutes} onPress={() => onPick(minutes)} />
        ))}
      </ScrollView>
    </View>
  )
}

/** The permission card: asks once, or explains that the system switch is off and how to reach it. */
function PermissionCard({ p, state, onAllow }: { p: AmProto; state: "undetermined" | "denied"; onAllow: () => void }) {
  const denied = state === "denied"
  const Icon = denied ? BellOff : BellRing
  return (
    <View style={[s.card, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <View style={s.cardHead}>
        <View style={[s.cardIcon, { backgroundColor: p.sand300 }]}>
          <Icon size={22} color={p.ink800} strokeWidth={1.9} />
        </View>
        <View style={s.cardText}>
          <Text style={[s.rowLabel, { color: p.ink800 }]} accessibilityRole="header">
            {denied ? "Notifications are off in system settings" : "Allow notifications"}
          </Text>
          <Text style={[s.rowSub, { color: p.ink500 }]}>
            {denied ? "Turn them on there to get your reminders." : "Your phone asks once. You can change it later."}
          </Text>
        </View>
      </View>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={denied ? "Open settings" : "Allow notifications"}
        onPress={denied ? openSystemSettings : onAllow}
        pressedScale={0.98}
        style={[s.cardButton, { backgroundColor: p.action }]}
      >
        <Text style={[s.cardButtonText, { color: p.onAction }]}>{denied ? "Open settings" : "Allow notifications"}</Text>
      </TodayPress>
    </View>
  )
}

/* ---------------------------------------------------------------- screen */

/**
 * Notification settings (card route, from the bell screen and the profile sheet). A master switch, one
 * switch per kind with a time where it has one, quiet hours, and the daily limit. The OS permission is
 * asked only when the person turns something on; when it is off in system settings the screen says so
 * and offers "Open settings".
 */
export default function NotificationSettingsScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const insets = useSafeAreaInsets()
  const top = insets.top || amProto.statusArea
  const params = useLocalSearchParams<{ permission?: string }>()

  const st = useNotificationSettingsStore()
  const stored: PermissionState = st.permission
  // the preview can show the permission cards: ?permission=denied or ?permission=undetermined
  const preview = MOCKUP_DATA && (params.permission === "denied" || params.permission === "undetermined") ? params.permission : null
  const permission: PermissionState = preview ?? stored
  const showCard = (nativeNotificationsAvailable || preview != null) && (permission === "denied" || permission === "undetermined")

  useEffect(() => {
    void refreshPermission()
  }, [])

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/notifications")))
  /** turning something on is the moment to ask the OS */
  const asking = (on: boolean) => {
    if (on && permission !== "granted") void ensurePermission()
  }
  const kind = (k: ToggleKind) => (on: boolean) => {
    st.setKind(k, on)
    asking(on)
  }
  const time = (k: TimedKind) => (minutes: number) => st.setTime(k, minutes)
  const off = !st.master
  let reveal = 1

  return (
    <View style={[s.root, { backgroundColor: p.sand200, paddingTop: top }]}>
      <View style={s.bar}>
        <TodayPress accessibilityRole="button" accessibilityLabel="Back" onPress={back} pressedScale={0.92} style={[s.back, { backgroundColor: p.white, borderColor: p.sand300 }]}>
          <ChevronLeft size={22} color={p.ink800} strokeWidth={1.9} />
        </TodayPress>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <Reveal index={0}>
          <Text style={s.h1} accessibilityRole="header">
            <Text style={{ color: p.ink800 }}>Notification</Text>
            {"\n"}
            <Text style={{ color: p.ink300 }}>settings</Text>
          </Text>
        </Reveal>

        {showCard ? (
          <Reveal index={reveal++}>
            <PermissionCard p={p} state={permission as "undetermined" | "denied"} onAllow={() => void ensurePermission()} />
          </Reveal>
        ) : null}

        <Reveal index={reveal++}>
          <Group p={p}>
            <ToggleRow
              p={p}
              label="Notifications"
              sub={st.master ? "Reminders are on." : "All reminders are paused."}
              on={st.master}
              onChange={(on) => {
                st.setMaster(on)
                asking(on)
              }}
            />
          </Group>
        </Reveal>

        <Reveal index={reveal++}>
          <View style={off ? s.dim : undefined} pointerEvents={off ? "none" : "auto"}>
          <SheetTitle p={p} label="Reminders" />
          <Group p={p}>
            <ToggleRow p={p} label="Song of the day" sub="Composed on this day, or a daily pick." on={st.song.on} disabled={off} onChange={kind("song")} />
            {st.song.on ? <TimeRow p={p} label="Time" options={SONG_TIMES} value={st.song.at} onPick={time("song")} /> : null}
            <ToggleRow p={p} label="Festivals" sub="The evening before, with its songs." on={st.festival.on} disabled={off} onChange={kind("festival")} />
            <ToggleRow p={p} label="Words to repeat" sub="Only when words are due." on={st.words.on} disabled={off} onChange={kind("words")} />
            {st.words.on ? <TimeRow p={p} label="Time" options={WORDS_TIMES} value={st.words.at} onPick={time("words")} /> : null}
            <ToggleRow p={p} label="Learning streak" sub="When a streak could end today." on={st.streak.on} disabled={off} onChange={kind("streak")} />
            <ToggleRow p={p} label="Live Kiirtans" sub="15 minutes before a broadcast you set a reminder for." on={st.live.on} disabled={off} onChange={kind("live")} />
          </Group>
          </View>
        </Reveal>

        <Reveal index={reveal++}>
          <View style={off ? s.dim : undefined} pointerEvents={off ? "none" : "auto"}>
          <SheetTitle p={p} label="Quiet hours" />
          <Group p={p}>
            <ToggleRow
              p={p}
              label="Quiet hours"
              sub={st.quiet.on ? `Nothing from ${formatMinutes(st.quiet.from)} to ${formatMinutes(st.quiet.to)}.` : "Off."}
              on={st.quiet.on}
              disabled={off}
              onChange={(on) => st.setQuietHours({ on })}
            />
            {st.quiet.on ? <TimeRow p={p} label="From" options={QUIET_FROM_TIMES} value={st.quiet.from} onPick={(from) => st.setQuietHours({ from })} /> : null}
            {st.quiet.on ? <TimeRow p={p} label="To" options={QUIET_TO_TIMES} value={st.quiet.to} onPick={(to) => st.setQuietHours({ to })} /> : null}
          </Group>
          </View>
        </Reveal>

        <Reveal index={reveal++}>
          <Footer>
            <SheetNote p={p}>{`We send at most ${MAX_PER_DAY} a day.`}</SheetNote>
            <SheetNote p={p}>A reminder you set for a live Kiirtan always arrives on time, even in quiet hours.</SheetNote>
          </Footer>
        </Reveal>
      </ScrollView>
    </View>
  )
}

function Footer({ children }: { children: ReactNode }) {
  return <View style={s.footer}>{children}</View>
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: HOME_INSET - 4 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 60, gap: 24 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 43, letterSpacing: -0.9, textTransform: "uppercase", paddingHorizontal: HOME_INSET, paddingTop: 4 },
  dim: { opacity: 0.45 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 64, paddingVertical: 10, paddingLeft: 20, paddingRight: 16 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  rowSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  timeRow: { gap: 8, paddingTop: 2, paddingBottom: 14 },
  timeLabel: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, paddingLeft: 20 },
  chips: { flexDirection: "row", gap: 6, paddingHorizontal: 20 },
  card: { marginHorizontal: 10, borderRadius: 20, borderWidth: 1, padding: 16, gap: 16 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  cardButton: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardButtonText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  footer: { gap: 6, paddingHorizontal: 10 },
})
