import { useMemo } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ChevronLeft, Play } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { PillButton } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import { SongCardRow } from "@/components/songs-v2/SongCardRow"
import { Toast } from "@/components/songs-v2/Toast"
import { TwoToneHeading } from "@/components/today/TodayBlocks"
import { amGap, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSongsV2Actions } from "@/hooks/useSongsV2Actions"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { placeholderEntry } from "@/lib/songsV2/entry"
import { songCountLabel } from "@/lib/songsV2/collections"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

/**
 * One collection as a list of the same rows as the Catalog (spec SCR-17
 * item 3). `id` is anything songNumbersForCategory understands: a category
 * id, a collection label or a collection value.
 */
export default function SongsV2CollectionScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const { id, title } = useLocalSearchParams<{ id?: string; title?: string }>()
  const catalog = useSongsV2Catalog()
  const actions = useSongsV2Actions()
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const offlineFiles = useOfflineAudioStore((s) => s.files)
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))

  const numbers = useMemo(() => (id ? songNumbersForCategory(String(id)) : []), [id])
  const entries = useMemo(
    () => numbers.map((n) => catalog.byNumber.get(n) ?? placeholderEntry(n)),
    [numbers, catalog.byNumber],
  )
  const saved = useMemo(() => new Set(savedSongIds.map((s) => Number(s.replace(/^ps-/i, "")))), [savedSongIds])
  const offline = useMemo(() => new Set(Object.values(offlineFiles).map((f) => f.songNumber)), [offlineFiles])
  const heading = String(title ?? id ?? "Collection")
  const bottom = hasSong ? 160 : 110

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => String(entry.number)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: amGap.gutter, paddingBottom: bottom, gap: amGap.grid }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Press
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              pressedScale={0.92}
              style={[styles.back, { backgroundColor: theme.card, borderColor: theme.line }]}
            >
              <ChevronLeft size={22} color={theme.textHeading} />
            </Press>
            <TwoToneHeading theme={theme} first={heading} second={songCountLabel(entries.length)} />
            {entries.length ? (
              <PillButton
                theme={theme}
                label="Play all"
                icon={<Play size={16} color={theme.onBrand} fill={theme.onBrand} />}
                onPress={() => actions.playAll(numbers)}
                style={styles.start}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={[amType.body, { color: theme.textBody }]}>
            {catalog.loading ? "Loading songs…" : "No songs in this collection yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <SongCardRow
            theme={theme}
            entry={item}
            saved={saved.has(item.number)}
            offline={offline.has(item.number)}
            onOpen={actions.open}
            onToggleSave={(entry) => void actions.toggleSave(entry)}
            onQueue={actions.queue}
            onMenu={actions.share}
          />
        )}
      />
      <Toast message={actions.toast} bottom={bottom - amSpace.s4} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { gap: amGap.block, paddingTop: amSpace.s2, paddingBottom: amGap.block },
  back: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  start: { alignSelf: "flex-start" },
})
