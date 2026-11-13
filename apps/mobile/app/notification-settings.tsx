import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { BellOff, BellRing, ChevronLeft, Plus } from "lucide-react-native"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { PushRepliesRow } from "@/components/notifications/PushRepliesRow"
import { Toggle } from "@/components/notifications/Toggle"
import { TimePickerSheet, type PickerTarget } from "@/components/notifications/TimePickerSheet"
import { Group, SheetNote, SheetTitle } from "@/components/profile-v2/SheetBlocks"
import { Reveal } from "@/components/today/motion"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useAmTheme } from "@/hooks/useAmTheme"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { nativeNotificationsAvailable, openSystemSettings } from "@/lib/notifications/native"
import { ensurePermission, refreshPermission } from "@/lib/notifications/permission"
import { FESTIVAL_EVE_AT, MAX_TIMES, STREAK_AT, formatMinutes, suggestTime, type TimedKind, type ToggleKind } from "@/lib/notifications/settings"
import { useNotificationSettingsStore, type PermissionState } from "@/stores/notificationSettingsStore"
import { href } from "@/utils/href"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useT } from "@/lib/i18n"

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

/**
 * A switch row for a reminder that has times of the day: the switch, and under it one chip per time
 * (tap one to change or remove it) and "Add time". Any minute can be chosen, in the picker sheet.
 */
function TimedRow({
  p,
  label,
  sub,
  kind,
  on,
  times,
  disabled,
  onChange,
  onEdit,
  onAdd,
  last,
}: {
  p: AmProto
  label: string
  sub: string
  kind: TimedKind
  on: boolean
  times: readonly number[]
  disabled?: boolean
  onChange: (on: boolean) => void
  onEdit: (index: number) => void
  onAdd: () => void
  last?: boolean
}) {
  const t = useT()
  const max = MAX_TIMES[kind]
  const full = times.length >= max
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: p.sand300 }}>
      <ToggleRow p={p} label={label} sub={sub} on={on} disabled={disabled} onChange={onChange} last />
      {on ? (
        <View style={s.timesBlock}>
          <View style={s.chips}>
            {times.map((minutes, index) => (
              <TodayPress
                key={minutes}
                accessibilityRole="button"
                accessibilityLabel={t("notif.time.a11y", { label, time: formatMinutes(minutes) })}
                accessibilityHint={t("notif.time.hint")}
                disabled={disabled}
                onPress={() => onEdit(index)}
                pressedScale={0.96}
                style={[s.timeChip, { backgroundColor: p.orange100, borderColor: p.orange700 }]}
              >
                <Text style={[s.timeChipText, { color: p.orange700 }]}>{formatMinutes(minutes)}</Text>
              </TodayPress>
            ))}
            <TodayPress
              accessibilityRole="button"
              accessibilityLabel={t("notif.time.add")}
              accessibilityState={{ disabled: full || !!disabled }}
              disabled={full || disabled}
              onPress={onAdd}
              pressedScale={0.96}
              style={[s.timeChip, s.addChip, { borderColor: p.orange700, opacity: full ? 0.45 : 1 }]}
            >
              <Plus size={16} color={p.orange700} strokeWidth={2.2} />
              <Text style={[s.timeChipText, { color: p.orange700 }]}>{t("notif.time.add")}</Text>
            </TodayPress>
          </View>
          {full ? <Text style={[s.limitNote, { color: p.ink500 }]}>{t("notif.time.limit", { count: max })}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

/** The permission card: asks once, or explains that the system switch is off and how to reach it. */
function PermissionCard({ p, state, onAllow }: { p: AmProto; state: "undetermined" | "denied"; onAllow: () => void }) {
  const t = useT()
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
            {denied ? t("notif.permission.denied.title") : t("notif.permission.ask.title")}
          </Text>
          <Text style={[s.rowSub, { color: p.ink500 }]}>
            {denied ? t("notif.permission.denied.body") : t("notif.permission.ask.body")}
          </Text>
        </View>
      </View>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={denied ? t("notif.permission.openSettings") : t("notif.permission.ask.title")}
        onPress={denied ? openSystemSettings : onAllow}
        pressedScale={0.98}
        style={[s.cardButton, { backgroundColor: p.action }]}
      >
        <Text style={[s.cardButtonText, { color: p.onAction }]}>{denied ? t("notif.permission.openSettings") : t("notif.permission.ask.title")}</Text>
      </TodayPress>
    </View>
  )
}

/* ---------------------------------------------------------------- screen */

/**
 * Notification settings (card route, from the bell screen and the profile sheet). A master switch and one
 * switch per kind. Song of the day and Words to repeat carry their own times of the day: any minute, up to
 * 3 and 5 a day, chosen in a bottom sheet with an hour and a minute wheel (24-hour clock). The OS permission is asked
 * only when the person turns something on; when it is off in system settings the screen says so and
 * offers "Open settings".
 */
export default function NotificationSettingsScreen() {
  const bottomInset = useScrollBottomInset()
  const router = useRouter()
  const t = useT()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const top = useScreenTop()
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

  /** the picker: which time of which kind is being changed, or a new one (index null) */
  const [editing, setEditing] = useState<{ kind: TimedKind; index: number | null; opened: number } | null>(null)
  const opened = useRef(0)
  const edit = useCallback((kind: TimedKind, index: number | null) => {
    opened.current += 1
    setEditing({ kind, index, opened: opened.current })
  }, [])
  const closePicker = useCallback(() => setEditing(null), [])

  const target = useMemo<PickerTarget | null>(() => {
    if (!editing) return null
    const { kind, index, opened: n } = editing
    const times = kind === "song" ? st.song.times : st.words.times
    const title = kind === "song" ? t("notif.song") : t("notif.words")
    if (index == null) {
      return { key: `${kind}:new:${n}`, title, minutes: suggestTime(times), others: times, onRemove: null }
    }
    const minutes = times[index]
    if (minutes == null) return null
    return {
      key: `${kind}:${index}:${n}`,
      title,
      minutes,
      others: times.filter((_, i) => i !== index),
      onRemove:
        times.length > 1
          ? () => {
              st.removeTime(kind, index)
              setEditing(null)
            }
          : null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, t])

  const done = (minutes: number) => {
    if (editing) {
      if (editing.index == null) st.addTime(editing.kind, minutes)
      else st.setTime(editing.kind, editing.index, minutes)
    }
    setEditing(null)
  }
  const off = !st.master
  let reveal = 1

  return (
    <View style={[s.root, { backgroundColor: p.sand200, paddingTop: top }]}>
      <View style={s.bar}>
        <TodayPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={back} pressedScale={0.92} style={[s.back, { backgroundColor: p.white, borderColor: p.sand300 }]}>
          <ChevronLeft size={22} color={p.ink800} strokeWidth={1.9} />
        </TodayPress>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0}>
          <Text style={s.h1} accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
            <Text style={{ color: p.ink800 }}>{t("notif.settings.h1a")}</Text>
            {"\n"}
            <Text style={{ color: p.ink300 }}>{t("notif.settings.h1b")}</Text>
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
              label={t("profile.notifications")}
              sub={st.master ? t("notif.master.on") : t("notif.master.off")}
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
          <SheetTitle p={p} label={t("notif.section.reminders")} />
          <Group p={p}>
            <TimedRow
              p={p}
              label={t("notif.song")}
              sub={t("notif.song.sub")}
              kind="song"
              on={st.song.on}
              times={st.song.times}
              disabled={off}
              onChange={kind("song")}
              onEdit={(i) => edit("song", i)}
              onAdd={() => edit("song", null)}
            />
            <ToggleRow p={p} label={t("notif.festivals")} sub={t("notif.festivals.sub")} on={st.festival.on} disabled={off} onChange={kind("festival")} />
            <TimedRow
              p={p}
              label={t("notif.words")}
              sub={t("notif.words.sub")}
              kind="words"
              on={st.words.on}
              times={st.words.times}
              disabled={off}
              onChange={kind("words")}
              onEdit={(i) => edit("words", i)}
              onAdd={() => edit("words", null)}
            />
            <ToggleRow p={p} label={t("notif.streak")} sub={t("notif.streak.sub")} on={st.streak.on} disabled={off} onChange={kind("streak")} />
          </Group>
          </View>
        </Reveal>

        <Reveal index={reveal++}>
          <PushRepliesRow p={p} />
        </Reveal>

        <Reveal index={reveal++}>
          <Footer>
            <SheetNote p={p}>{t("notif.note.times")}</SheetNote>
            <SheetNote p={p}>{t("notif.note.fixed", { festival: formatMinutes(FESTIVAL_EVE_AT), streak: formatMinutes(STREAK_AT) })}</SheetNote>
            <SheetNote p={p}>{t("notif.note.keep")}</SheetNote>
          </Footer>
        </Reveal>
      </ScrollView>

      <TimePickerSheet visible={editing != null} target={target} theme={theme} p={p} onCancel={closePicker} onDone={done} />
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
  timesBlock: { gap: 8, paddingTop: 2, paddingBottom: 16, paddingHorizontal: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  timeChipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  addChip: { backgroundColor: "transparent", borderStyle: "dashed", paddingHorizontal: 14 },
  limitNote: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  card: { marginHorizontal: 10, borderRadius: 20, borderWidth: 1, padding: 16, gap: 16 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  cardButton: { minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardButtonText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  footer: { gap: 6, paddingHorizontal: 10 },
})
