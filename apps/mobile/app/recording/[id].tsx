import { useCallback, useMemo, useRef, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { AuthorLine } from "@/components/authors/AuthorLine"
import { CommentsView } from "@/components/comments/CommentsView"
import { useComments } from "@/components/comments/useComments"
import { AddVideoSheet } from "@/components/recording-extras/AddVideoSheet"
import { ChordsBlock } from "@/components/recording-extras/ChordsBlock"
import { Viewer } from "@/components/recording-extras/RecordingChordsSheet"
import { VideosSection } from "@/components/recording-extras/VideosSection"
import { useRecordingSheets } from "@/components/recording-extras/useRecordingSheets"
import { useVideos } from "@/components/recording-extras/useVideos"
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
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { apiIdOf, chordsFormHref } from "@/lib/recordingExtras/links"
import { recordingCommentFailure, recordingCommentsBackend } from "@/lib/recordingComments/backend"
import type { RecordingComment } from "@/lib/recordingComments/types"
import { href } from "@/utils/href"

/**
 * One recording's page (docs/recording-extras.md): its title and a Play button, then the three things members add to
 * it: chord charts, video links and comments. The recording is found by the app's id or by the server's. A recording
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
  const comments = useComments<RecordingComment, string>(apiId, recordingCommentsBackend, recordingCommentFailure, { tombstones: true })
  const [viewing, setViewing] = useState(false)
  const [adding, setAdding] = useState(false)

  // coming back from the "Add chords" screen shows the new chart (the first focus is the load the hook already did)
  const first = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (!first.current) void sheets.reload()
      first.current = false
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  )

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={tr("recChords.close")} onClose={onClose} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0} style={styles.head}>
          <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {recording.title}
          </Text>
          {recording.author ? <Text style={[styles.author, { color: theme.textHeading }]}>{recording.author}</Text> : null}
          <AuthorLine theme={theme} recordingId={apiId} />
          <View style={styles.row}>
            <SpPress onPress={() => actions.open(recording, [recording], recording.title)} accessibilityLabel={tr("recPage.play")} style={[styles.play, { backgroundColor: t.action }]}>
              <Text style={[styles.playText, { color: t.onAction }]}>{tr("recPage.play")}</Text>
            </SpPress>
          </View>
        </Reveal>
        <Reveal index={1}>
          <ChordsBlock t={t} sheets={sheets} onOpen={() => setViewing(true)} onAdd={() => router.push(href(chordsFormHref({ recordingId: apiId, title: recording.title })))} />
        </Reveal>
        <Reveal index={2}>
          <VideosSection t={t} videos={videos} onAdd={() => setAdding(true)} onFlash={actions.flash} />
        </Reveal>
        <Reveal index={3}>
          <CommentsView t={t} comments={comments} words="recordingComments" testID="recording-comments" />
        </Reveal>
      </ScrollView>
      {/* the sheets sit over the whole page, not inside the scrolling list */}
      <Viewer t={t} sheets={sheets} recordingId={apiId} title={recording.title} visible={viewing} onClose={() => setViewing(false)} />
      <AddVideoSheet t={t} visible={adding} onClose={() => setAdding(false)} videos={videos} onAdded={() => actions.flash(tr("recVideos.added"))} />
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 4, gap: 40, paddingTop: 8, maxWidth: 640, width: "100%", alignSelf: "center" },
  head: { gap: 12, paddingHorizontal: 20 },
  h1: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8, textTransform: "uppercase" },
  author: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  row: { flexDirection: "row", gap: 10, paddingTop: 4 },
  play: { minHeight: 48, minWidth: 48, paddingHorizontal: 28, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  playText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, paddingHorizontal: 20 },
  pad: { paddingHorizontal: 20 },
})
