import { useCallback, useMemo, useState } from "react"
import { Alert, FlatList, Platform, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { LibraryListRow, NewPlaylistRow, SignInInvite } from "@/components/library-v2/LibraryParts"
import { SpRound } from "@/components/song-v2/SpUi"
import { CloseGlyph, SearchGlyph } from "@/components/songs-v2/Glyphs"
import { ChipsRow, LIST_SIDE } from "@/components/songs-v2/ListParts"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useYourLibrary } from "@/hooks/useYourLibrary"
import {
  LIBRARY_CHIPS,
  emptyLibraryText,
  filterLibraryRows,
  isLibraryChip,
  showNewPlaylistRow,
  showSignInInvite,
  type LibraryChipId,
  type LibraryRow,
} from "@/lib/library/yourLibrary"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { nextPlaylistName } from "@/lib/save/saveToSheet"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { useSaveSheetStore } from "@/stores/saveSheetStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

const SIDE = 16
const REVEALED_ROWS = 6

/**
 * Your library (opened from the profile sheet): the person's own songs, Kiirtans, playlists, downloads
 * and uploads in one list, with a search by name and a chip per kind. A row opens the screen that
 * holds the thing (Songs > Saved, Kiirtan > Saved, the playlist, Storage and downloads, Kiirtan > My uploads).
 * "New playlist" makes a list the same way the Save sheet does and opens it. Guests see an invitation to
 * sign in on top; what is on the phone shows under it.
 * Preview only: `?as=guest` shows the guest state, `?chip=` picks a chip.
 */
export default function LibraryV2Screen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const insets = useSafeAreaInsets()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = Platform.OS === "web" ? 54 : insets.top
  const openedAt = useRevealClock()
  const bottomInset = useScrollBottomInset()
  const params = useLocalSearchParams<{ chip?: string; as?: string }>()

  const [query, setQuery] = useState("")
  const [chip, setChip] = useState<LibraryChipId>(isLibraryChip(params.chip) ? params.chip : "all")
  const { rows, signedIn } = useYourLibrary(MOCKUP_DATA && params.as === "guest")
  const shown = useMemo(() => filterLibraryRows(rows, chip, query), [rows, chip, query])
  const withNew = showNewPlaylistRow(chip, query)
  const invite = showSignInInvite(signedIn) && !query.trim() && chip === "all"

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/today")))
  const signIn = useCallback(() => router.push(href("/signin")), [router])
  const open = useCallback((row: LibraryRow) => router.push(href(row.target)), [router])

  const askSignIn = useCallback(() => {
    if (Platform.OS === "web") return useSaveSheetStore.getState().showToast(t("library.toast.signIn"))
    Alert.alert(t("library.signIn"), t("library.alert.body"), [
      { text: t("library.alert.notNow"), style: "cancel" },
      { text: t("library.signIn"), onPress: signIn },
    ])
  }, [signIn, t])

  /** The Save sheet's "New playlist": next free name, then open the empty list to fill it. */
  const newPlaylist = useCallback(async () => {
    const toast = useSaveSheetStore.getState().showToast
    if (MOCKUP_DATA) return toast(t("library.toast.preview"))
    const store = usePlaylistStore.getState()
    const name = nextPlaylistName(store.playlists)
    const created = await store.createPlaylist(name)
    if (isPlaylist(created)) {
      toast(t("library.toast.created", { name }))
      void usePlaylistStore.getState().flushSync()
      router.push(href(`/playlist-v2/${created.id}`))
      return
    }
    if ("needsAuth" in created) return askSignIn()
    Alert.alert(t("player.playlist"), created.error)
  }, [askSignIn, router, t])

  const clear = useCallback(() => {
    setQuery("")
    setChip("all")
  }, [])

  const header = (
    <View>
      {invite ? (
        <SongsReveal index={3}>
          <SignInInvite theme={theme} onSignIn={signIn} />
        </SongsReveal>
      ) : null}
      {withNew ? (
        <SongsReveal index={invite ? 4 : 3}>
          <NewPlaylistRow theme={theme} onPress={() => void newPlaylist()} />
        </SongsReveal>
      ) : null}
    </View>
  )

  const renderItem = useCallback(
    ({ item, index }: { item: LibraryRow; index: number }) => {
      const row = <LibraryListRow theme={theme} row={item} onOpen={open} />
      return index < REVEALED_ROWS ? <SongsReveal index={4 + index}>{row}</SongsReveal> : row
    },
    [theme, open],
  )

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page }]}>
        {/* the pinned bar: back, title, search and kinds stay while the list scrolls */}
        <View style={[styles.bar, { paddingTop: inset, backgroundColor: theme.page }]}>
          <SongsReveal index={0}>
            <View style={styles.titleRow}>
              <SpRound t={sp} icon="back" label={t("common.back")} onPress={back} />
              <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1} accessibilityRole="header">
                {t("library.title")}
              </Text>
            </View>
          </SongsReveal>
          <SongsReveal index={1}>
            <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <SearchGlyph color={theme.textBody} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("library.search")}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t("library.search")}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
                style={[styles.input, { color: theme.textHeading }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
              />
              {query ? (
                <Press accessibilityRole="button" accessibilityLabel={t("search.clear.a11y")} onPress={() => setQuery("")} pressedScale={0.88} style={styles.clearBtn}>
                  <CloseGlyph size={18} color={theme.textBody} />
                </Press>
              ) : null}
            </View>
          </SongsReveal>
          <SongsReveal index={2}>
            <ChipsRow theme={theme} chips={LIBRARY_CHIPS} active={chip} onPick={(id) => setChip(id as LibraryChipId)} />
          </SongsReveal>
        </View>

        <FlatList
          data={shown}
          keyExtractor={(row) => row.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={[styles.empty, { color: theme.textBody }]}>{emptyLibraryText(chip, query)}</Text>
              {query || chip !== "all" ? (
                <Press accessibilityRole="button" accessibilityLabel={t("library.showAll")} onPress={clear} pressedScale={0.96} style={styles.emptyBtn}>
                  <Text style={[styles.emptyLink, { color: theme.accent }]}>{t("library.showAll")}</Text>
                </Press>
              ) : null}
            </View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          // room for the mini-player above the bottom edge, like the other pushed pages
          contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomInset }}
          initialNumToRender={12}
          windowSize={7}
        />
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { zIndex: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: LIST_SIDE, height: 56 },
  title: { flex: 1, fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, textTransform: "uppercase" },
  search: {
    height: 48,
    marginHorizontal: SIDE,
    marginTop: 8,
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, height: 48, fontFamily: amFonts.medium, fontSize: 16 },
  clearBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyBox: { paddingHorizontal: LIST_SIDE, paddingTop: 20, gap: 4 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
  emptyBtn: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  emptyLink: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
