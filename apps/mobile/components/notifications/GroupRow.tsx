import { useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { ChevronDown, ChevronUp } from "lucide-react-native"

import { kindIcon, kindTile } from "@/components/notifications/kindVisual"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { timeLabel, type AppNotification } from "@/lib/notifications"
import { useT } from "@/lib/i18n"

/**
 * Several reminders of one kind on one day (lib/notifications/grouping.ts) as one card: the kind's title, how many,
 * the newest text and an orange dot when any is unread. A tap opens the group in place (the single rows, each
 * still swipeable); a second tap closes it. `renderRow` draws one single row so the group never copies the row.
 */
export function GroupRow({
  p,
  items,
  now,
  unreadIds,
  renderRow,
}: {
  p: AmProto
  items: readonly AppNotification[]
  now: number
  unreadIds: ReadonlySet<string>
  renderRow: (item: AppNotification) => ReactNode
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const newest = items[0]
  if (!newest) return null
  const Icon = kindIcon(newest.kind)
  const tint = kindTile(p, newest.kind)
  const unread = items.filter((n) => unreadIds.has(n.id)).length
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <View style={[s.card, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <TodayPress
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t(open ? "notif.inbox.group.a11yOpen" : "notif.inbox.group.a11yClosed", { title: newest.title, count: items.length })}
        onPress={() => setOpen((v) => !v)}
        pressedScale={0.98}
        style={s.head}
      >
        <View style={[s.tile, { backgroundColor: tint.bg }]}>
          <Icon size={22} color={tint.fg} strokeWidth={1.9} />
        </View>
        <View style={s.text}>
          <View style={s.titleRow}>
            <Text style={[s.title, { color: p.ink800 }]} numberOfLines={1}>
              {newest.title}
            </Text>
            <Text style={[s.time, { color: p.ink500 }]}>{timeLabel(newest.firedAt, now)}</Text>
            {unread > 0 ? <View style={[s.dot, { backgroundColor: p.orange500 }]} /> : null}
          </View>
          <Text style={[s.body, { color: p.ink500 }]} numberOfLines={1}>
            {t("notif.inbox.group.count", { count: items.length })}
            {" · "}
            {newest.text}
          </Text>
        </View>
        <Chevron size={20} color={p.ink500} strokeWidth={1.9} />
      </TodayPress>
      {open ? <View style={s.children}>{items.map((item) => renderRow(item))}</View> : null}
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  head: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 14 },
  tile: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, minWidth: 0, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  time: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  children: { gap: 8, padding: 8, paddingTop: 0 },
})
