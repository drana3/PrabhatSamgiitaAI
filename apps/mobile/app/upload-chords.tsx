import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import { ChartPreview } from "@/components/song-chords/ChartPreview"
import { ChordPalette } from "@/components/song-chords/ChordPalette"
import { ChordPasteBox } from "@/components/song-chords/ChordPasteBox"
import { ChordSlotEditor, type Slot } from "@/components/song-chords/ChordSlotEditor"
import { ActionButton, CheckRow, Chip, CORNER, Hint, Label } from "@/components/song-chords/parts"
import { PsSongChooser } from "@/components/kirtan/add/PsSongChooser"
import { KPress } from "@/components/kirtan/KPress"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useChordTeam } from "@/hooks/useChordTeam"
import { useSongLyrics } from "@/hooks/useSongLyrics"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { chordFailure, chordsBackend, previewName } from "@/lib/songChords/backend"
import { ROOTS, usedChords } from "@/lib/songChords/chordName"
import type { ParseMeta } from "@/lib/songChords/chordPro"
import {
  NOTE_MAX,
  STRUM_MAX,
  countChords,
  draftProblems,
  fitLines,
  linesWithChords,
  newDraft,
  nextSlot,
  previousSlot,
  replaceLines,
  setCapo,
  setChord,
  setInstrument,
  soundingKey,
  toPayload,
  type Draft,
  type DraftProblem,
  type Placement,
} from "@/lib/songChords/draft"
import type { ChordFailure, ChordProposal } from "@/lib/songChords/types"
import { splitWords } from "@/lib/songPage/chordChart"
import { MAX_CAPO } from "@/lib/songPage/chords"
import { useAuthStore } from "@/stores/authStore"
import { useChordDraftStore } from "@/stores/chordDraftStore"
import { href } from "@/utils/href"

const CloseGlyph = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
  </Svg>
)

/**
 * Offer chords for a Prabhat Samgiita song (docs/chord-proposals.md). One scrolling sheet, top to bottom: which song,
 * which instrument, the key (and capo for a guitar), the chords (tap the words of the song, or paste text), a preview
 * drawn by the song page's own chord view, then "I played it", a note, anonymous or not, and Send.
 * The unfinished chart is kept on the device (stores/chordDraftStore), so leaving does not lose it.
 */
export default function UploadChordsScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const spTheme = useSpTheme()
  const insets = useSafeAreaInsets()
  const top = Platform.OS === "web" ? 24 : Math.max(insets.top, 16)
  const params = useLocalSearchParams<{ song?: string }>()

  const signedIn = useAuthStore((s) => s.mode === "signed_in") || MOCKUP_DATA
  const displayName = useAuthStore((s) => s.displayName)
  const name = MOCKUP_DATA ? previewName() : displayName && displayName !== "Guest" ? displayName : ""
  const { team } = useChordTeam(signedIn)

  const stored = useChordDraftStore((s) => s.draft)
  const storeDraft = useChordDraftStore.getState().setDraft

  const songParam = Number(params.song)
  const [restored, setRestored] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => {
    const wanted = Number.isInteger(songParam) && songParam > 0 ? songParam : null
    if (stored && (wanted === null || stored.songId === wanted)) return stored
    return newDraft(wanted)
  })
  useEffect(() => {
    if (stored && stored.songId === draft.songId && countChords(stored) > 0) setRestored(true)
    // only the first render decides whether the draft was brought back
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the unfinished chart on the device (a short pause after the last change, not on every tap)
  useEffect(() => {
    const id = setTimeout(() => storeDraft(draft), 400)
    return () => clearTimeout(id)
  }, [draft, storeDraft])

  const lyrics = useSongLyrics(draft.songId)
  const lines = lyrics.status === "ready" ? lyrics.lines : null
  const counts = lyrics.status === "ready" ? lyrics.wordCounts : []
  useEffect(() => {
    if (lyrics.status === "ready") setDraft((d) => fitLines(d, lyrics.lines.length))
  }, [lyrics])

  const [chooser, setChooser] = useState(false)
  const [entry, setEntry] = useState<"tap" | "paste">("tap")
  const [selected, setSelected] = useState<Slot | null>(null)
  const [showProblems, setShowProblems] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<ChordFailure | null>(null)
  const [sent, setSent] = useState<ChordProposal | null>(null)
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  const patch = useCallback((change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change })), [])
  const total = countChords(draft)
  const problems: DraftProblem[] = useMemo(() => draftProblems(draft, counts), [draft, counts])
  const used = useMemo(() => usedChords(draft.lines), [draft.lines])
  const guitar = draft.instrument === "guitar"
  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/upload")))

  const selectedWord = useMemo(() => {
    if (!selected || !lines) return null
    return splitWords(lines[selected.line] ?? "")[selected.word] ?? null
  }, [selected, lines])
  const currentChord = selected ? (draft.lines[selected.line]?.find((p) => p.word === selected.word)?.chord ?? null) : null

  const pick = (chord: string | null) => {
    if (!selected) return
    setDraft((d) => setChord(d, selected.line, selected.word, chord))
  }
  const move = (to: Slot | null) => {
    if (to) setSelected(to)
  }

  const applyPasted = (pasted: Placement[][], meta: ParseMeta) => {
    setDraft((d) => {
      let next = replaceLines(d, pasted)
      if (meta.capo !== undefined && next.instrument === "guitar") next = setCapo(next, meta.capo)
      if (meta.key) next = { ...next, key: meta.key }
      if (meta.strum && next.instrument === "guitar") next = { ...next, strum: meta.strum.slice(0, STRUM_MAX) }
      return next
    })
    setEntry("tap")
  }

  const send = async () => {
    setFailure(null)
    if (problems.length) {
      setShowProblems(true)
      return
    }
    setBusy(true)
    try {
      const proposal = await chordsBackend().offer(toPayload(draft, counts))
      if (!alive.current) return
      storeDraft(null)
      setSent(proposal)
    } catch (error) {
      if (alive.current) setFailure(chordFailure(error))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const another = () => {
    const fresh = { ...newDraft(null), instrument: draft.instrument, key: draft.key, capo: draft.capo }
    setDraft(fresh)
    storeDraft(null)
    setSent(null)
    setSelected(null)
    setShowProblems(false)
    setRestored(false)
  }
  const startOver = () => {
    setDraft(newDraft(draft.songId))
    setSelected(null)
    setRestored(false)
    setShowProblems(false)
  }

  const payloadForPreview = useMemo(() => {
    if (!lines || total === 0) return null
    const payload = toPayload({ ...draft, songId: draft.songId ?? 0 }, counts)
    return { baseKey: payload.baseKey, strum: payload.strum, lines: payload.lines, instrument: payload.instrument }
  }, [lines, total, draft, counts])

  const problemText = (p: DraftProblem) => t(`chordOffer.problem.${p}`)
  const dockOpen = entry === "tap" && selected !== null && lines !== null && selectedWord !== null && !sent

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: top }]}>
        <View style={[s.handle, { backgroundColor: theme.dark ? "rgba(255,255,255,0.22)" : amColors.sand400 }]} />
        <KPress accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={close} pressedScale={0.9} outerStyle={s.close} style={[s.closeDisc, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <CloseGlyph color={theme.textHeading} />
        </KPress>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: (dockOpen ? 24 : Math.max(insets.bottom, 16)) + 40 }]}>
        <Reveal index={0}>
          <Text style={[s.over, { color: theme.accent }]}>{t("chordOffer.over")}</Text>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("chordOffer.title")}
          </Text>
        </Reveal>

        {!signedIn ? (
          <View style={s.field}>
            <Text style={[s.h2, { color: theme.textHeading }]}>{t("chordOffer.signin.title")}</Text>
            <Hint theme={theme}>{t("chordOffer.signin.body")}</Hint>
            <ActionButton theme={theme} label={t("chordOffer.signin.action")} onPress={() => router.push(href("/signin"))} />
          </View>
        ) : sent ? (
          <View style={s.field} accessibilityLiveRegion="polite">
            <Text style={[s.h2, { color: theme.textHeading }]}>{t("chordOffer.sent.title")}</Text>
            <Text style={[s.body, { color: theme.textBody }]}>{sent.status === "published" ? t("chordOffer.sent.published") : t("chordOffer.sent.pending")}</Text>
            <ActionButton theme={theme} label={t("chordOffer.sent.open")} onPress={() => router.replace(href(`/song-v2/ps-${sent.songId}`))} />
            <ActionButton theme={theme} tone="quiet" label={t("chordOffer.sent.again")} onPress={another} />
            <ActionButton theme={theme} tone="quiet" label={t("chordOffer.sent.hub")} onPress={() => router.replace(href("/upload"))} />
          </View>
        ) : (
          <>
            <Reveal index={1} style={s.field}>
              <Hint theme={theme}>{t("chordOffer.intro")}</Hint>
              {team ? <Hint theme={theme}>{t("chordOffer.intro.team")}</Hint> : null}
              {restored && draft.songId ? (
                <View style={[s.note, { borderColor: theme.line, backgroundColor: theme.card }]}>
                  <Text style={[s.noteText, { color: theme.textHeading }]}>{t("chordOffer.draft.restored", { number: draft.songId })}</Text>
                  <Chip theme={theme} role="button" label={t("chordOffer.draft.discard")} onPress={startOver} />
                </View>
              ) : null}
            </Reveal>

            {/* 1. the song */}
            <Reveal index={2} style={s.field}>
              <Label theme={theme}>{t("chordOffer.song.label")}</Label>
              <KPress
                accessibilityRole="button"
                accessibilityLabel={draft.songId ? t("chordOffer.song.a11y", { number: draft.songId, title: lyrics.status === "ready" || lyrics.status === "none" ? lyrics.title : "" }) : t("chordOffer.song.none")}
                onPress={() => setChooser(true)}
                pressedScale={0.99}
                style={[s.inputBox, { backgroundColor: theme.card, borderColor: showProblems && problems.includes("noSong") ? amColors.danger : theme.line }]}
              >
                <Text style={[s.songName, { color: draft.songId ? theme.textHeading : theme.textBody }]} numberOfLines={1}>
                  {draft.songId ? (lyrics.status === "ready" || lyrics.status === "none" ? t("chordOffer.songTitle", { number: draft.songId, title: lyrics.title }) : t("chordOffer.song", { number: draft.songId })) : t("chordOffer.song.none")}
                </Text>
                <View style={[s.pasteBtn, { backgroundColor: theme.peach }]}>
                  <Text style={[s.pasteText, { color: theme.accent }]}>{draft.songId ? t("chordOffer.song.change") : t("chordOffer.song.choose")}</Text>
                </View>
              </KPress>
              <Hint theme={theme}>{t("chordOffer.song.hint")}</Hint>
            </Reveal>

            {/* 2. instrument */}
            <Reveal index={3} style={s.field}>
              <Label theme={theme}>{t("chordOffer.instrument.label")}</Label>
              <View style={s.chips} accessibilityRole="radiogroup">
                <Chip theme={theme} label={t("chordOffer.instrument.guitar")} on={guitar} minWidth={120} onPress={() => patch(setInstrument(draft, "guitar"))} />
                <Chip theme={theme} label={t("chordOffer.instrument.harmonium")} on={!guitar} minWidth={120} onPress={() => patch(setInstrument(draft, "harmonium"))} />
              </View>
            </Reveal>

            {/* 3. key and capo */}
            <Reveal index={4} style={s.field}>
              <Label theme={theme}>{guitar ? t("chordOffer.key.guitar.label") : t("chordOffer.key.harmonium.label")}</Label>
              <View style={s.chips} accessibilityRole="radiogroup">
                {ROOTS.map((root) => (
                  <Chip key={root} theme={theme} label={root} on={draft.key === root} a11y={t("chordOffer.key.a11y", { key: root })} minWidth={52} onPress={() => patch({ key: root })} />
                ))}
              </View>
              <Hint theme={theme}>{guitar ? t("chordOffer.key.guitar.hint") : t("chordOffer.key.harmonium.hint")}</Hint>
              {guitar ? (
                <>
                  <Label theme={theme}>{t("chordOffer.capo.label")}</Label>
                  <View style={s.stepper}>
                    <Chip theme={theme} role="button" label="−" a11y={t("chordOffer.capo.lower")} minWidth={52} onPress={() => patch(setCapo(draft, draft.capo - 1))} />
                    <Text style={[s.capoValue, { color: theme.textHeading }]} accessibilityLiveRegion="polite">
                      {draft.capo === 0 ? t("chordOffer.capo.none") : t("chordOffer.capo.fret", { capo: draft.capo })}
                    </Text>
                    <Chip theme={theme} role="button" label="+" a11y={t("chordOffer.capo.raise")} minWidth={52} onPress={() => patch(setCapo(draft, Math.min(MAX_CAPO, draft.capo + 1)))} />
                  </View>
                  {draft.capo > 0 ? <Hint theme={theme}>{t("chordOffer.capo.sounds", { key: soundingKey(draft) })}</Hint> : null}
                  <Label theme={theme}>{t("chordOffer.strum.label")}</Label>
                  <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: showProblems && problems.includes("strumShape") ? amColors.danger : theme.line }]}>
                    <TextInput
                      value={draft.strum}
                      onChangeText={(text) => patch({ strum: text.slice(0, STRUM_MAX) })}
                      placeholder={t("chordOffer.strum.placeholder")}
                      placeholderTextColor={theme.textMuted}
                      accessibilityLabel={t("chordOffer.strum.label")}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={STRUM_MAX}
                      style={[s.input, { color: theme.textHeading }]}
                    />
                  </View>
                  <Hint theme={theme}>{t("chordOffer.strum.hint")}</Hint>
                </>
              ) : null}
            </Reveal>

            {/* 4. the chords */}
            <Reveal index={5} style={s.field}>
              <Label theme={theme}>{t("chordOffer.chords.label")}</Label>
              <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("chordOffer.chords.mode.a11y")}>
                <Chip theme={theme} label={t("chordOffer.chords.mode.tap")} on={entry === "tap"} minWidth={130} onPress={() => setEntry("tap")} />
                <Chip theme={theme} label={t("chordOffer.chords.mode.paste")} on={entry === "paste"} minWidth={130} onPress={() => setEntry("paste")} />
              </View>
              {lyrics.status === "idle" ? <Hint theme={theme}>{t("chordOffer.lyrics.pick")}</Hint> : null}
              {lyrics.status === "loading" ? <Hint theme={theme}>{t("chordOffer.lyrics.loading")}</Hint> : null}
              {lyrics.status === "error" ? <Hint theme={theme} tone="danger">{t("chordOffer.lyrics.error")}</Hint> : null}
              {lyrics.status === "none" ? <Hint theme={theme} tone="danger">{t("chordOffer.lyrics.none")}</Hint> : null}
              {lines ? (
                entry === "tap" ? (
                  <>
                    <Hint theme={theme}>{t("chordOffer.chords.tapHint")}</Hint>
                    <ChordSlotEditor theme={theme} lines={lines} placements={draft.lines} selected={selected} onSelect={setSelected} />
                  </>
                ) : (
                  <ChordPasteBox theme={theme} lyricLines={lines} placements={draft.lines} onApply={applyPasted} />
                )
              ) : null}
              {lines ? (
                <Text style={[s.count, { color: theme.textBody }]} accessibilityLiveRegion="polite">
                  {t("chordOffer.chords.count", { count: total })}
                  {total > 0 ? ` · ${linesWithChords(draft)}/${lines.length}` : ""}
                </Text>
              ) : null}
            </Reveal>

            {/* 5. the preview */}
            {lines ? (
              <View style={s.field}>
                <Text style={[s.h2, { color: theme.textHeading }]} accessibilityRole="header">
                  {t("chordOffer.preview.title")}
                </Text>
                {payloadForPreview ? (
                  <>
                    <Hint theme={theme}>{t("chordOffer.preview.hint")}</Hint>
                    <ChartPreview
                      t={spTheme}
                      romanLines={lines}
                      proposal={payloadForPreview}
                      capo={guitar ? draft.capo : 0}
                      harmoniumKey={draft.key}
                      caption={guitar ? (draft.capo > 0 ? t("chordOffer.preview.summary.guitar", { capo: draft.capo }) : t("chordOffer.preview.summary.guitarNoCapo")) : t("chordOffer.preview.summary.harmonium", { key: draft.key })}
                    />
                  </>
                ) : (
                  <Hint theme={theme}>{t("chordOffer.preview.empty")}</Hint>
                )}
              </View>
            ) : null}

            {/* 6. confirm and send */}
            <View style={s.field}>
              <CheckRow theme={theme} on={draft.playedIt} label={t("chordOffer.played.label")} onToggle={() => patch({ playedIt: !draft.playedIt })} invalid={showProblems && problems.includes("notPlayed")} />
              <Label theme={theme}>{t("chordOffer.note.label")}</Label>
              <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: theme.line, alignItems: "flex-start" }]}>
                <TextInput
                  value={draft.note}
                  onChangeText={(text) => patch({ note: text.slice(0, NOTE_MAX) })}
                  placeholder={t("chordOffer.note.placeholder")}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("chordOffer.note.label")}
                  maxLength={NOTE_MAX}
                  multiline
                  style={[s.input, s.noteInput, { color: theme.textHeading }]}
                />
              </View>
              <Hint theme={theme}>{t("chordOffer.note.left", { count: NOTE_MAX - draft.note.length })}</Hint>
              <CheckRow theme={theme} on={draft.isAnonymous} label={t("chordOffer.anonymous.label")} onToggle={() => patch({ isAnonymous: !draft.isAnonymous })} />
              <Hint theme={theme}>{draft.isAnonymous ? t("chordOffer.as.anonymous") : name ? t("chordOffer.as.named", { name }) : t("chordOffer.as.namedNoName")}</Hint>

              {showProblems && problems.length ? (
                <View accessibilityLiveRegion="polite" style={s.problems}>
                  {problems.map((p) => (
                    <Hint key={p} theme={theme} tone="danger">
                      {problemText(p)}
                    </Hint>
                  ))}
                </View>
              ) : null}
              {failure ? (
                <Hint theme={theme} tone="danger">
                  {t(`chordOffer.failure.${failure}`)}
                </Hint>
              ) : null}
              {failure === "signin" ? <ActionButton theme={theme} tone="quiet" label={t("chordOffer.signin.action")} onPress={() => router.push(href("/signin"))} /> : null}
              <ActionButton theme={theme} label={busy ? t("chordOffer.sending") : t("chordOffer.send")} onPress={() => void send()} disabled={busy} busy={busy} />
            </View>
          </>
        )}
      </ScrollView>

      {dockOpen && selected && lines && selectedWord ? (
        <ChordPalette
          theme={theme}
          word={selectedWord}
          current={currentChord}
          keyName={draft.key}
          used={used}
          onPick={pick}
          onClear={() => pick(null)}
          onPrevious={previousSlot(counts, selected.line, selected.word) ? () => move(previousSlot(counts, selected.line, selected.word)) : null}
          onNext={nextSlot(counts, selected.line, selected.word) ? () => move(nextSlot(counts, selected.line, selected.word)) : null}
          onDone={() => setSelected(null)}
        />
      ) : null}

      <PsSongChooser
        visible={chooser}
        selected={draft.songId}
        onClose={() => setChooser(false)}
        onPick={(song) => {
          setChooser(false)
          setSelected(null)
          setSent(null)
          setRestored(false)
          setDraft((d) => (d.songId === song.number ? d : { ...newDraft(song.number), instrument: d.instrument, key: d.key, capo: d.capo, strum: d.strum }))
        }}
      />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { alignItems: "center", paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3, marginTop: 4 },
  close: { position: "absolute", right: 16, top: Platform.OS === "web" ? 18 : undefined },
  closeDisc: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  h2: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.3, textTransform: "uppercase" },
  body: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
  field: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  capoValue: { minWidth: 110, textAlign: "center", fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  inputBox: { minHeight: 56, borderRadius: CORNER, borderWidth: 1.5, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  songName: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  pasteBtn: { height: 40, paddingHorizontal: 16, borderRadius: CORNER, alignItems: "center", justifyContent: "center" },
  pasteText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  note: { borderWidth: 1.5, borderRadius: CORNER, padding: 12, gap: 8, alignItems: "flex-start" },
  noteText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  count: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  problems: { gap: 4 },
})
