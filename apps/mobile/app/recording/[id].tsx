import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { AddLanguagePrompt } from "@/components/kirtan/AddLanguagePrompt"
import { MoodBlock } from "@/components/kirtan/MoodBlock"
import { PracticeBlock } from "@/components/kirtan/PracticeBlock"
import { RecordingHero } from "@/components/kirtan/RecordingHero"
import { RecordingTags } from "@/components/kirtan/RecordingTags"
import { RecordingFacts } from "@/components/kirtan/RecordingFacts"
import { FromBroadcastMark } from "@/components/broadcasts/FromBroadcastMark"
import { ChordCardSheet } from "@/components/chords/ChordCardSheet"
import { CommentsView } from "@/components/comments/CommentsView"
import { useComments } from "@/components/comments/useComments"
import { AddVideoSheet } from "@/components/recording-extras/AddVideoSheet"
import { BlockStack } from "@/components/common/Layout"
import { ChordsBlock } from "@/components/recording-extras/ChordsBlock"
import { CycleBlock } from "@/components/recording-extras/CycleBlock"
import { PianoBlock } from "@/components/piano/PianoBlock"
import { KiirtanTabs } from "@/components/recording-extras/KiirtanTabs"
import { Viewer } from "@/components/recording-extras/RecordingChordsSheet"
import { VideosSection } from "@/components/recording-extras/VideosSection"
import { useRecordingSheets, type SheetsController } from "@/components/recording-extras/useRecordingSheets"
import { useVideos } from "@/components/recording-extras/useVideos"
import { useVideoWatch } from "@/components/recording-extras/useVideoWatch"
import { VideoBlock } from "@/components/recording-extras/VideoBlock"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { SpPress } from "@/components/song-v2/SpUi"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useT } from "@/lib/i18n"
import { allKirtans } from "@/lib/kirtan/catalog"
import { kindHasChords } from "@/lib/kirtan/kind"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { SCREEN_SIDE } from "@/lib/layout"
import { chordInstrumentOf, type ChordInstrument } from "@/lib/chordCard/instrument"
import { isCycle, tuneLine } from "@/lib/recordingChords/cycle"
import { kindHasCharts, kindHasCycle } from "@/lib/recordingChords/kinds"
import { featuredVideo } from "@/lib/recordingVideos/embed"
import { apiIdOf, cycleFormHref, sheetFormHref } from "@/lib/recordingExtras/links"
import { openingTab, type KiirtanTab } from "@/lib/recordingExtras/kiirtanTabs"
import { recordingCommentFailure, recordingCommentsBackend } from "@/lib/recordingComments/backend"
import type { RecordingComment } from "@/lib/recordingComments/types"
import { href } from "@/utils/href"

/**
 * One recording's page (docs/recording-extras.md, docs/kiirtan-cycle.md): the picture, the title and performer, the tags and
 * a Play button, then the things members add to it. A Kiirtan has a headline video with a chord line, its other video links, the
 * chord cycle (every form as a ring) and comments; the other kinds keep their chord sheet, video links and comments. The recording is found by the app's id or by the server's. A recording
 * that is not on the server yet (still going up, or failed) has nothing to attach to, and the page says so instead of
 * showing empty blocks that cannot work. The mini-player never covers the end of the page (useScrollBottomInset).
 */
export default function RecordingPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const param = typeof id === "string" ? id : ""
  const recording = useMemo(() => allKirtans().find((k) => k.id === param || k.serverId === param) ?? null, [param])
  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/kiirtan")))
  const upOnServer = Boolean(recording && recording.status === "published" && (recording.serverId || MOCKUP_DATA))
  return recording && upOnServer ? <Ready recording={recording} onClose={close} /> : <Plain recording={recording} onClose={close} />
}

/** The page of a recording that cannot take extras (not found, or not on the server yet): the title and one honest line. */
function Plain({ recording, onClose }: { recording: Kirtan | null; onClose: () => void }) {
  const tr = useT()
  const theme = useSongsTheme()
  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={tr("recChords.close")} onClose={onClose} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {recording ? (
          <Text style={[styles.h1, styles.pad, { color: theme.textHeading }]} accessibilityRole="header">
            {recording.title}
          </Text>
        ) : null}
        <Text style={[styles.note, { color: theme.textBody }]} accessibilityRole={recording ? undefined : "alert"}>
          {tr(recording ? "recPage.notUp" : "recPage.missing")}
        </Text>
      </ScrollView>
    </View>
  )
}

function Ready({ recording, onClose }: { recording: Kirtan; onClose: () => void }) {
  const tr = useT()
  const theme = useSongsTheme()
  const t = useSpTheme()
  const router = useRouter()
  const actions = useKirtanActions()
  const bottomInset = useScrollBottomInset(24)
  const apiId = apiIdOf(recording)
  const sheets = useRecordingSheets(apiId)
  const videos = useVideos({ kind: "recording", id: apiId })
  const watch = useVideoWatch()
  const comments = useComments<RecordingComment, string>(apiId, recordingCommentsBackend, recordingCommentFailure)
  const [viewing, setViewing] = useState(false)
  const [adding, setAdding] = useState(false)
  // "somebody replied to your comment" opens this page with `?comment=`: the comments are the end of the page, so go there
  const { comment: openedFromReply, tab: openedOnTab } = useLocalSearchParams<{ comment?: string | string[]; tab?: string | string[] }>()
  const focus = typeof openedFromReply === "string" && openedFromReply ? openedFromReply : null
  // a Kiirtan's page has four tabs (Chords, Video, Notes, Story); it opens on Chords, or on Story for a reply to a comment
  const [tab, setTab] = useState<KiirtanTab>(() => openingTab({ tab: openedOnTab, focus: Boolean(focus) }))
  // the chord card: which chord is open (null = closed), the chords of its tune for the strip, and the instrument it is drawn for
  const [card, setCard] = useState<{ chord: string; chords: string[] } | null>(null)
  const [cardInstrument, setCardInstrument] = useState<ChordInstrument>("guitar")
  const scroller = useRef<ScrollView>(null)
  useEffect(() => {
    if (!focus || tab !== "story") return
    const timers = [setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 700), setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 1800)]
    return () => timers.forEach(clearTimeout)
  }, [focus, tab])

  // coming back from the "Add chords" screen shows the new chart (the first focus is the load the hook already did)
  const first = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (!first.current) void sheets.reload()
      first.current = false
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  )

  // A Kiirtan has a chord CYCLE (docs/kiirtan-cycle.md) and a headline video with a short chord line (docs/kiirtan-video.md).
  // Every other kind keeps its chord sheet and its video list.
  const cycleKind = kindHasCycle(recording.kind)
  const goCycle = (target: { edit?: string; copy?: string; from?: string; instrument?: string; tune?: number } = {}) => router.push(href(cycleFormHref({ recordingId: apiId, title: recording.title, ...target })))
  const live = useMemo(() => sheets.state.items.filter((x) => isCycle(x) && x.status === "published"), [sheets.state.items])
  const firstForm = live.find((x) => x.instrument === "guitar") ?? live[0]
  const chordLine = firstForm?.cycle?.tunes[0] ? tuneLine(firstForm.cycle.tunes[0]) : null
  const headline = cycleKind ? featuredVideo(videos.state.items) : null
  // the text viewer of a Kiirtan lists only its older plain-text sheets; the cycle has its own block
  const textSheets = useMemo<SheetsController>(() => ({ ...sheets, state: { ...sheets.state, items: sheets.state.items.filter((x) => !isCycle(x)) } }), [sheets])

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={tr("recChords.close")} onClose={onClose} />
      <ScrollView ref={scroller} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0}>
          <RecordingHero theme={theme} kirtan={recording} />
        </Reveal>
        <Reveal index={1}>
          <BlockStack gap={16} side={SCREEN_SIDE} style={styles.under}>
            <RecordingTags theme={theme} kirtan={recording} />
            <RecordingFacts theme={theme} kirtan={recording} />
            {/* Play and "How does it feel?" share one row: the mood block is a menu that opens under it, not a card that is always there */}
            <MoodBlock
              theme={theme}
              kirtan={recording}
              collapsible
              leading={
                <SpPress onPress={() => actions.open(recording, [recording], recording.title)} accessibilityLabel={tr("recPage.play")} style={[styles.play, { backgroundColor: t.action }]}>
                  <Text style={[styles.playText, { color: t.onAction }]}>{tr("recPage.play")}</Text>
                </SpPress>
              }
            />
          </BlockStack>
        </Reveal>
        {/* a recording made from a live broadcast says so (docs/broadcasts.md); nothing for any other */}
        <FromBroadcastMark recordingId={apiId} theme={theme} />
        <AddLanguagePrompt theme={theme} kirtan={recording} variant="card" />
        <PracticeBlock theme={theme} kirtan={recording} />
        {cycleKind ? (
          <>
            {/* a Kiirtan's page has four tabs, Chords first: the chord cycle is the first thing under the title */}
            <Reveal index={2}>
              <View style={styles.tabs}>
                <KiirtanTabs t={t} value={tab} onChange={setTab} />
              </View>
            </Reveal>
            {tab === "chords" ? (
              <CycleBlock
                t={t}
                title={tr("recCycle.block.title")}
                sheets={sheets}
                onAdd={() => goCycle({ instrument: firstForm?.instrument })}
                onChange={(sheet) => goCycle({ edit: sheet.id })}
                onCopy={(sheet) => goCycle({ copy: sheet.id })}
                onFrom={(sheet, tune) => goCycle({ from: sheet.id, instrument: sheet.instrument, tune })}
                onOpenText={() => setViewing(true)}
                cardInstrument={cardInstrument}
                onCardInstrument={setCardInstrument}
                onOpenChord={(chord, chords) => setCard({ chord, chords })}
              />
            ) : null}
            {tab === "video" ? (
              <>
                <VideoBlock t={t} videos={videos} watch={watch} chordLine={chordLine} onAdd={() => setAdding(true)} onFlash={actions.flash} />
                <View style={styles.block}>
                  <VideosSection t={t} videos={videos} watch={watch} title={tr("recVideos.more")} skipId={headline?.id ?? null} onAdd={() => setAdding(true)} onFlash={actions.flash} />
                </View>
              </>
            ) : null}
            {tab === "notes" ? (
              <View style={styles.block}>
                <PianoBlock t={t} target={{ kind: "recording", id: apiId }} title={recording.title} />
              </View>
            ) : null}
            {tab === "story" ? (
              <View style={styles.block}>
                <CommentsView t={t} comments={comments} words="recordingComments" testID="recording-comments" focus={focus} />
              </View>
            ) : null}
          </>
        ) : (
          <>
            {/* chords: Bhajan, Prabhat Samgiita and Spiritual song; not a Dance music or a Baba's Audio Discourse (lib/kirtan/kind.ts kindHasChords) */}
            {kindHasChords(recording.kind) ? (
              <Reveal index={1}>
                <View style={styles.block}>
                  <ChordsBlock t={t} sheets={sheets} onOpen={() => setViewing(true)} onAdd={() => router.push(href(sheetFormHref({ chart: kindHasCharts(recording.kind), recordingId: apiId, title: recording.title })))} />
                </View>
              </Reveal>
            ) : null}
            <Reveal index={2}>
              <View style={styles.block}>
                <VideosSection t={t} videos={videos} watch={watch} onAdd={() => setAdding(true)} onFlash={actions.flash} />
              </View>
            </Reveal>
          </>
        )}
        {/* piano notes: the same kinds as chords (docs/piano-notation.md); a Kiirtan has them in its Notes tab */}
        {kindHasChords(recording.kind) && !cycleKind ? (
          <Reveal index={2}>
            <View style={styles.block}>
              <PianoBlock t={t} target={{ kind: "recording", id: apiId }} title={recording.title} />
            </View>
          </Reveal>
        ) : null}
        {cycleKind ? null : (
          <Reveal index={3}>
            <View style={styles.block}>
              <CommentsView t={t} comments={comments} words="recordingComments" testID="recording-comments" focus={focus} />
            </View>
          </Reveal>
        )}
      </ScrollView>
      {/* the sheets sit over the whole page, not inside the scrolling list */}
      <Viewer t={t} sheets={cycleKind ? textSheets : sheets} recordingId={apiId} title={recording.title} visible={viewing} onClose={() => setViewing(false)} />
      {cycleKind ? <ChordCardSheet t={t} chord={card?.chord ?? null} chords={card?.chords} instrument={cardInstrument} onInstrument={(next) => setCardInstrument(chordInstrumentOf(next))} onChord={(chord) => setCard((c) => (c ? { ...c, chord } : c))} onClose={() => setCard(null)} /> : null}
      <AddVideoSheet t={t} visible={adding} onClose={() => setAdding(false)} videos={videos} onAdded={() => actions.flash(tr("recVideos.added"))} />
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 8, maxWidth: 640, width: "100%", alignSelf: "center" },
  under: { paddingTop: 8 },
  block: { paddingTop: 32 },
  tabs: { paddingTop: 24, paddingHorizontal: SCREEN_SIDE },
  h1: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8, textTransform: "uppercase" },
  row: { flexDirection: "row" },
  play: { minHeight: 48, minWidth: 48, paddingHorizontal: 24, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  playText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, paddingHorizontal: 20 },
  pad: { paddingHorizontal: 20 },
})
