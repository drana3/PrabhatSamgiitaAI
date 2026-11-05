import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TextInput, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"

import { AudioChip, PICKER_INSET, PickerRow, PickerSearch, PickerToast } from "@/components/learn-v2/SongPicker"
import { PressBox } from "@/components/learn-v2/PressBox"
import { BackButton, useLearnTopInset } from "@/components/learn-v2/ui"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnSongs } from "@/hooks/useLearnSongs"
import { LEARN_ROUTES } from "@/lib/learn/routes"
import { PICKER_ROW_HEIGHT, buildPickerIndex, entryFromIndexRow, queryLabel, searchPicker, type PickerIndexRow } from "@/lib/learn/songPicker"
import { catalogLyricRows } from "@/lib/lyricSearch"
import { hasPlayableAudio } from "@/lib/playableAudio"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

const TOAST_MS = 4000
const HEADER_H = 64
const SEARCH_H = 56
const CHIPS_H = 56

type Index = { status: "loading" } | { status: "error" } | { status: "ready"; rows: PickerIndexRow[] }

/** The 5,018 songs from the song index that ships with the app: no network, so it opens at once and works offline. */
function buildIndex(): Index {
  const rows = catalogLyricRows()
  if (!rows.length) return { status: "error" }
  return { status: "ready", rows: buildPickerIndex(rows.map((row) => entryFromIndexRow(row, hasPlayableAudio))) }
}

/**
 * "Add a song" (Learn): every Prabhat Samgiita song in one long list, with a search for the number,
 * the title or the first line, and a "With audio" switch. Tapping a song puts it on the Learn list
 * (the hub shows it at once); tapping it again takes it off, and Undo brings it back. The list is a
 * virtualised FlatList with a fixed row height, so 5,018 rows scroll and jump without measuring.
 */
export default function LearnAddSongScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const top = useLearnTopInset()
  const learn = useLearnSongs()
  const inputRef = useRef<TextInput | null>(null)

  const [index, setIndex] = useState<Index>({ status: "loading" })
  const [query, setQuery] = useState("")
  const [withAudio, setWithAudio] = useState(false)
  const deferred = useDeferredValue(query)
  const [toast, setToast] = useState<{ message: string; undo: () => void } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // build the index after the screen has opened, so the first frame is not held up by 5,018 rows
  const load = useCallback(() => {
    setIndex({ status: "loading" })
    const id = setTimeout(() => setIndex(buildIndex()), 0)
    return () => clearTimeout(id)
  }, [])
  useEffect(() => load(), [load])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const results = useMemo<CatalogEntry[]>(
    () => (index.status === "ready" ? searchPicker(index.rows, deferred, { withAudio }) : []),
    [index, deferred, withAudio],
  )

  const showToast = useCallback((message: string, undo: () => void) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ message, undo })
    timer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  const { add, remove, restore, has } = learn
  const toggle = useCallback(
    (entry: CatalogEntry) => {
      if (has(entry.number)) {
        const removed = remove(entry.number)
        if (!removed) return
        showToast(t("learn.add.toast.removed", { number: entry.number }), () => {
          restore(removed)
          setToast(null)
        })
        return
      }
      const result = add(entry.number, entry.title)
      if (result.status === "invalid") return
      showToast(t("learn.add.toast.added", { number: entry.number }), () => {
        remove(entry.number)
        setToast(null)
      })
    },
    [has, add, remove, restore, showToast, t],
  )

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(LEARN_ROUTES.learn))
  }

  const renderItem = useCallback(
    ({ item }: { item: CatalogEntry }) => <PickerRow p={p} entry={item} listed={learn.numbers.has(item.number)} onToggle={toggle} />,
    [p, learn.numbers, toggle],
  )

  const typed = query.trim().length > 0
  const empty =
    index.status === "loading" ? (
      <View style={s.state} accessibilityLiveRegion="polite">
        <ActivityIndicator color={p.ink500} />
        <Text style={[s.stateText, { color: p.ink500 }]}>{t("learn.add.loading")}</Text>
      </View>
    ) : index.status === "error" ? (
      <View style={s.state}>
        <Text style={[s.stateText, { color: p.ink500 }]}>{t("learn.add.error")}</Text>
        <PressBox
          accessibilityRole="button"
          accessibilityLabel={t("common.tryAgain")}
          onPress={load}
          pressedScale={0.96}
          style={[s.stateButton, { backgroundColor: p.action }]}
        >
          <Text style={[s.stateButtonText, { color: p.onAction }]}>{t("common.tryAgain")}</Text>
        </PressBox>
      </View>
    ) : (
      <View style={s.state}>
        <Text style={[s.stateText, { color: p.ink500 }]}>{t("learn.add.noMatch", { query: queryLabel(query) })}</Text>
        <PressBox
          accessibilityRole="button"
          accessibilityLabel={t("learn.add.clearSearch")}
          onPress={() => {
            setQuery("")
            setWithAudio(false)
          }}
          pressedScale={0.96}
          style={[s.stateButton, { backgroundColor: p.action }]}
        >
          <Text style={[s.stateButtonText, { color: p.onAction }]}>{t("learn.add.clearSearch")}</Text>
        </PressBox>
      </View>
    )

  const count = index.status === "ready" ? t("songs.count", { count: results.length }) : ""

  return (
    <View style={[s.root, { backgroundColor: p.sand200, paddingTop: top }]}>
      <LinearGradient
        pointerEvents="none"
        colors={p.dark ? ["rgba(74, 46, 28, 0.6)", "rgba(74, 46, 28, 0)"] : [p.orange100, "rgba(255, 220, 197, 0)"]}
        style={s.wash}
      />
      <View style={s.header}>
        <BackButton theme={theme} onPress={back} />
        <Text accessibilityRole="header" style={s.heading} numberOfLines={2}>
          <Text style={{ color: p.ink800 }}>{t("learn.add.heading.first")}</Text>
          <Text style={{ color: p.ink300 }}>{` ${t("learn.add.heading.second")}`}</Text>
        </Text>
        <PressBox
          accessibilityRole="button"
          accessibilityLabel={t("common.done")}
          onPress={back}
          pressedScale={0.95}
          style={[s.done, { backgroundColor: p.action }]}
        >
          <Text style={[s.doneText, { color: p.onAction }]}>{t("common.done")}</Text>
        </PressBox>
      </View>

      <View style={s.searchRow}>
        <PickerSearch p={p} value={query} onChangeText={setQuery} inputRef={inputRef} />
      </View>
      <View style={s.chipsRow}>
        <AudioChip p={p} on={withAudio} onPress={() => setWithAudio((on) => !on)} />
        <Text style={[s.count, { color: p.ink500 }]} numberOfLines={1} accessibilityLiveRegion="polite">
          {count}
        </Text>
        <Text style={[s.count, { color: p.orange700 }]} numberOfLines={1}>
          {t("learn.add.inList", { n: learn.count })}
        </Text>
      </View>

      <FlatList
        data={results}
        extraData={learn.numbers}
        keyExtractor={(entry) => String(entry.number)}
        renderItem={renderItem}
        getItemLayout={(_data, i) => ({ length: PICKER_ROW_HEIGHT, offset: PICKER_ROW_HEIGHT * i, index: i })}
        ListHeaderComponent={typed || results.length === 0 ? null : <Text style={[s.explain, { color: p.ink500 }]}>{t("learn.add.explain")}</Text>}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
        initialNumToRender={14}
        maxToRenderPerBatch={14}
        updateCellsBatchingPeriod={40}
        windowSize={9}
        removeClippedSubviews={Platform.OS === "android"}
        contentContainerStyle={s.listContent}
        style={s.list}
      />

      <PickerToast
        p={p}
        message={toast?.message ?? null}
        actionLabel={t("learn.add.undo")}
        onAction={() => toast?.undo()}
        top={top + HEADER_H + SEARCH_H + CHIPS_H + 4}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 360 },
  header: { height: HEADER_H, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: PICKER_INSET - 8 },
  heading: { flex: 1, minWidth: 0, fontFamily: amFonts.display, fontSize: 26, lineHeight: 28, letterSpacing: -0.5, textTransform: "uppercase" },
  done: { height: 44, paddingHorizontal: 20, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  doneText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  searchRow: { height: SEARCH_H, paddingHorizontal: PICKER_INSET - 8, flexDirection: "row" },
  chipsRow: { height: CHIPS_H, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: PICKER_INSET - 8 },
  count: { flexShrink: 1, fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
  list: { flex: 1 },
  listContent: { paddingBottom: 190 },
  explain: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, paddingHorizontal: PICKER_INSET, paddingBottom: 12, maxWidth: 360 },
  state: { paddingHorizontal: PICKER_INSET, paddingTop: 24, gap: 16, alignItems: "flex-start" },
  stateText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, maxWidth: 340 },
  stateButton: { height: 44, paddingHorizontal: 20, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  stateButtonText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
