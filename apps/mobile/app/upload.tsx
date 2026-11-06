import { useCallback, useEffect, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path, Rect } from "react-native-svg"

import { ActionButton, CORNER, Hint } from "@/components/song-chords/parts"
import { KPress } from "@/components/kirtan/KPress"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useChordTeam } from "@/hooks/useChordTeam"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { chordFailure, chordsBackend } from "@/lib/songChords/backend"
import { keyLabel } from "@/lib/songPage/spChords"
import type { ChordProposal } from "@/lib/songChords/types"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

const CloseGlyph = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
  </Svg>
)

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
 * existing add-Kiirtan form (unchanged); chords go to the new "offer chords" flow. Below: the member's own chord
 * charts with where each one stands, and, for the team, the way into the review screen.
 */
export default function UploadScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = Platform.OS === "web" ? 24 : Math.max(insets.top, 16)
  const signedIn = useAuthStore((s) => s.mode === "signed_in") || MOCKUP_DATA

  const [tick, setTick] = useState(0)
  const { team, waiting } = useChordTeam(signedIn, tick)
  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/")))

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: top }]}>
        <View style={[s.handle, { backgroundColor: theme.dark ? "rgba(255,255,255,0.22)" : amColors.sand400 }]} />
        <KPress accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={close} pressedScale={0.9} outerStyle={s.close} style={[s.closeDisc, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <CloseGlyph color={theme.textHeading} />
        </KPress>
      </View>
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
            icon={<NeckGlyph color={theme.accent} />}
            title={t("upload.chords.title")}
            body={t("upload.chords.body")}
            onPress={() => router.push(href("/upload-chords"))}
            theme={theme}
          />
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

        <Reveal index={2} style={s.mine}>
          <Text style={[s.h2, { color: theme.textHeading }]} accessibilityRole="header">
            {t("upload.mine.title")}
          </Text>
          {signedIn ? <MyCharts reloadKey={tick} onChanged={() => setTick((n) => n + 1)} /> : <Hint theme={theme}>{t("upload.mine.signin")}</Hint>}
          {!signedIn ? <ActionButton theme={theme} tone="quiet" label={t("chordOffer.signin.action")} onPress={() => router.push(href("/signin"))} /> : null}
        </Reveal>
      </ScrollView>
    </View>
  )
}

function Choice({ icon, title, body, onPress, theme, quiet }: { icon: React.ReactNode; title: string; body: string; onPress: () => void; theme: ReturnType<typeof useSongsTheme>; quiet?: boolean }) {
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      pressedScale={0.985}
      style={[s.choice, { backgroundColor: quiet ? theme.card : theme.peach, borderColor: quiet ? theme.line : theme.accent }]}
    >
      {icon ? <View style={s.choiceIcon}>{icon}</View> : null}
      <View style={s.choiceText}>
        <Text style={[s.choiceTitle, { color: theme.textHeading }]}>{title}</Text>
        <Text style={[s.choiceBody, { color: theme.textBody }]}>{body}</Text>
      </View>
    </KPress>
  )
}

/** The member's own chord charts, with their state and (for a rejected one) the reason. */
function MyCharts({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; items: ChordProposal[] }>({ status: "loading", items: [] })
  const [asking, setAsking] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    chordsBackend()
      .mine()
      .then((items) => {
        if (active) setState({ status: "ready", items })
      })
      .catch(() => {
        if (active) setState({ status: "error", items: [] })
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const remove = useCallback(
    async (id: string) => {
      try {
        await chordsBackend().remove(id)
        setState((s0) => ({ ...s0, items: s0.items.filter((p) => p.id !== id) }))
        setMessage(t("chordOffer.deleted"))
        onChanged()
      } catch (error) {
        setMessage(t(`chordOffer.failure.${chordFailure(error)}` as "chordOffer.failure.server"))
      }
      setAsking(null)
    },
    [t, onChanged],
  )

  if (state.status === "loading") return <Hint theme={theme}>{t("upload.mine.loading")}</Hint>
  if (state.status === "error") return <Hint theme={theme} tone="danger">{t("upload.mine.error")}</Hint>
  if (state.items.length === 0) return <Hint theme={theme}>{t("upload.mine.empty")}</Hint>

  return (
    <View style={s.list}>
      {message ? (
        <Hint theme={theme}>{message}</Hint>
      ) : null}
      {state.items.map((p) => {
        const meta =
          p.instrument === "guitar"
            ? p.capo > 0
              ? t("chordOffer.meta.guitar", { capo: p.capo, key: keyLabel(p.baseKey) })
              : t("chordOffer.meta.guitarNoCapo", { key: keyLabel(p.baseKey) })
            : t("chordOffer.meta.harmonium", { key: keyLabel(p.baseKey) })
        const tone = p.status === "rejected" ? theme.dangerText : p.status === "published" ? theme.accent : theme.textBody
        return (
          <View key={p.id} style={[s.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Text style={[s.rowTitle, { color: theme.textHeading }]}>{t("chordOffer.song", { number: p.songId })}</Text>
            <Text style={[s.rowMeta, { color: theme.textBody }]}>{meta}</Text>
            <Text style={[s.rowState, { color: tone }]}>{t(`chordOffer.status.${p.status}` as "chordOffer.status.pending")}</Text>
            {p.status === "rejected" && p.rejectedReason ? <Hint theme={theme} tone="danger">{t("chordOffer.rejectedWhy", { reason: p.rejectedReason })}</Hint> : null}
            {p.status === "rejected" ? <Hint theme={theme}>{t("chordOffer.rejectedHelp")}</Hint> : null}
            {asking === p.id ? (
              <View style={s.actions}>
                <Text style={[s.rowMeta, { color: theme.textHeading }]}>{t("chordOffer.delete.ask")}</Text>
                <View style={s.actionRow}>
                  <ActionButton theme={theme} tone="quiet" label={t("chordOffer.delete.keep")} onPress={() => setAsking(null)} style={s.half} />
                  <ActionButton theme={theme} label={t("chordOffer.delete.yes")} onPress={() => void remove(p.id)} style={s.half} />
                </View>
              </View>
            ) : (
              <View style={s.actionRow}>
                <ActionButton theme={theme} tone="quiet" label={t("upload.mine.open")} onPress={() => router.push(href(`/song-v2/ps-${p.songId}`))} style={s.half} />
                <ActionButton theme={theme} tone="quiet" label={t("chordOffer.delete")} onPress={() => setAsking(p.id)} style={s.half} />
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { alignItems: "center", paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3, marginTop: 4 },
  close: { position: "absolute", right: 16, top: Platform.OS === "web" ? 18 : undefined },
  closeDisc: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 24, gap: 32, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 56, lineHeight: 54, letterSpacing: -1.1, textTransform: "uppercase" },
  h2: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.3, textTransform: "uppercase" },
  intro: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, marginTop: 12 },
  cards: { gap: 12 },
  choice: { minHeight: 96, borderRadius: CORNER, borderWidth: 1.5, padding: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  choiceIcon: { width: 40, alignItems: "center" },
  choiceText: { flex: 1, minWidth: 0, gap: 4 },
  choiceTitle: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24 },
  choiceBody: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  mine: { gap: 12 },
  list: { gap: 12 },
  row: { borderWidth: 1.5, borderRadius: CORNER, padding: 14, gap: 6 },
  rowTitle: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  rowMeta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  rowState: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
  actions: { gap: 8, marginTop: 6 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  half: { flex: 1 },
})
