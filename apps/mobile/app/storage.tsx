import { useEffect, useMemo, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { usePathname, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ConfirmSheet } from "@/components/profile-v2/ConfirmSheet"
import {
  BackHeader,
  CacheLimitSection,
  ClearActionPill,
  ClearAllRow,
  OrphansRow,
  StorageListHeader,
  StorageRow,
  StorageTotalCard,
  WifiOnlyRow,
} from "@/components/songs-v2/StorageParts"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongTitles } from "@/hooks/useSongTitles"
import { useStorageScreen } from "@/hooks/useStorageScreen"
import { displayTitle } from "@/lib/songsV2/entry"
import { kiirtanSongByNumber } from "@/lib/kirtan/catalog"
import { isKiirtanNumber } from "@/lib/kirtan/track"
import { MOCK_STORAGE } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { listViewState } from "@/lib/mineView"
import { miniPlayerVisible, tabBarVisible } from "@/lib/navV2"
import { storageBarBottom, storageListInset } from "@/lib/storageBar"
import { usePlayerStore } from "@/stores/playerStore"
import { useT } from "@/lib/i18n"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { href } from "@/utils/href"

/** While the confirm sheet is open the pill sinks, so the sheet rises where it was. */
const HIDDEN_ACTION = { visible: false } as const

/**
 * Storage and downloads (prototype lines 1972-2011). How many megabytes the songs take, the cache
 * limit, and a list you can select from. Tap rows to select; the bottom pill ("Delete N selected" or
 * "Clear all downloads") opens a confirm sheet with the size. The pill sits ABOVE the mini-player and the
 * tab bar, which are drawn above every screen, and the list has matching bottom padding. Reachable at /storage; Mine > On this phone and Profile open it.
 */
export default function StorageScreen() {
  const router = useRouter()
  const t = useT()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = useScreenTop()
  const state = useStorageScreen()
  const titles = useSongTitles(state.items.map((item) => item.songNumber))
  const view = listViewState({ loading: !state.scanned, count: state.items.length })
  const openedAt = useRevealClock()
  const pathname = usePathname()
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const barBottom = storageBarBottom({
    safeBottom: Platform.OS === "web" ? 0 : insets.bottom,
    miniVisible: miniPlayerVisible({ pathname, hasSong }),
    tabBarVisible: tabBarVisible(pathname),
  })

  // one stable object per sheet: a new one on every render would re-open a sheet that is closing
  const { confirm, confirmClear } = state
  const { orphanCopy, confirmRemoveOrphans } = state
  const request = useMemo(
    () =>
      confirm
        ? { ...confirm, onConfirm: () => void confirmClear() }
        : orphanCopy
          ? { ...orphanCopy, onConfirm: () => void confirmRemoveOrphans() }
          : null,
    [confirm, confirmClear, orphanCopy, confirmRemoveOrphans],
  )

  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!state.toast) return
    setToast(state.toast.text)
    const timer = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(timer)
  }, [state.toast])

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page, paddingTop: inset }]}>
        <SongsReveal index={0}>
          <BackHeader
            theme={theme}
            title={t("profile.storage")}
            onBack={() => (router.canGoBack() ? router.back() : router.replace(href(NAV_V2_HOME_ROUTE)))}
          />
        </SongsReveal>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.body, { paddingBottom: storageListInset(barBottom) }]}>
          <SongsReveal index={1}>
            <StorageTotalCard theme={theme} totalBytes={state.total} count={state.items.length} limit={state.limit} />
          </SongsReveal>

          <SongsReveal index={2}>
            <CacheLimitSection theme={theme} value={state.limit.id} onChange={state.chooseLimit} />
          </SongsReveal>

          <SongsReveal index={2}>
            <WifiOnlyRow theme={theme} on={state.wifiOnly} onToggle={() => state.setWifiOnly(!state.wifiOnly)} />
          </SongsReveal>

          <SongsReveal index={3} style={styles.list}>
            {view === "list" ? (
              <>
                <StorageListHeader
                  theme={theme}
                  count={state.items.length}
                  allSelected={state.allSelected}
                  onToggleAll={state.toggleAll}
                />
                {state.items.map((item) => (
                  <StorageRow
                    key={item.key}
                    theme={theme}
                    item={item}
                    items={state.items}
                    title={
                      MOCKUP_DATA
                        ? (MOCK_STORAGE.find((m) => m.key === item.key)?.title ?? `Prabhat Samgiita ${item.songNumber}`)
                        : isKiirtanNumber(item.songNumber)
                          ? (kiirtanSongByNumber(item.songNumber)?.title ?? t("storage.row.kiirtan"))
                          : displayTitle(titles.get(item.songNumber) ?? `Prabhat Samgiita ${item.songNumber}`)
                    }
                    sub={MOCKUP_DATA ? MOCK_STORAGE.find((m) => m.key === item.key)?.sub : undefined}
                    selected={state.selected.includes(item.key)}
                    onToggle={() => state.toggleRow(item.key)}
                  />
                ))}
                {state.action.visible && state.action.mode === "all" ? (
                  <ClearAllRow theme={theme} label={state.action.label} onPress={state.pressAction} />
                ) : null}
              </>
            ) : (
              <Text style={[styles.empty, { color: theme.textBody }]} accessibilityLiveRegion="polite">
                {view === "empty"
                  ? `\n${t("storage.empty")}`
                  : `\n${t("storage.checking")}`}
              </Text>
            )}
            {state.orphans.length > 0 ? (
              <OrphansRow theme={theme} count={state.orphans.length} bytes={state.orphanBytes} onPress={state.askRemoveOrphans} />
            ) : null}
          </SongsReveal>
        </ScrollView>

        <Toast message={toast} theme={theme} />
        <ClearActionPill theme={theme} action={confirm || !state.action.visible || state.action.mode !== "selected" ? HIDDEN_ACTION : state.action} bottom={barBottom} onPress={state.pressAction} />
        <ConfirmSheet
          theme={theme}
          bottomOffset={barBottom}
          request={request}
          onDismiss={() => (state.confirm ? state.cancelClear() : state.cancelRemoveOrphans())}
        />
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 10, gap: 20 },
  list: { gap: 10 },
  empty: { paddingHorizontal: 20, maxWidth: 360, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
})
