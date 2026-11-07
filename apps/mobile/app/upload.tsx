import { useCallback, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path, Rect } from "react-native-svg"

import { ConfirmDialog, type DialogAction } from "@/components/song-chords/ConfirmDialog"
import { DraftList, MyCharts } from "@/components/song-chords/MyCharts"
import { SheetTopBar } from "@/components/common/SheetTopBar"
import { ActionButton, CORNER, Hint } from "@/components/song-chords/parts"
import { KPress } from "@/components/kirtan/KPress"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useChordTeam } from "@/hooks/useChordTeam"
import { useMyChords } from "@/hooks/useMyChords"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { chordFailure, chordsBackend } from "@/lib/songChords/backend"
import type { DraftEntry } from "@/lib/songChords/drafts"
import type { ChordProposal } from "@/lib/songChords/types"
import { useAuthStore } from "@/stores/authStore"
import { useChordDraftStore } from "@/stores/chordDraftStore"
import { href } from "@/utils/href"

/** A recording: a waveform. */
const WaveGlyph = ({ color }: { color: string }) => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path d="M4 16h2M9 11v10M14 6v20M19 10v12M24 13v6M28 16h0" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
  </Svg>
)

/** Chords: a guitar neck, four strings and a few frets, with two finger dots. */
const NeckGlyph = ({ color }: { color: string }) => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Rect x={5} y={4} width={22} height={24} stroke={color} strokeWidth={1.75} />
    <Path d="M5 12h22M5 20h22M13 4v24M20 4v24" stroke={color} strokeWidth={1.25} />
    <Rect x={11} y={10} width={4} height={4} fill={color} />
    <Rect x={18} y={18} width={4} height={4} fill={color} />
  </Svg>
)

/**
 * The Upload hub (opened by the Upload button of the tab bar): what a member can share. A recording goes to the
 * existing add-Kiirtan form (unchanged); chords go to the "offer chords" flow. Below: the charts the member has not
 * finished (kept on this phone), the member's own chord charts with where each one stands, and, for the team, the way
 * into the review screen. The scenario map is in docs/chord-proposals.md.
 */
export default function UploadScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const signedIn = useAuthStore((s) => s.mode === "signed_in") || MOCKUP_DATA

  const [tick, setTick] = useState(0)
  const { team, waiting } = useChordTeam(signedIn, tick)
  const mine = useMyChords(signedIn, tick)
  const book = useChordDraftStore((s) => s.drafts)
  const discardDraft = useChordDraftStore((s) => s.discard)
  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/")))

  const [deleting, setDeleting] = useState<ChordProposal | null>(null)
  const [discarding, setDiscarding] = useState<DraftEntry | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const confirmDelete = useCallback(async () => {
    const target = deleting
    setDeleting(null)
    if (!target) return
    try {
      await chordsBackend().remove(target.id)
      mine.drop(target.id)
      discardDraft(`edit:${target.id}`)
      discardDraft(`copy:${target.id}`)
      setMessage(t("chordOffer.deleted"))
      setTick((n) => n + 1)
    } catch (error) {
      setMessage(t(`chordOffer.failure.${chordFailure(error)}` as "chordOffer.failure.server"))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleting, discardDraft, mine.drop, t])

  const deleteActions: DialogAction[] = [
    { label: t("chordOffer.delete.keep"), onPress: () => setDeleting(null), tone: "quiet" },
    { label: t("chordOffer.delete.yes"), onPress: () => void confirmDelete(), tone: "danger" },
  ]
  const draftBody = discarding
    ? discarding.chords > 0 && discarding.draft.songId
      ? t("chordOffer.discard.body", { count: discarding.chords, number: discarding.draft.songId })
      : t("chordOffer.discard.bodyNoChords")
    : ""
  const discardActions: DialogAction[] = [
    { label: t("chordOffer.discard.keep"), onPress: () => setDiscarding(null), tone: "quiet" },
    {
      label: t("chordOffer.discard.yes"),
      onPress: () => {
        if (discarding) discardDraft(discarding.key)
        setDiscarding(null)
      },
      tone: "danger",
    },
  ]

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <SheetTopBar onClose={close} closeLabel={t("common.close")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 48 }]}>
        <Reveal index={0}>
          <Text style={[s.over, { color: theme.accent }]}>{t("upload.over")}</Text>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("upload.title")}
          </Text>
          <Text style={[s.intro, { color: theme.textBody }]}>{t("upload.intro")}</Text>
        </Reveal>

        <Reveal index={1} style={s.cards}>
          <Choice
            icon={<WaveGlyph color={theme.accent} />}
            title={t("upload.recording.title")}
            body={t("upload.recording.body")}
            onPress={() => router.push(href("/add-kirtan"))}
            theme={theme}
          />
          <Choice
            icon={<WaveGlyph color={theme.accent} />}
            title={t("set.entry.title")}
            body={t("set.entry.body")}
            onPress={() => router.push(href("/upload-set"))}
            theme={theme}
          />
          <Choice
            icon={<NeckGlyph color={theme.accent} />}
            title={t("upload.chords.title")}
            body={t("upload.chords.body")}
            onPress={() => router.push(href("/upload-chords"))}
            theme={theme}
          />
          <Choice icon={null} title={t("set.entry.mine")} body="" onPress={() => router.push(href("/my-sets"))} theme={theme} quiet />
          {team ? (
            <Choice
              icon={null}
              title={t("upload.review.title")}
              body={waiting > 0 ? t("upload.review.body", { count: waiting }) : t("upload.review.none")}
              onPress={() => router.push(href("/chords-review"))}
              theme={theme}
              quiet
            />
          ) : null}
        </Reveal>

        <Reveal index={2}>
          <DraftList theme={theme} book={book} onAskDiscard={setDiscarding} />
        </Reveal>

        <Reveal index={3} style={s.mine}>
          <Text style={[s.h2, { color: theme.textHeading }]} accessibilityRole="header">
            {t("upload.mine.title")}
          </Text>
          {signedIn ? (
            <MyCharts theme={theme} chords={mine} signedIn onAskDelete={setDeleting} message={message} />
          ) : (
            <>
              <Hint theme={theme}>{t("upload.mine.signin")}</Hint>
              <ActionButton theme={theme} tone="quiet" label={t("chordOffer.signin.action")} onPress={() => router.push(href("/signin"))} />
            </>
          )}
        </Reveal>
      </ScrollView>

      <ConfirmDialog
        theme={theme}
        open={deleting !== null}
        title={t("chordOffer.delete.ask")}
        body={deleting?.status === "published" ? t("chordOffer.delete.ask.published") : t("chordOffer.delete.ask.body")}
        actions={deleteActions}
        onDismiss={() => setDeleting(null)}
      />
      <ConfirmDialog theme={theme} open={discarding !== null} title={t("chordOffer.discard.title")} body={draftBody} actions={discardActions} onDismiss={() => setDiscarding(null)} />
    </View>
  )
}

function Choice({ icon, title, body, onPress, theme, quiet }: { icon: React.ReactNode; title: string; body: string; onPress: () => void; theme: ReturnType<typeof useSongsTheme>; quiet?: boolean }) {
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={body ? `${title}. ${body}` : title}
      onPress={onPress}
      pressedScale={0.985}
      style={[s.choice, { backgroundColor: quiet ? theme.card : theme.peach, borderColor: quiet ? theme.line : theme.accent }]}
    >
      {icon ? <View style={s.choiceIcon}>{icon}</View> : null}
      <View style={s.choiceText}>
        <Text style={[s.choiceTitle, { color: theme.textHeading }]}>{title}</Text>
        {body ? <Text style={[s.choiceBody, { color: theme.textBody }]}>{body}</Text> : null}
      </View>
    </KPress>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 32, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 8 },
  h1: { fontFamily: amFonts.display, fontSize: 56, lineHeight: 54, letterSpacing: -1.1, textTransform: "uppercase" },
  h2: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.3, textTransform: "uppercase" },
  intro: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, marginTop: 12 },
  cards: { gap: 12 },
  choice: { minHeight: 72, borderRadius: CORNER, borderWidth: 1.5, padding: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  choiceIcon: { width: 40, alignItems: "center" },
  choiceText: { flex: 1, minWidth: 0, gap: 4 },
  choiceTitle: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24 },
  choiceBody: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  mine: { gap: 12 },
})
