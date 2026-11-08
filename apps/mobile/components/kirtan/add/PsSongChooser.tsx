import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TextInput, View } from "react-native"
import { Check } from "lucide-react-native"

import { SheetModal } from "@/components/common/SheetModal"
import { PICKER_INSET, PickerSearch } from "@/components/learn-v2/SongPicker"
import { PressBox } from "@/components/learn-v2/PressBox"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useT } from "@/lib/i18n"
import { PICKER_ROW_HEIGHT, buildPickerIndex, entryFromIndexRow, queryLabel, searchPicker, type PickerIndexRow } from "@/lib/learn/songPicker"
import { catalogLyricRows } from "@/lib/lyricSearch"
import { hasPlayableAudio } from "@/lib/playableAudio"
import type { CatalogEntry } from "@/lib/songsV2/entry"

/**
 * "Which song is this a performance of?": the add form's chooser for a Prabhat Samgiita recording. A full-screen sheet
 * with the same search and the same 5,018 songs as "Add a song" in Learn (the index ships with the app, so it opens at
 * once and works offline). Tapping a song picks it and closes the sheet.
 */

type Index = { status: "loading" } | { status: "error" } | { status: "ready"; rows: PickerIndexRow[] }

function buildIndex(): Index {
  const rows = catalogLyricRows()
  if (!rows.length) return { status: "error" }
  return { status: "ready", rows: buildPickerIndex(rows.map((row) => entryFromIndexRow(row, hasPlayableAudio))) }
}

export function PsSongChooser({ visible, selected, onPick, onClose }: { visible: boolean; selected: number | null; onPick: (song: { number: number; title: string }) => void; onClose: () => void }) {
  const t = useT()
  const p = protoFor(useAmTheme())
  const inputRef = useRef<TextInput | null>(null)
  const [index, setIndex] = useState<Index>({ status: "loading" })
  const [query, setQuery] = useState("")
  const deferred = useDeferredValue(query)

  // build the index after the sheet has opened, so the first frame is not held up by 5,018 rows
  useEffect(() => {
    if (!visible || index.status === "ready") return
    const id = setTimeout(() => setIndex(buildIndex()), 0)
    return () => clearTimeout(id)
  }, [visible, index.status])
  useEffect(() => {
    if (!visible) setQuery("")
  }, [visible])

  const results = useMemo<CatalogEntry[]>(() => (index.status === "ready" ? searchPicker(index.rows, deferred) : []), [index, deferred])
  const choose = useCallback((entry: CatalogEntry) => onPick({ number: entry.number, title: entry.title }), [onPick])
  const renderItem = useCallback(({ item }: { item: CatalogEntry }) => <SongRow p={p} entry={item} chosen={item.number === selected} onChoose={choose} />, [p, selected, choose])

  const empty =
    index.status === "loading" ? (
      <View style={s.state} accessibilityLiveRegion="polite">
        <ActivityIndicator color={p.ink500} />
        <Text style={[s.stateText, { color: p.ink500 }]}>{t("learn.add.loading")}</Text>
      </View>
    ) : index.status === "error" ? (
      <View style={s.state}>
        <Text style={[s.stateText, { color: p.ink500 }]}>{t("learn.add.error")}</Text>
        <PressBox accessibilityRole="button" accessibilityLabel={t("common.tryAgain")} onPress={() => setIndex({ status: "loading" })} pressedScale={0.96} style={[s.stateButton, { backgroundColor: p.action }]}>
          <Text style={[s.stateButtonText, { color: p.onAction }]}>{t("common.tryAgain")}</Text>
        </PressBox>
      </View>
    ) : (
      <View style={s.state}>
        <Text style={[s.stateText, { color: p.ink500 }]}>{t("learn.add.noMatch", { query: queryLabel(query) })}</Text>
      </View>
    )

  return (
    <SheetModal visible={visible} title={t("rec.song.chooserTitle")} closeLabel={t("ugc.add.close")} onClose={onClose}>
      <View style={s.searchRow}>
        <PickerSearch p={p} value={query} onChangeText={setQuery} inputRef={inputRef} />
      </View>
      <Text style={[s.count, { color: p.ink500 }]} accessibilityLiveRegion="polite">
        {index.status === "ready" ? t("songs.count", { count: results.length }) : " "}
      </Text>
      <FlatList
        data={results}
        extraData={selected}
        keyExtractor={(entry) => String(entry.number)}
        renderItem={renderItem}
        getItemLayout={(_data, i) => ({ length: PICKER_ROW_HEIGHT, offset: PICKER_ROW_HEIGHT * i, index: i })}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={14}
        maxToRenderPerBatch={14}
        updateCellsBatchingPeriod={40}
        windowSize={9}
        removeClippedSubviews={Platform.OS === "android"}
        style={s.list}
      />
    </SheetModal>
  )
}

const SongRow = memo(function SongRow({ p, entry, chosen, onChoose }: { p: AmProto; entry: CatalogEntry; chosen: boolean; onChoose: (entry: CatalogEntry) => void }) {
  const t = useT()
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={t("rec.song.rowA11y", { number: entry.number, title: entry.title })}
      accessibilityState={{ selected: chosen }}
      onPress={() => onChoose(entry)}
      pressedScale={0.99}
      outerStyle={s.rowOuter}
      style={[s.row, { borderBottomColor: p.sand300 }]}
    >
      <Text style={[s.num, { color: p.orange700 }]}>{`PS ${entry.number}`}</Text>
      <View style={s.texts}>
        <Text style={[s.title, { color: p.ink800 }]} numberOfLines={1}>
          {entry.title}
        </Text>
        {entry.firstLine ? (
          <Text style={[s.line, { color: p.ink500 }]} numberOfLines={1}>
            {entry.firstLine}
          </Text>
        ) : null}
      </View>
      {chosen ? <Check size={22} color={p.orange700} strokeWidth={2.4} /> : null}
    </PressBox>
  )
})

const s = StyleSheet.create({
  searchRow: { height: 56, paddingHorizontal: PICKER_INSET, flexDirection: "row" },
  count: { paddingHorizontal: PICKER_INSET, height: 32, lineHeight: 32, fontFamily: amFonts.semi, fontSize: 13, fontVariant: ["tabular-nums"] },
  list: { flex: 1 },
  rowOuter: { height: PICKER_ROW_HEIGHT },
  row: { height: PICKER_ROW_HEIGHT, paddingLeft: PICKER_INSET, paddingRight: PICKER_INSET, flexDirection: "row", alignItems: "center", gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  num: { width: 58, fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18, letterSpacing: 0.3, fontVariant: ["tabular-nums"] },
  texts: { flex: 1, minWidth: 0, gap: 2, paddingRight: 8 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.16 },
  line: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  state: { alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: 24 },
  stateText: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21, textAlign: "center" },
  stateButton: { height: 44, paddingHorizontal: 20, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  stateButtonText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
