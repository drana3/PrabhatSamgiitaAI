import { useCallback, useMemo, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { EmptyHistory, GroupLabel, HistoryRow, PauseRow } from "@/components/listening/HistoryParts"
import { ConfirmSheet, type ConfirmRequest } from "@/components/profile-v2/ConfirmSheet"
import { SpRound } from "@/components/song-v2/SpUi"
import { Press } from "@/components/songs-v2/Press"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { groupHistory, type HistoryEntry, type HistoryGroupKey } from "@/lib/listening/history"
import { playHistoryEntry } from "@/lib/listening/playAgain"
import { useT } from "@/lib/i18n"
import { useListeningHistoryStore } from "@/stores/listeningHistoryStore"
import { href } from "@/utils/href"

type Row = { type: "group"; key: HistoryGroupKey } | { type: "entry"; entry: HistoryEntry }

const GROUP_KEYS = {
  today: "history.group.today",
  yesterday: "history.group.yesterday",
  earlier: "history.group.earlier",
} as const

/**
 * My listening history: what this person really listened to on this phone, grouped Today, Yesterday, Earlier. Local only.
 * A row plays the track again; the cross removes that one entry; "Clear all" asks first; the switch pauses logging.
 * Reached from Today and from the profile menu. An entry exists only after a counted play (lib/listening/history.ts).
 */
export default function ListeningHistoryScreen() {
  const tr = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const inset = useScreenTop()
  const bottomInset = useScrollBottomInset()
  const entries = useListeningHistoryStore((s) => s.entries)
  const paused = useListeningHistoryStore((s) => s.paused)
  const remove = useListeningHistoryStore((s) => s.remove)
  const clear = useListeningHistoryStore((s) => s.clear)
  const setPaused = useListeningHistoryStore((s) => s.setPaused)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2200)
  }, [])

  const rows = useMemo<Row[]>(
    () =>
      groupHistory(entries, Date.now()).flatMap((g) => [
        { type: "group" as const, key: g.key },
        ...g.entries.map((entry) => ({ type: "entry" as const, entry })),
      ]),
    [entries],
  )

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/today")))

  /** Play again, in the one player (lib/listening/playAgain.ts). */
  const playAgain = useCallback(
    (entry: HistoryEntry) => {
      const message = playHistoryEntry(entry)
      if (message) flash(message)
    },
    [flash],
  )

  const askClear = () =>
    setConfirm({
      title: tr("history.clear.title"),
      body: tr("history.clear.body"),
      confirmLabel: tr("history.clear.confirm"),
      onConfirm: clear,
    })

  const header = (
    <View>
      <Text style={[s.local, { color: theme.textBody }]}>{tr("history.local")}</Text>
      <PauseRow theme={theme} paused={paused} onChange={setPaused} />
    </View>
  )

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: inset, backgroundColor: theme.page }]}>
        <View style={s.titleRow}>
          <SpRound t={sp} icon="back" label={tr("common.back")} onPress={back} />
          <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2} accessibilityRole="header">
            {tr("history.title")}
          </Text>
          {entries.length ? (
            <Press accessibilityRole="button" accessibilityLabel={tr("history.clear")} onPress={askClear} pressedScale={0.94} style={s.clearBtn}>
              <Text style={[s.clearText, { color: theme.accent }]}>{tr("history.clear")}</Text>
            </Press>
          ) : null}
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.type === "group" ? `g:${row.key}` : row.entry.id)}
        renderItem={({ item }) =>
          item.type === "group" ? (
            <GroupLabel theme={theme} label={tr(GROUP_KEYS[item.key])} />
          ) : (
            <HistoryRow theme={theme} entry={item.entry} onPlay={playAgain} onRemove={(e) => remove(e.id)} />
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyHistory theme={theme} paused={paused} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        initialNumToRender={14}
        windowSize={7}
      />
      <Toast message={toast} theme={theme} />
      <ConfirmSheet theme={theme} request={confirm} onDismiss={() => setConfirm(null)} bottomOffset={bottomInset} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { zIndex: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: 16, minHeight: 56 },
  title: { flex: 1, fontFamily: amFonts.display, fontSize: 26, lineHeight: 29, letterSpacing: -0.5, textTransform: "uppercase" },
  clearBtn: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  clearText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 18 },
  local: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingTop: 6 },
})
