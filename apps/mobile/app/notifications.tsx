import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BookOpen, ChevronLeft, Flame, Megaphone, Music, Newspaper, PartyPopper, Radio, Repeat2, X } from "lucide-react-native"

import { HOME_INSET, HomeCover } from "@/components/home/HomeBlocks"
import { Reveal } from "@/components/today/motion"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { todayAssets } from "@/constants/todayAssets"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useNotificationItems } from "@/hooks/useNotificationItems"
import { timeLabel, type AppNotification, type NotificationKind } from "@/lib/notifications"
import { useNotificationsStore } from "@/stores/notificationsStore"
import { href } from "@/utils/href"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useT } from "@/lib/i18n"

const ICONS: Record<Exclude<NotificationKind, "song">, typeof Flame> = {
  festival: PartyPopper,
  words: Repeat2,
  story: BookOpen,
  streak: Flame,
  live: Radio,
  upload: Music,
  announcement: Megaphone,
}

/** Tile colours of the non-song rows; the glyph always has contrast on its tile. */
function tile(p: AmProto, kind: NotificationKind): { bg: string; fg: string } {
  switch (kind) {
    case "festival":
      return { bg: p.gold300, fg: "#1E1E1E" }
    case "words":
      return { bg: p.action, fg: "#FFFFFF" }
    case "story":
      return { bg: p.sage700, fg: "#FFFFFF" }
    case "live":
      return { bg: p.sage800, fg: "#FFFFFF" }
    case "upload":
    case "announcement":
      return { bg: p.sand300, fg: p.ink800 }
    default:
      return { bg: p.dark ? p.sage800 : p.sage900, fg: p.gold300 }
  }
}

function Row({
  p,
  item,
  now,
  unread,
  onPress,
  onDelete,
}: {
  p: AmProto
  item: AppNotification
  now: number
  unread: boolean
  onPress: () => void
  onDelete: () => void
}) {
  const t = useT()
  const Icon = item.kind === "song" ? Newspaper : ICONS[item.kind]
  const tint = tile(p, item.kind)
  const time = timeLabel(item.firedAt, now)
  return (
    <View
      style={[s.row, { backgroundColor: p.white, borderColor: p.sand300 }]}
      accessibilityActions={[{ name: "delete", label: t("common.delete") }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === "delete" && onDelete()}
    >
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={t(unread ? "notif.inbox.row.unreadA11y" : "notif.inbox.row.a11y", { title: item.title, text: item.text, time })}
        onPress={onPress}
        pressedScale={0.98}
        style={s.main}
      >
        {item.kind === "song" && item.coverNumber != null ? (
          <HomeCover number={item.coverNumber} size={48} radius={12} />
        ) : (
          <View style={[s.tile, { backgroundColor: tint.bg }]}>
            <Icon size={22} color={tint.fg} strokeWidth={1.9} />
          </View>
        )}
        <View style={s.text}>
          <View style={s.titleRow}>
            <Text style={[s.title, { color: p.ink800 }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[s.time, { color: p.ink500 }]}>{time}</Text>
            {unread ? <View style={[s.dot, { backgroundColor: p.orange500 }]} /> : null}
          </View>
          <Text style={[s.body, { color: p.ink500 }]} numberOfLines={2}>
            {item.text}
          </Text>
        </View>
      </TodayPress>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={t("notif.inbox.delete.a11y", { title: item.title })}
        onPress={onDelete}
        pressedScale={0.9}
        style={s.delete}
      >
        <X size={18} color={p.ink500} strokeWidth={1.9} />
      </TodayPress>
    </View>
  )
}

/**
 * Notifications (opened from the bell on Home). What has fired, "Today" and "Earlier"; an orange dot on
 * what is unread, a tap opens the target and marks it read, an X deletes a row, "Mark all read" clears
 * the dots and "Settings" chooses what is sent. Items older than 30 days are gone.
 */
export default function NotificationsScreen() {
  const bottomInset = useScrollBottomInset()
  const router = useRouter()
  const t = useT()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const insets = useSafeAreaInsets()
  const top = insets.top || amProto.statusArea
  const { items, read, unread, sections, now } = useNotificationItems()
  const open = useNotificationsStore((st) => st.open)
  const markAll = useNotificationsStore((st) => st.markAll)
  const remove = useNotificationsStore((st) => st.remove)
  const done = new Set(read)

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/today")))
  let reveal = 1

  return (
    <View style={[s.root, { backgroundColor: p.sand200, paddingTop: top }]}>
      <View style={s.bar}>
        <TodayPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={back} pressedScale={0.92} style={[s.back, { backgroundColor: p.white, borderColor: p.sand300 }]}>
          <ChevronLeft size={22} color={p.ink800} strokeWidth={1.9} />
        </TodayPress>
        <View style={s.barRight}>
          {unread > 0 ? (
            <TodayPress accessibilityRole="button" accessibilityLabel={t("notif.inbox.markAll")} onPress={() => markAll(items)} pressedScale={0.95} style={s.barText}>
              <Text style={[s.markText, { color: p.orange700 }]}>{t("notif.inbox.markAll")}</Text>
            </TodayPress>
          ) : null}
          <TodayPress accessibilityRole="button" accessibilityLabel={t("common.settings")} onPress={() => router.push(href("/notification-settings"))} pressedScale={0.95} style={s.barText}>
            <Text style={[s.markText, { color: p.orange700 }]}>{t("common.settings")}</Text>
          </TodayPress>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0}>
          <Text style={s.h1} accessibilityRole="header">
            <Text style={{ color: p.ink800 }}>{t("profile.notifications")}</Text>
            {"\n"}
            <Text style={{ color: p.ink300 }}>{items.length === 0 ? t("notif.inbox.none") : unread > 0 ? t("notif.inbox.new", { count: unread }) : t("notif.inbox.allRead")}</Text>
          </Text>
        </Reveal>

        {sections.length === 0 ? (
          <Reveal index={1} style={s.empty}>
            <Image source={todayAssets.logo} style={s.emptyLogo} contentFit="contain" accessibilityIgnoresInvertColors />
            <Text style={[s.emptyTitle, { color: p.ink800 }]}>{t("notif.inbox.empty.title")}</Text>
            <Text style={[s.emptyText, { color: p.ink500 }]}>{t("notif.inbox.empty.text")}</Text>
          </Reveal>
        ) : (
          sections.map((section) => (
            <Reveal key={section.id} index={Math.min(reveal++, 6)} style={s.section}>
              <Text style={[overStyle, { color: p.orange700, paddingHorizontal: HOME_INSET }]}>{section.label}</Text>
              <View style={s.list}>
                {section.items.map((item) => (
                  <Row
                    key={item.id}
                    p={p}
                    item={item}
                    now={now}
                    unread={!done.has(item.id)}
                    onPress={() => {
                      open(item.id)
                      router.push(href(item.target))
                    }}
                    onDelete={() => remove(item)}
                  />
                ))}
              </View>
            </Reveal>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: HOME_INSET - 4 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  barRight: { flexDirection: "row", alignItems: "center" },
  barText: { height: 44, paddingHorizontal: 12, justifyContent: "center" },
  markText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  content: { paddingBottom: 60, gap: 28 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 43, letterSpacing: -0.9, textTransform: "uppercase", paddingHorizontal: HOME_INSET, paddingTop: 4 },
  section: { gap: 12 },
  list: { paddingHorizontal: 10, gap: 8 },
  row: { minHeight: 76, borderRadius: 22, borderWidth: 1, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  main: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 14 },
  delete: { width: 44, height: 44, marginRight: 4, alignItems: "center", justifyContent: "center" },
  tile: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, minWidth: 0, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  time: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { alignItems: "center", gap: 10, paddingTop: 60, paddingHorizontal: 40 },
  emptyLogo: { width: 72, height: 86 },
  emptyTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, textTransform: "uppercase", letterSpacing: -0.5, textAlign: "center" },
  emptyText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, textAlign: "center" },
})
