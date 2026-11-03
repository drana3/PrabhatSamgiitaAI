import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { queryIsUseful, type SongSummary } from "@prabhat/core"

import {
  AnswerCard,
  EmptyState,
  HintLine,
  Message,
  ResultGroup,
} from "@/components/search-v2/SearchBlocks"
import { SearchField } from "@/components/search-v2/SearchField"
import { PressScale, Reveal } from "@/components/today/motion"
import { amGap, amSpace } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { api } from "@/lib/client"
import { warmLyricSearchIndex } from "@/lib/lyricSearch"
import {
  mergeMeaningRows,
  searchLocal,
  type SearchResultItem,
  type UnifiedResult,
} from "@/lib/unifiedSearch"
import { hintLine, parseSearchParams, withoutRecent } from "@/lib/unifiedSearchQuery"
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
    if (!local.wantsMeaning || trimmed.length < MIN_MEANING_CHARS || !queryIsUseful(trimmed, 200)) {
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
  const waitingForMeaning = meaning.pending && meaning.query === local.query

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
      router.push(href(`/song/${item.song.id}`))
    },
    [query, remember, router],
  )

  const empty = query.trim().length === 0
  let block = 0
  const next = () => block++

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <View style={[styles.gutter, styles.header]}>
        <Reveal index={next()} style={styles.fieldRow}>
          <SearchField
            theme={theme}
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
          />
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Close search"
            onPress={() => router.back()}
            pressedScale={0.94}
            style={styles.cancel}
          >
            <Text style={[amType.label, { color: theme.textHeading }]}>Cancel</Text>
          </PressScale>
        </Reveal>
        <Reveal index={next()}>
          <HintLine theme={theme} text={voiceError ?? hintLine(query, parsed.hint)} />
        </Reveal>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.gutter, styles.content]}
      >
        <Reveal index={next()}>
          {empty ? (
            <EmptyState
              theme={theme}
              recents={recents}
              onPick={pick}
              onRemoveRecent={(item: string) =>
                usePreferencesStore.setState({ searchRecents: withoutRecent(recents, item) })
              }
              onClearRecents={clearSearchRecents}
              onBrowseCollections={() => router.push(href("/collections"))}
            />
          ) : (
            <View style={styles.results}>
              {result.answer ? (
                <AnswerCard
                  theme={theme}
                  answer={result.answer}
                  onOpen={openItem}
                  onAsk={() => router.push(href("/(tabs)/ai"))}
                />
              ) : null}
              {result.groups.map((group) => (
                <ResultGroup
                  key={group.id}
                  theme={theme}
                  group={group}
                  onOpen={openItem}
                  onPickCollection={pick}
                />
              ))}
              {waitingForMeaning ? (
                <View style={styles.waiting} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={theme.brand} />
                  <Text style={[amType.body, { color: theme.textBody }]}>Looking for songs by meaning…</Text>
                </View>
              ) : null}
              {result.total === 0 && !waitingForMeaning && result.message ? (
                <Message theme={theme} text={result.message} />
              ) : null}
            </View>
          )}
        </Reveal>
        <View style={styles.tail} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  gutter: { paddingHorizontal: amGap.gutter },
  header: { gap: amSpace.s2, paddingBottom: amSpace.s3 },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: amSpace.s1 },
  cancel: { minHeight: amSpace.s12, paddingHorizontal: amSpace.s2, justifyContent: "center" },
  content: { paddingTop: amSpace.s2, gap: amGap.section },
  results: { gap: amGap.block + amSpace.s4 },
  waiting: { flexDirection: "row", alignItems: "center", gap: amSpace.s3 },
  tail: { height: amSpace.s24 },
})
