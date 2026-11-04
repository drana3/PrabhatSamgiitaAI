import { useEffect, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  BackHeader,
  CacheLimitSection,
  ClearActionPill,
  StorageListHeader,
  StorageRow,
  StorageTotalCard,
} from "@/components/songs-v2/StorageParts"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongTitles } from "@/hooks/useSongTitles"
import { useStorageScreen } from "@/hooks/useStorageScreen"
import { displayTitle } from "@/lib/songsV2/entry"
import { MOCK_STORAGE } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { listViewState } from "@/lib/mineView"

/**
 * Storage and downloads (prototype lines 1972-2011). How many megabytes the songs take, the cache
 * limit, and a list you can select from. Tap rows to select; the bottom pill clears the selection,
 * or everything after a second tap. Reachable at /storage; Mine > On this phone and Profile open it.
 */
export default function StorageScreen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = Platform.OS === "web" ? 54 : insets.top
  const state = useStorageScreen()
  const titles = useSongTitles(state.items.map((item) => item.songNumber))
  const view = listViewState({ loading: !state.scanned, count: state.items.length })
  const openedAt = useRevealClock()

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
            title="Storage and downloads"
            onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          />
        </SongsReveal>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <SongsReveal index={1}>
            <StorageTotalCard theme={theme} totalBytes={state.total} count={state.items.length} limit={state.limit} />
          </SongsReveal>

          <SongsReveal index={2}>
            <CacheLimitSection theme={theme} value={state.limit.id} onChange={state.chooseLimit} />
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
                        : displayTitle(titles.get(item.songNumber) ?? `Prabhat Samgiita ${item.songNumber}`)
                    }
                    sub={MOCKUP_DATA ? MOCK_STORAGE.find((m) => m.key === item.key)?.sub : undefined}
                    selected={state.selected.includes(item.key)}
                    onToggle={() => state.toggleRow(item.key)}
                  />
                ))}
              </>
            ) : (
              <Text style={[styles.empty, { color: theme.textBody }]} accessibilityLiveRegion="polite">
                {view === "empty"
                  ? "\nNo downloads yet. Tap Download on any song to hear it without internet."
                  : "\nChecking this phone…"}
              </Text>
            )}
          </SongsReveal>
        </ScrollView>

        <Toast message={toast} theme={theme} />
        <ClearActionPill theme={theme} action={state.action} onPress={() => void state.pressAction()} />
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 10, paddingBottom: 140, gap: 20 },
  list: { gap: 10 },
  empty: { paddingHorizontal: 20, maxWidth: 360, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
})
