import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { queryIsUseful, type SongSummary } from "@prabhat/core"

import {
  AnswerCard,
  CollectionChips,
  DetectLabel,
  EmptyMessage,
  EmptyState,
  ResultList,
} from "@/components/search-v2/SearchBlocks"
import { SearchField } from "@/components/search-v2/SearchField"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, protoFor } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { api } from "@/lib/client"
import { flattenResults, sampleFlatResults } from "@/lib/searchProto"
import { SAMPLE_OFFLINE_NUMBERS } from "@/lib/fixtures/search"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { warmLyricSearchIndex } from "@/lib/lyricSearch"
import {
  mergeMeaningRows,
  searchLocal,
  type SearchResultItem,
  type UnifiedResult,
} from "@/lib/unifiedSearch"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { hintLine, outOfRangeMessage, parseSearchParams, withoutRecent } from "@/lib/unifiedSearchQuery"
import { useVoiceSearch } from "@/lib/useVoiceSearch"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

/** Local results are instant; the meaning lookup waits until typing pauses. */
const LOCAL_DEBOUNCE_MS = 40
const MEANING_DEBOUNCE_MS = 450
const MIN_MEANING_CHARS = 3
const FOCUS_DELAY_MS = 120
const LISTEN_DELAY_MS = 180
const IDLE_WARM_MS = 400

type MeaningState = { query: string; rows: SongSummary[]; pending: boolean }

/**
 * Unified search (spec SCR-13). One field takes a number, a name, a line of
 * lyrics or a feeling; there are no modes to choose. Redesign screen, reachable
 * at /search-v2 until Today and Songs point at it. Understands the Today
 * parameters `hint` (number | words | feeling), `q`, `focus` and `listen`.
 */
export default function UnifiedSearchScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const insets = useSafeAreaInsets()
  const top = insets.top || amProto.statusArea
  const reduce = useReducedMotion()
  const params = useLocalSearchParams<{ q?: string; hint?: string; focus?: string; listen?: string }>()
  const parsed = useMemo(
    () => parseSearchParams(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.q, params.hint, params.focus, params.listen],
  )

  const recents = usePreferencesStore((s) => s.searchRecents)
  const addSearchRecent = usePreferencesStore((s) => s.addSearchRecent)
  const clearSearchRecents = usePreferencesStore((s) => s.clearSearchRecents)

  const [query, setQuery] = useState(parsed.query)
  const [selectOnFocus, setSelectOnFocus] = useState(parsed.prefilled)
  const [local, setLocal] = useState<UnifiedResult>(() => searchLocal(parsed.query))
  const [meaning, setMeaning] = useState<MeaningState>({ query: "", rows: [], pending: false })
  const inputRef = useRef<TextInput>(null)
  const skipDebounce = useRef(true)

  // A new q / hint while the screen is open (router.setParams, deep link) replaces the field.
  const firstParams = useRef(true)
  useEffect(() => {
    if (firstParams.current) {
      firstParams.current = false
      return
    }
    skipDebounce.current = true
    setQuery(parsed.query)
    setSelectOnFocus(parsed.prefilled)
    setLocal(searchLocal(parsed.query))
  }, [parsed.query, parsed.prefilled])

  useEffect(() => {
    const idle = setTimeout(warmLyricSearchIndex, IDLE_WARM_MS)
    return () => clearTimeout(idle)
  }, [])

  useEffect(() => {
    if (!parsed.focus) return
    const handle = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS)
    return () => clearTimeout(handle)
  }, [parsed.focus])

  // Local search, on every change.
  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false
      return
    }
    const handle = setTimeout(() => setLocal(searchLocal(query)), LOCAL_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  // Meaning search from the server, streamed in after the local results.
  useEffect(() => {
    const trimmed = local.query
    if (MOCKUP_DATA || !local.wantsMeaning || trimmed.length < MIN_MEANING_CHARS || !queryIsUseful(trimmed, 200)) {
      setMeaning((prev) => (prev.pending ? { ...prev, pending: false } : prev))
      return
    }
    const abort = new AbortController()
    const handle = setTimeout(() => {
      setMeaning({ query: trimmed, rows: [], pending: true })
      api
        .searchSongs(trimmed, { mode: "semantic", signal: abort.signal })
        .then((rows: SongSummary[]) => setMeaning({ query: trimmed, rows, pending: false }))
        .catch(() => {
          // Keep the local results. A failed meaning lookup is not something the person can act on.
          if (!abort.signal.aborted) setMeaning({ query: trimmed, rows: [], pending: false })
        })
    }, MEANING_DEBOUNCE_MS)
    return () => {
      clearTimeout(handle)
      abort.abort()
    }
  }, [local.query, local.wantsMeaning])

  const result = useMemo(
    () => (meaning.query === local.query ? mergeMeaningRows(local, meaning.rows) : local),
    [local, meaning],
  )
  const waitingForMeaning = !MOCKUP_DATA && meaning.pending && meaning.query === local.query

  const remember = useCallback((value: string) => addSearchRecent(value), [addSearchRecent])

  const setText = useCallback((text: string) => {
    setSelectOnFocus(false)
    setQuery(text)
  }, [])

  const pick = useCallback(
    (text: string) => {
      Keyboard.dismiss()
      skipDebounce.current = true
      setSelectOnFocus(false)
      setQuery(text)
      setLocal(searchLocal(text))
      remember(text)
    },
    [remember],
  )

  const voice = useVoiceSearch({
    onPartial: (text: string) => setText(text),
    onFinal: (text: string) => {
      const transcript = text.trim()
      if (!transcript) return
      skipDebounce.current = true
      setQuery(transcript)
      setLocal(searchLocal(transcript))
      remember(transcript)
      // The server's voice matcher knows spoken Sanskrit spellings better than the local index.
      void api
        .searchSongsByVoice(transcript)
        .then((voiceResult: { matches: Array<{ song: SongSummary }> }) =>
          setMeaning((prev) => ({
            query: transcript,
            rows: [
              ...(prev.query === transcript ? prev.rows : []),
              ...voiceResult.matches.map((match) => match.song),
            ],
            pending: false,
          })),
        )
        .catch(() => undefined)
    },
    onUnavailable: () => inputRef.current?.focus(),
  })
  const { listening, error: voiceError, setError: setVoiceError, start, stop, toggle } = voice

  useFocusEffect(
    useCallback(() => {
      if (!parsed.listen) return
      const handle = setTimeout(() => void start(), LISTEN_DELAY_MS)
      return () => {
        clearTimeout(handle)
        stop()
      }
    }, [parsed.listen, start, stop]),
  )

  const openItem = useCallback(
    (item: SearchResultItem) => {
      remember(query)
      router.push(href(`/song-v2/${item.song.id}`))
    },
    [query, remember, router],
  )

  const offlineFiles = useOfflineAudioStore((state) => state.files)
  const offlineNumbers = useMemo(
    () => (MOCKUP_DATA ? SAMPLE_OFFLINE_NUMBERS : new Set(Object.values(offlineFiles).map((entry) => entry.songNumber))),
    [offlineFiles],
  )
  const empty = query.trim().length === 0
  const rows = useMemo(
    () => (MOCKUP_DATA ? sampleFlatResults(query) : flattenResults(result.groups)),
    [query, result.groups],
  )
  const collections = useMemo(
    () => (MOCKUP_DATA ? [] : result.groups.flatMap((group) => group.collections ?? [])),
    [result.groups],
  )

  // `.search`: the overlay drops in from 8dp above, 220ms (animation: searchin)
  const drop = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (!reduce) drop.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.22, 1, 0.36, 1) })
  }, [drop, reduce])
  const dropStyle = useAnimatedStyle(() => ({ opacity: drop.value, transform: [{ translateY: (1 - drop.value) * -8 }] }))

  return (
    <Animated.View style={[styles.safe, { backgroundColor: p.sand200, paddingTop: top }, dropStyle]}>
      <View style={styles.top}>
        <SearchField
          p={p}
          value={query}
          onChangeText={(text: string) => {
            setVoiceError(null)
            setText(text)
          }}
          onSubmit={() => remember(query)}
          onClear={() => {
            stop()
            setText("")
            setLocal(searchLocal(""))
            inputRef.current?.focus()
          }}
          onMic={() => void toggle()}
          listening={listening}
          selectOnFocus={selectOnFocus}
          inputRef={inputRef}
          bare={MOCKUP_DATA}
        />
        <TodayPress accessibilityRole="button" accessibilityLabel="Close search" onPress={() => router.back()} pressedScale={0.94} style={styles.cancel}>
          <Text style={[styles.cancelText, { color: p.ink800 }]}>Cancel</Text>
        </TodayPress>
      </View>
      <DetectLabel p={p} text={voiceError ?? hintLine(query, parsed.hint)} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {empty ? (
          <EmptyState
            p={p}
            recents={MOCKUP_DATA ? [] : recents}
            onPick={pick}
            onRemoveRecent={(item: string) => usePreferencesStore.setState({ searchRecents: withoutRecent(recents, item) })}
            onClearRecents={clearSearchRecents}
          />
        ) : (
          <View style={styles.results}>
            {!MOCKUP_DATA && result.answer ? (
              <AnswerCard p={p} answer={result.answer} onOpen={openItem} onAsk={() => router.push(href("/assistant"))} />
            ) : null}
            {rows.length ? <ResultList p={p} rows={rows} offlineNumbers={offlineNumbers} onOpen={openItem} /> : null}
            {collections.length ? <CollectionChips p={p} names={collections} onPick={pick} /> : null}
            {waitingForMeaning ? (
              <View style={styles.waiting} accessibilityLiveRegion="polite">
                <ActivityIndicator color={p.orange500} />
                <Text style={[styles.waitingText, { color: p.ink500 }]}>Looking for songs by meaning…</Text>
              </View>
            ) : null}
            {rows.length === 0 && !waitingForMeaning && (MOCKUP_DATA || !result.answer) ? <EmptyMessage p={p} text={!MOCKUP_DATA && result.message === outOfRangeMessage() ? result.message : null} /> : null}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 8, paddingLeft: 10, paddingRight: 6 },
  cancel: { height: 56, paddingHorizontal: 14, justifyContent: "center" },
  cancelText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 18 },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  results: { gap: 24 },
  waiting: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20 },
  waitingText: { fontFamily: amFonts.medium, fontSize: 16 },
})
