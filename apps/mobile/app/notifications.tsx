import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChevronLeft, X } from "lucide-react-native"

import { HOME_INSET, HomeCover } from "@/components/home/HomeBlocks"
import { CentreBanner, type BannerKind } from "@/components/notifications/CentreBanner"
import { ConfirmDialog } from "@/components/notifications/ConfirmDialog"
import { GroupRow } from "@/components/notifications/GroupRow"
import { kindIcon, kindTile } from "@/components/notifications/kindVisual"
import { SwipeRow } from "@/components/notifications/SwipeRow"
import { UndoBar, type Bar } from "@/components/notifications/UndoBar"
import { Reveal } from "@/components/today/motion"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { todayAssets } from "@/constants/todayAssets"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useNotificationItems } from "@/hooks/useNotificationItems"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { keptByClearAll, timeLabel, unreadIds, type AppNotification } from "@/lib/notifications"
import { rowsOf } from "@/lib/notifications/grouping"
import { nativeNotificationsAvailable, openSystemSettings } from "@/lib/notifications/native"
import { ensurePermission, refreshPermission } from "@/lib/notifications/permission"
import { resolveForOpen } from "@/lib/notifications/sources"
import { useNotificationHealthStore } from "@/stores/notificationHealthStore"
import { useNotificationSettingsStore } from "@/stores/notificationSettingsStore"
import { useNotificationsStore } from "@/stores/notificationsStore"
import { href } from "@/utils/href"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useT } from "@/lib/i18n"

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
  const Icon = kindIcon(item.kind)
  const tint = kindTile(p, item.kind)
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
 * Notifications (opened from the bell on Home). What has fired, in sections: "Needs your attention" (unread
 * notices about your own uploads, whatever their age), "Today", "Earlier". An orange dot on what is unread; a
 * tap opens the target (or the nearest real screen when the target is gone) and marks it read; a swipe to the
 * left or the X deletes a row, with Undo; several reminders of one kind on one day fold into a group;
 * "Mark all read" clears the dots; "Clear all" asks first and keeps unread notices about your uploads;
 * "Settings" chooses what is sent. A banner above the list says when reminders cannot reach you (permission off,
 * or the phone refused to schedule them). How long things stay: docs/notifications.md, "Retention".
 */
export default function NotificationsScreen() {
  const bottomInset = useScrollBottomInset()
  const router = useRouter()
  const t = useT()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const insets = useSafeAreaInsets()
  const top = insets.top || amProto.statusArea
  const params = useLocalSearchParams<{ permission?: string; failed?: string }>()
  const { items, read, unread, sections, now } = useNotificationItems()
  const open = useNotificationsStore((st) => st.open)
  const markAll = useNotificationsStore((st) => st.markAll)
  const remove = useNotificationsStore((st) => st.remove)
  const restore = useNotificationsStore((st) => st.restore)
  const clear = useNotificationsStore((st) => st.clear)
  const stored = useNotificationsStore((st) => st.items)
  const master = useNotificationSettingsStore((st) => st.master)
  const storedPermission = useNotificationSettingsStore((st) => st.permission)
  const scheduleFailed = useNotificationHealthStore((st) => st.scheduleFailed)
  const retry = useNotificationHealthStore((st) => st.retry)
  const unreadSet = new Set(unreadIds(items, read, now))

  const [bar, setBar] = useState<Bar | null>(null)
  const [confirming, setConfirming] = useState(false)
  const dismissBar = useCallback(() => setBar(null), [])
  const say = useCallback((message: string, undo?: { label: string; run: () => void }) => {
    setBar({ key: Date.now(), message, actionLabel: undo?.label, onAction: undo?.run })
  }, [])

  // the system permission as it is now (it may have been changed in system settings since the app was last open)
  useEffect(() => {
    void refreshPermission()
  }, [])

  // the preview can show the banners: ?permission=denied | undetermined, ?failed=1
  const previewPermission = MOCKUP_DATA && (params.permission === "denied" || params.permission === "undetermined") ? params.permission : null
  const permission = previewPermission ?? storedPermission
  const failed = (MOCKUP_DATA && params.failed === "1") || scheduleFailed
  const banner: BannerKind | null =
    !master || (!nativeNotificationsAvailable && !previewPermission && !failed)
      ? null
      : permission === "denied"
        ? "denied"
        : permission === "undetermined"
          ? "undetermined"
          : failed
            ? "failed"
            : null

  // the explanation of a target that is gone waits for the person to come back to this screen: the
  // fallback screen is on top of it right after the tap, and a bar under it would be seen by nobody
  const pendingNote = useRef<string | null>(null)
  useFocusEffect(
    useCallback(() => {
      if (pendingNote.current) {
        say(pendingNote.current)
        pendingNote.current = null
      }
    }, [say]),
  )

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/today")))

  const openItem = (item: AppNotification) => {
    open(item.id)
    void resolveForOpen(item).then((resolved) => {
      if (resolved.missing) pendingNote.current = t(resolved.reason === "song" ? "notif.gone.song" : resolved.reason === "festival" ? "notif.gone.festival" : "notif.gone.route")
      router.push(href(resolved.route))
    })
  }
  const deleteItem = (item: AppNotification) => {
    remove(item)
    say(t("notif.inbox.deleted"), { label: t("common.undo"), run: () => restore(item, Date.now()) })
  }
  const clearAllNow = () => {
    setConfirming(false)
    const keptStored = clear(Date.now())
    // preview sample items are not in the store: delete them one by one
    const inStore = new Set(stored.map((n) => n.id))
    for (const item of items) if (!inStore.has(item.id) && !(unreadSet.has(item.id) && keptByClearAll([item], []) > 0)) remove(item)
    say(keptStored > 0 ? t("notif.inbox.cleared.kept", { count: keptStored }) : t("notif.inbox.cleared"))
  }
  const kept = keptByClearAll(items, read)

  const renderRow = (item: AppNotification) => (
    <SwipeRow key={item.id} p={p} label={t("common.delete")} onDelete={() => deleteItem(item)}>
      <Row p={p} item={item} now={now} unread={unreadSet.has(item.id)} onPress={() => openItem(item)} onDelete={() => deleteItem(item)} />
    </SwipeRow>
  )
  let reveal = 1

  return (
    <View style={[s.root, { backgroundColor: p.sand200, paddingTop: top }]}>
      <View style={s.bar}>
        <TodayPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={back} pressedScale={0.92} style={[s.back, { backgroundColor: p.white, borderColor: p.sand300 }]}>
          <ChevronLeft size={22} color={p.ink800} strokeWidth={1.9} />
        </TodayPress>
        <View style={s.barRight}>
          <TodayPress accessibilityRole="button" accessibilityLabel={t("common.settings")} onPress={() => router.push(href("/notification-settings"))} pressedScale={0.95} style={s.barText}>
            <Text style={[s.markText, { color: p.orange700 }]}>{t("common.settings")}</Text>
          </TodayPress>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0}>
          <Text style={s.h1} accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
            <Text style={{ color: p.ink800 }}>{t("profile.notifications")}</Text>
            {"\n"}
            <Text style={{ color: p.ink300 }}>{items.length === 0 ? t("notif.inbox.none") : unread > 0 ? t("notif.inbox.new", { count: unread }) : t("notif.inbox.allRead")}</Text>
          </Text>
        </Reveal>

        {banner ? (
          <Reveal index={reveal++}>
            <CentreBanner
              p={p}
              kind={banner}
              onPress={() => (banner === "denied" ? openSystemSettings() : banner === "undetermined" ? void ensurePermission() : retry())}
            />
          </Reveal>
        ) : null}

        {items.length > 0 ? (
          <Reveal index={reveal++} style={s.actions}>
            {unread > 0 ? (
              <TodayPress accessibilityRole="button" accessibilityLabel={t("notif.inbox.markAll")} onPress={() => markAll(items)} pressedScale={0.95} style={[s.pill, { borderColor: p.orange700 }]}>
                <Text style={[s.pillText, { color: p.orange700 }]}>{t("notif.inbox.markAll")}</Text>
              </TodayPress>
            ) : null}
            <TodayPress accessibilityRole="button" accessibilityLabel={t("notif.inbox.clearAll")} onPress={() => setConfirming(true)} pressedScale={0.95} style={[s.pill, { borderColor: p.sand400 }]}>
              <Text style={[s.pillText, { color: p.ink500 }]}>{t("notif.inbox.clearAll")}</Text>
            </TodayPress>
          </Reveal>
        ) : null}

        {sections.length === 0 ? (
          <Reveal index={reveal++} style={s.empty}>
            <Image source={todayAssets.logo} style={s.emptyLogo} contentFit="contain" accessibilityIgnoresInvertColors />
            <Text style={[s.emptyTitle, { color: p.ink800 }]}>{t("notif.inbox.empty.title")}</Text>
            <Text style={[s.emptyText, { color: p.ink500 }]}>{t("notif.inbox.empty.text")}</Text>
          </Reveal>
        ) : (
          sections.map((section) => (
            <Reveal key={section.id} index={Math.min(reveal++, 6)} style={s.section}>
              <Text style={[overStyle, { color: p.orange700, paddingHorizontal: HOME_INSET }]}>{section.label}</Text>
              <View style={s.list}>
                {rowsOf(section.items).map((row) =>
                  row.type === "item" ? (
                    renderRow(row.item)
                  ) : (
                    <GroupRow key={row.id} p={p} items={row.items} now={now} unreadIds={unreadSet} renderRow={renderRow} />
                  ),
                )}
              </View>
            </Reveal>
          ))
        )}
      </ScrollView>

      <UndoBar p={p} bar={bar} bottom={bottomInset} onDismiss={dismissBar} />
      <ConfirmDialog
        p={p}
        visible={confirming}
        title={t("notif.inbox.clear.title")}
        body={t("notif.inbox.clear.body")}
        note={kept > 0 ? t("notif.inbox.clear.keeps", { count: kept }) : undefined}
        confirmLabel={t("notif.inbox.clear.confirm")}
        onConfirm={clearAllNow}
        onCancel={() => setConfirming(false)}
      />
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
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: HOME_INSET },
  pill: { minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  empty: { alignItems: "center", gap: 10, paddingTop: 60, paddingHorizontal: 40 },
  emptyLogo: { width: 72, height: 86 },
  emptyTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, textTransform: "uppercase", letterSpacing: -0.5, textAlign: "center" },
  emptyText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, textAlign: "center" },
})
