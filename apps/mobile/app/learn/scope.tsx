import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TextInput, View } from "react-native"
import { Check } from "lucide-react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"

import { AudioChip, PICKER_INSET, PickerRow, PickerSearch } from "@/components/learn-v2/SongPicker"
import { PressBox } from "@/components/learn-v2/PressBox"
import { BackButton, Segmented, useLearnTopInset } from "@/components/learn-v2/ui"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useStudyScope } from "@/hooks/useStudyScope"
import { useT } from "@/lib/i18n"
import { buildIndex, type PickerIndex } from "@/lib/learn/pickerIndex"
import { LEARN_ROUTES, quizHref, wordsHref } from "@/lib/learn/routes"
import {
  STUDY_MODES,
  clearChosenSongs,
  modeUsesPicker,
  numbersWithWords,
  pickOneSong,
  pickedNumbers,
  toggleChosenSong,
  withMode,
  type StudyMode,
} from "@/lib/learn/scope"
import { deckLine, emptyKind, partialLine } from "@/lib/learn/scopeText"
import { PICKER_ROW_HEIGHT, queryLabel, searchPicker } from "@/lib/learn/songPicker"
import { learnWordList } from "@/lib/learn/verified"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { href } from "@/utils/href"

const HEADER_H = 64
const SEARCH_H = 44
const FILTER_H = 40

/**
 * "What to study" (Learn, Practice): which Prabhat Samgiita songs the word cards and the quiz use.
 * One song, several songs (search all 5,018 and tap), my songs, or all songs, in one slim switch. The choice
 * is saved the moment it is made and drives the cards and the quiz without a song of their own; the
 * per-song steps are not touched. The deck line always says what the choice adds up to.
 * "Done" moves to a second view of the same screen: "Saved", the deck line and two clear next steps,
 * Word cards and Quiz, with "Change songs" to go back.
 */
export default function LearnScopeScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const top = useLearnTopInset()
  const bottomInset = useScrollBottomInset()
  const hydrated = useLearnHydrated()
  const { scope, summary, setScope } = useStudyScope()
  const inputRef = useRef<TextInput | null>(null)
  const [view, setView] = useState<"choose" | "ready">("choose")

  const picker = modeUsesPicker(scope.mode)
  const picked = useMemo(() => pickedNumbers(scope), [scope])
  const withWordsSet = useMemo(() => numbersWithWords(learnWordList()), [])

  const [index, setIndex] = useState<PickerIndex>({ status: "loading" })
  const [query, setQuery] = useState("")
  const [onlyWithWords, setOnlyWithWords] = useState(false)
  const deferred = useDeferredValue(query)

  // build the song index after the screen has opened, and only when a picker is needed
  const load = useCallback(() => {
    setIndex({ status: "loading" })
    const id = setTimeout(() => setIndex(buildIndex()), 0)
    return () => clearTimeout(id)
  }, [])
  useEffect(() => (picker ? load() : undefined), [picker, load])

  const results = useMemo<CatalogEntry[]>(() => {
    if (index.status !== "ready") return []
    const found = searchPicker(index.rows, deferred)
    return onlyWithWords ? found.filter((entry) => withWordsSet.has(entry.number)) : found
  }, [index, deferred, onlyWithWords, withWordsSet])

  const toggle = useCallback(
    (entry: CatalogEntry) => setScope(scope.mode === "song" ? pickOneSong(scope, entry.number) : toggleChosenSong(scope, entry.number)),
    [scope, setScope],
  )
  const setMode = (mode: string) => setScope(withMode(scope, mode as StudyMode))
  const modeOptions = useMemo(() => STUDY_MODES.map((mode) => ({ key: mode, label: t(`learn.scope.seg.${mode}`) })), [t])

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(LEARN_ROUTES.learn))
  }

  const renderItem = useCallback(
    ({ item }: { item: CatalogEntry }) => <PickerRow p={p} entry={item} listed={picked.has(item.number)} onToggle={toggle} study />,
    [p, picked, toggle],
  )

  const deck = deckLine(summary)
  const partial = partialLine(summary)
  const emptyWhy = emptyKind(summary)
  const count = index.status === "ready" ? t("songs.count", { count: results.length }) : ""

  const empty =
    index.status === "loading" ? (
      <View style={s.state} accessibilityLiveRegion="polite">
        <ActivityIndicator color={p.ink500} />
        <Text style={[s.stateText, { color: p.ink500 }]}>{t("learn.add.loading")}</Text>
      </View>
    ) : index.status === "error" ? (
      <View style={s.state}>
        <Text style={[s.stateText, { color: p.ink500 }]}>{t("learn.add.error")}</Text>
        <PressBox accessibilityRole="button" accessibilityLabel={t("common.tryAgain")} onPress={load} pressedScale={0.96} style={[s.stateButton, { backgroundColor: p.action }]}>
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
            setOnlyWithWords(false)
          }}
          pressedScale={0.96}
          style={[s.stateButton, { backgroundColor: p.action }]}
        >
          <Text style={[s.stateButtonText, { color: p.onAction }]}>{t("learn.add.clearSearch")}</Text>
        </PressBox>
      </View>
    )

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
          <Text style={{ color: p.ink800 }}>{t("learn.scope.heading.first")}</Text>
          <Text style={{ color: p.ink300 }}>{` ${t("learn.scope.heading.second")}`}</Text>
        </Text>
        {view === "choose" ? (
          <PressBox accessibilityRole="button" accessibilityLabel={t("common.done")} onPress={() => setView("ready")} pressedScale={0.95} style={[s.done, { backgroundColor: p.action }]}>
            <Text style={[s.doneText, { color: p.onAction }]}>{t("common.done")}</Text>
          </PressBox>
        ) : null}
      </View>

      {!hydrated ? null : view === "ready" ? (
        <View style={s.ready} accessibilityLiveRegion="polite">
          <View style={s.savedRow}>
            <View style={[s.savedDot, { backgroundColor: p.orange100 }]}>
              <Check size={14} color={p.orange700} strokeWidth={2.6} />
            </View>
            <Text style={[s.saved, { color: p.orange700 }]}>{t("learn.scope.saved")}</Text>
          </View>
          <Text style={[s.readyDeck, { color: p.ink800 }]}>{deck}</Text>
          {partial ? <Text style={[s.note, { color: p.ink500 }]}>{partial}</Text> : null}
          {emptyWhy ? (
            <Text style={[s.explain, s.plainText, { color: p.ink500 }]}>
              {emptyWhy === "none" ? t("learn.scope.empty.none.text") : t("learn.scope.empty.text")}
            </Text>
          ) : (
            <>
              <Text style={[s.explain, s.plainText, { color: p.ink500 }]}>{t("learn.scope.go.hint")}</Text>
              <View style={s.goRow}>
                <PressBox
                  accessibilityRole="button"
                  accessibilityLabel={t("learn.scope.go.cards")}
                  onPress={() => router.push(href(wordsHref()))}
                  pressedScale={0.96}
                  outerStyle={s.goOuter}
                  style={[s.go, { backgroundColor: p.action }]}
                >
                  <Text style={[s.goText, { color: p.onAction }]}>{t("learn.scope.go.cards")}</Text>
                </PressBox>
                <PressBox
                  accessibilityRole="button"
                  accessibilityLabel={t("learn.scope.go.quiz")}
                  onPress={() => router.push(href(quizHref()))}
                  pressedScale={0.96}
                  outerStyle={s.goOuter}
                  style={[s.go, { backgroundColor: p.white, borderColor: p.ink900, borderWidth: 1.5 }]}
                >
                  <Text style={[s.goText, { color: p.ink800 }]}>{t("learn.scope.go.quiz")}</Text>
                </PressBox>
              </View>
            </>
          )}
          <PressBox accessibilityRole="button" accessibilityLabel={t("learn.scope.go.change")} onPress={() => setView("choose")} pressedScale={0.96} style={s.change}>
            <Text style={[s.changeText, { color: p.orange700 }]}>{t("learn.scope.go.change")}</Text>
          </PressBox>
        </View>
      ) : (
        <>
          <Text style={[s.intro, { color: p.ink500 }]}>{t("learn.scope.intro")}</Text>
          <View style={s.segment}>
            <Segmented theme={theme} compact options={modeOptions} value={scope.mode} onChange={setMode} />
          </View>
          <Text style={[s.modeHint, { color: p.ink800 }]}>{t(`learn.scope.mode.${scope.mode}.d`)}</Text>
          <View style={s.deckBox} accessibilityLiveRegion="polite">
            <Text style={[s.deck, { color: p.ink800 }]}>{deck}</Text>
            {partial ? <Text style={[s.note, { color: p.ink500 }]}>{partial}</Text> : null}
          </View>

          {picker ? (
            <>
              <View style={s.searchRow}>
                <PickerSearch p={p} compact value={query} onChangeText={setQuery} inputRef={inputRef} />
              </View>
              <View style={s.filterRow}>
                <Text style={[s.count, { color: p.ink500 }]} numberOfLines={1} accessibilityLiveRegion="polite">
                  {count}
                </Text>
                {scope.mode === "chosen" && scope.chosen.length > 0 ? (
                  <PressBox accessibilityRole="button" accessibilityLabel={t("learn.scope.clear")} onPress={() => setScope(clearChosenSongs(scope))} pressedScale={0.95} style={s.clear}>
                    <Text style={[s.clearText, { color: p.orange700 }]}>{t("learn.scope.clear")}</Text>
                  </PressBox>
                ) : null}
                <AudioChip p={p} on={onlyWithWords} onPress={() => setOnlyWithWords((on) => !on)} label={t("learn.scope.withWords")} />
              </View>
              <FlatList
                data={results}
                extraData={picked}
                keyExtractor={(entry) => String(entry.number)}
                renderItem={renderItem}
                getItemLayout={(_data, i) => ({ length: PICKER_ROW_HEIGHT, offset: PICKER_ROW_HEIGHT * i, index: i })}
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
                contentContainerStyle={[s.listContent, { paddingBottom: bottomInset }]}
                style={s.list}
              />
            </>
          ) : scope.mode === "mine" ? (
            <View style={s.plain}>
              <PressBox
                accessibilityRole="button"
                accessibilityLabel={t("learn.scope.mine.add")}
                onPress={() => router.push(href(LEARN_ROUTES.addSong))}
                pressedScale={0.96}
                style={[s.stateButton, { backgroundColor: p.action }]}
              >
                <Text style={[s.stateButtonText, { color: p.onAction }]}>{t("learn.scope.mine.add")}</Text>
              </PressBox>
            </View>
          ) : null}
        </>
      )}
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
  intro: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: PICKER_INSET - 8, paddingBottom: 10 },
  segment: { paddingHorizontal: PICKER_INSET - 8 },
  modeHint: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, paddingHorizontal: PICKER_INSET - 8, paddingTop: 10 },
  deckBox: { paddingHorizontal: PICKER_INSET - 8, paddingTop: 8, paddingBottom: 10, gap: 1 },
  deck: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  searchRow: { height: SEARCH_H, paddingHorizontal: PICKER_INSET - 8, flexDirection: "row" },
  filterRow: { height: FILTER_H, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: PICKER_INSET - 8 },
  count: { flex: 1, fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
  clear: { height: 32, justifyContent: "center" },
  clearText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  ready: { paddingHorizontal: PICKER_INSET - 8, paddingTop: 20, gap: 10, alignItems: "flex-start" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  savedDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saved: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18, letterSpacing: 0.6, textTransform: "uppercase" },
  readyDeck: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.5, textTransform: "uppercase", fontVariant: ["tabular-nums"] },
  goRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", paddingTop: 6 },
  goOuter: { flex: 1 },
  go: { height: 52, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  goText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  change: { height: 44, justifyContent: "center" },
  changeText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
  list: { flex: 1 },
  listContent: { paddingBottom: 190 },
  explain: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, paddingHorizontal: PICKER_INSET, paddingBottom: 12, maxWidth: 360 },
  plain: { paddingHorizontal: PICKER_INSET - 8, paddingTop: 8, gap: 16, alignItems: "flex-start" },
  plainText: { paddingHorizontal: 0 },
  state: { paddingHorizontal: PICKER_INSET, paddingTop: 24, gap: 16, alignItems: "flex-start" },
  stateText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, maxWidth: 340 },
  stateButton: { height: 44, paddingHorizontal: 20, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  stateButtonText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
