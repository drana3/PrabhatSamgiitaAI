import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BookOpen, ChevronLeft, Flame, Newspaper, PartyPopper, Repeat2 } from "lucide-react-native"

import { HOME_INSET, HomeCover } from "@/components/home/HomeBlocks"
import { Reveal } from "@/components/today/motion"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { todayAssets } from "@/constants/todayAssets"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useNotificationItems } from "@/hooks/useNotificationItems"
import type { AppNotification, NotificationKind } from "@/lib/notifications"
import { useNotificationsStore } from "@/stores/notificationsStore"
import { href } from "@/utils/href"

const ICONS: Record<Exclude<NotificationKind, "song">, typeof Flame> = {
  festival: PartyPopper,
  words: Repeat2,
  story: BookOpen,
  streak: Flame,
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
    default:
      return { bg: p.dark ? p.sage800 : p.sage900, fg: p.gold300 }
  }
}

function Row({ p, item, unread, onPress }: { p: AmProto; item: AppNotification; unread: boolean; onPress: () => void }) {
  const Icon = item.kind === "song" ? Newspaper : ICONS[item.kind]
  const t = tile(p, item.kind)
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.text}. ${item.time}${unread ? ". Unread" : ""}`}
      onPress={onPress}
      pressedScale={0.98}
      style={[s.row, { backgroundColor: p.white, borderColor: p.sand300 }]}
    >
      {item.kind === "song" && item.coverNumber != null ? (
        <HomeCover number={item.coverNumber} size={48} radius={12} />
      ) : (
        <View style={[s.tile, { backgroundColor: t.bg }]}>
          <Icon size={22} color={t.fg} strokeWidth={1.9} />
        </View>
      )}
      <View style={s.text}>
        <Text style={[s.title, { color: p.ink800 }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[s.body, { color: p.ink500 }]} numberOfLines={1}>
          {item.text}
        </Text>
      </View>
      <View style={s.side}>
        <Text style={[s.time, { color: p.ink500 }]}>{item.time}</Text>
        {unread ? <View style={[s.dot, { backgroundColor: p.orange500 }]} accessibilityLabel="Unread" /> : <View style={s.dotSpace} />}
      </View>
    </TodayPress>
  )
}

/**
 * Notifications (opened from the bell on Home). "Today" and "Earlier", an orange dot on what is
 * unread, a tap opens the target and marks it read, "Mark all read" clears the dots.
 */
export default function NotificationsScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const insets = useSafeAreaInsets()
  const top = insets.top || amProto.statusArea
  const { items, read, unread, sections } = useNotificationItems()
  const open = useNotificationsStore((st) => st.open)
  const markAll = useNotificationsStore((st) => st.markAll)
  const done = new Set(read)

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/today")))
  let reveal = 1

  return (
    <View style={[s.root, { backgroundColor: p.sand200, paddingTop: top }]}>
      <View style={s.bar}>
        <TodayPress accessibilityRole="button" accessibilityLabel="Back" onPress={back} pressedScale={0.92} style={[s.back, { backgroundColor: p.white, borderColor: p.sand300 }]}>
          <ChevronLeft size={22} color={p.ink800} strokeWidth={1.9} />
        </TodayPress>
        {unread > 0 ? (
          <TodayPress accessibilityRole="button" accessibilityLabel="Mark all read" onPress={() => markAll(items)} pressedScale={0.95} style={s.markAll}>
            <Text style={[s.markText, { color: p.orange700 }]}>Mark all read</Text>
          </TodayPress>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <Reveal index={0}>
          <Text style={s.h1} accessibilityRole="header">
            <Text style={{ color: p.ink800 }}>Notifications</Text>
            {"\n"}
            <Text style={{ color: p.ink300 }}>{items.length === 0 ? "None yet" : unread > 0 ? `${unread} new` : "All read"}</Text>
          </Text>
        </Reveal>

        {sections.length === 0 ? (
          <Reveal index={1} style={s.empty}>
            <Image source={todayAssets.logo} style={s.emptyLogo} contentFit="contain" accessibilityIgnoresInvertColors />
            <Text style={[s.emptyTitle, { color: p.ink800 }]}>You are all caught up</Text>
            <Text style={[s.emptyText, { color: p.ink500 }]}>New songs of the day, festivals and words to repeat will show here.</Text>
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
                    unread={!done.has(item.id)}
                    onPress={() => {
                      open(item.id)
                      router.push(href(item.target))
                    }}
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
  markAll: { height: 44, paddingHorizontal: 12, justifyContent: "center" },
  markText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  content: { paddingBottom: 60, gap: 28 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 43, letterSpacing: -0.9, textTransform: "uppercase", paddingHorizontal: HOME_INSET, paddingTop: 4 },
  section: { gap: 12 },
  list: { paddingHorizontal: 10, gap: 8 },
  row: { minHeight: 76, borderRadius: 22, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 14 },
  tile: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  side: { alignItems: "flex-end", gap: 6 },
  time: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotSpace: { width: 10, height: 10 },
  empty: { alignItems: "center", gap: 10, paddingTop: 60, paddingHorizontal: 40 },
  emptyLogo: { width: 72, height: 86 },
  emptyTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, textTransform: "uppercase", letterSpacing: -0.5, textAlign: "center" },
  emptyText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, textAlign: "center" },
})
