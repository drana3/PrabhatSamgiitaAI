import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import {
  CacheLimitChips,
  ClearActionPill,
  StorageListHeader,
  StorageRow,
  StorageTotalCard,
  Toast,
} from "@/components/saved-v2/StorageParts"
import { BackButton, Note, SectionHeading } from "@/components/saved-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSongTitles } from "@/hooks/useSongTitles"
import { useStorageScreen } from "@/hooks/useStorageScreen"
import { listViewState } from "@/lib/mineView"

/**
 * Storage and downloads (spec SCR-20): how many megabytes the songs take,
 * delete everything or only the songs you pick. Redesign screen, reachable at
 * /storage; Profile > Listening and Mine > On this phone open it.
 */
export default function StorageScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const state = useStorageScreen()
  const titles = useSongTitles(state.items.map((item) => item.songNumber))
  const view = listViewState({ loading: !state.scanned, count: state.items.length })

  let block = 0
  const next = () => block++

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
      >
        <Reveal index={next()}>
          <View style={styles.topBar}>
            <BackButton theme={theme} onPress={() => router.back()} />
          </View>
        </Reveal>

        <Reveal index={next()}>
          <SectionHeading theme={theme} first="Storage" second="and downloads" />
          <StorageTotalCard theme={theme} totalBytes={state.total} count={state.items.length} limit={state.limit} />
        </Reveal>

        <Reveal index={next()}>
          <CacheLimitChips theme={theme} value={state.limit.id} onChange={state.chooseLimit} />
        </Reveal>

        <Reveal index={next()}>
          {view === "empty" ? (
            <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <Note theme={theme}>No downloads yet. Tap Download on any song to hear it without internet.</Note>
            </View>
          ) : view === "list" ? (
            <View style={styles.list}>
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
                  title={titles.get(item.songNumber) ?? `Prabhat Samgiita ${item.songNumber}`}
                  selected={state.selected.includes(item.key)}
                  onToggle={() => state.toggleRow(item.key)}
                />
              ))}
            </View>
          ) : (
            <Text style={{ color: theme.textBody }} accessibilityLiveRegion="polite">
              Checking this phone…
            </Text>
          )}
        </Reveal>
        <View style={styles.tail} />
      </ScrollView>

      <Toast message={state.toast} />
      <ClearActionPill theme={theme} action={state.action} onPress={() => void state.pressAction()} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: amGap.section / 2 },
  topBar: { height: 56, justifyContent: "center", alignItems: "flex-start" },
  list: { gap: amGap.grid },
  empty: { borderRadius: amRadius.card, borderWidth: 1, padding: amGap.padCard },
  tail: { height: 160 },
})
