import { useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import * as Clipboard from "expo-clipboard"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import { KirtanThumb, KirtanTag, PlusGlyph } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { fetchOEmbed, oembedFailureMessage, type OEmbedPreview } from "@/lib/kirtan/oembed"
import { CONFIRM_TEXT, SUBMISSION_ERROR_TEXT, validateSubmission, type SubmissionError } from "@/lib/kirtan/submissions"
import { KIRTAN_TYPES, type Kirtan, type KirtanTypeId } from "@/lib/kirtan/types"
import { parseYouTubeUrl } from "@/lib/kirtan/youtube"
import { useKirtanPlayerStore } from "@/stores/kirtanPlayerStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

type Preview =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; data: OEmbedPreview }
  | { state: "failed"; reason: Parameters<typeof oembedFailureMessage>[0] }

const CloseGlyph = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
  </Svg>
)

/**
 * Add kirtan: paste a public YouTube link, see what YouTube says about it (title, channel, picture
 * from the public oEmbed endpoint, no key), choose a type, confirm, and send it for review. It then
 * waits in "Your submissions" with the status pending.
 * TODO(api): POST the submission to the backend; an admin approves it there.
 */
export default function AddKirtanScreen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = Platform.OS === "web" ? 24 : Math.max(insets.top, 16)

  const [link, setLink] = useState("")
  const [preview, setPreview] = useState<Preview>({ state: "idle" })
  const [title, setTitle] = useState("")
  const [type, setType] = useState<KirtanTypeId | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<SubmissionError | "duplicate" | null>(null)
  const [duplicate, setDuplicate] = useState<Kirtan | null>(null)
  const [sent, setSent] = useState<Kirtan | null>(null)
  const [focus, setFocus] = useState<"link" | "title" | null>(null)
  const titleTouched = useRef(false)

  const parsed = useMemo(() => parseYouTubeUrl(link), [link])
  const videoId = parsed?.id ?? null
  const hasText = link.trim().length > 0

  // Ask YouTube about the video whenever the link points at a new one.
  useEffect(() => {
    titleTouched.current = false
    setTitle("")
    setDuplicate(null)
    setError(null)
    if (!videoId) {
      setPreview({ state: "idle" })
      return
    }
    let active = true
    setPreview({ state: "loading" })
    void fetchOEmbed(videoId).then((result) => {
      if (!active) return
      if (result.ok) {
        setPreview({ state: "ready", data: result.preview })
        if (!titleTouched.current) setTitle(result.preview.title)
      } else {
        setPreview({ state: "failed", reason: result.reason })
      }
    })
    return () => {
      active = false
    }
  }, [videoId])

  const paste = async () => {
    try {
      const text = await Clipboard.getStringAsync()
      if (text) setLink(text.trim())
    } catch {
      // the browser may refuse; the field can still be typed in
    }
  }

  const blocked = preview.state === "failed" && (preview.reason === "not_found" || preview.reason === "not_embeddable")
  const thumb = preview.state === "ready" ? preview.data.thumbnailUrl : null
  const author = preview.state === "ready" ? preview.data.author : ""

  const send = () => {
    if (blocked) return
    const problem = validateSubmission({ videoId: videoId ?? "", title, author, thumbnailUrl: thumb, type, confirmed, addedBy: "You" })
    if (problem) {
      setError(problem)
      return
    }
    const result = useKirtanStore.getState().submit({ videoId: videoId as string, title, author, thumbnailUrl: thumb, type, confirmed, addedBy: "You" })
    if (result.added) {
      setSent(result.added)
      setError(null)
    } else {
      setDuplicate(result.duplicate)
      setError("duplicate")
    }
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/songs")))
  const viewSubmissions = () => {
    useKirtanPlayerStore.getState().setSource("kirtan")
    router.replace(href("/v2/songs?source=kirtan"))
  }
  const another = () => {
    setSent(null)
    setLink("")
    setType(null)
    setConfirmed(false)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.root, { backgroundColor: theme.page }]}>
      <View style={[styles.bar, { paddingTop: top }]}>
        <View style={[styles.handle, { backgroundColor: theme.line === "rgba(255, 255, 255, 0.09)" ? "rgba(255,255,255,0.22)" : amColors.sand400 }]} />
        <KPress accessibilityRole="button" accessibilityLabel="Close" onPress={close} pressedScale={0.9} outerStyle={styles.close} style={[styles.closeDisc, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <CloseGlyph color={theme.textHeading} />
        </KPress>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}>
        {sent ? (
          <Sent theme={theme} kirtan={sent} onView={viewSubmissions} onAnother={another} />
        ) : (
          <>
            <Reveal index={0}>
              <Text style={[styles.over, { color: theme.accent }]}>Share a kiirtan</Text>
              <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
                Add{"\n"}
                <Text style={{ color: theme.ink300 }}>kiirtan</Text>
              </Text>
            </Reveal>

            <Reveal index={1} style={styles.field}>
              <Text style={[styles.label, { color: theme.textHeading }]}>YouTube link</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: focus === "link" ? theme.brand : hasText && !parsed ? amColors.danger : theme.line }]}>
                <PlayerIcon name="link" size={20} color={theme.textBody} />
                <TextInput
                  value={link}
                  onChangeText={setLink}
                  onFocus={() => setFocus("link")}
                  onBlur={() => setFocus(null)}
                  placeholder="youtube.com/watch?v=…"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="YouTube link"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  style={[styles.input, { color: theme.textHeading }]}
                />
                {hasText ? (
                  <KPress accessibilityRole="button" accessibilityLabel="Clear the link" onPress={() => setLink("")} pressedScale={0.88} style={styles.inputBtn}>
                    <CloseGlyph color={theme.textBody} />
                  </KPress>
                ) : (
                  <KPress accessibilityRole="button" accessibilityLabel="Paste from clipboard" onPress={paste} pressedScale={0.94} style={[styles.pasteBtn, { backgroundColor: theme.peach }]}>
                    <Text style={[styles.pasteText, { color: theme.accent }]}>Paste</Text>
                  </KPress>
                )}
              </View>
              {hasText && !parsed ? (
                <Text style={[styles.hint, { color: amColors.danger }]} accessibilityLiveRegion="polite">
                  That is not a link to a YouTube video. Use youtube.com, youtu.be, a Shorts link or music.youtube.com.
                </Text>
              ) : (
                <Text style={[styles.hint, { color: theme.textBody }]}>youtube.com/watch, youtu.be, Shorts and music.youtube.com links work.</Text>
              )}
            </Reveal>

            {videoId ? (
              <View style={styles.field}>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]} accessibilityLabel="Preview">
                  <KirtanThumb kirtan={{ id: videoId, thumbnailUrl: thumb }} width="100%" aspectRatio={16 / 9} radius={0} />
                  <View style={styles.cardBody}>
                    {preview.state === "loading" ? (
                      <Text style={[styles.hint, { color: theme.textBody }]}>Loading the preview from YouTube…</Text>
                    ) : (
                      <>
                        <View style={styles.tagLine}>
                          <KirtanTag theme={theme} />
                          <Text style={[styles.hint, { color: theme.textBody, flexShrink: 1 }]} numberOfLines={1}>
                            {author ? `YouTube · ${author}` : "YouTube"}
                          </Text>
                        </View>
                        <Text style={[styles.cardTitle, { color: theme.textHeading }]} numberOfLines={3}>
                          {title.trim() || (preview.state === "failed" ? "No title yet" : "…")}
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                {preview.state === "failed" ? (
                  <Text style={[styles.hint, { color: blocked ? amColors.danger : theme.textBody }]} accessibilityLiveRegion="polite">
                    {oembedFailureMessage(preview.reason)}
                  </Text>
                ) : null}

                {preview.state !== "loading" && !blocked ? (
                  <View style={styles.sub}>
                    <Text style={[styles.label, { color: theme.textHeading }]}>Title</Text>
                    <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: focus === "title" ? theme.brand : theme.line }]}>
                      <TextInput
                        value={title}
                        onChangeText={(text) => {
                          titleTouched.current = true
                          setTitle(text)
                        }}
                        onFocus={() => setFocus("title")}
                        onBlur={() => setFocus(null)}
                        placeholder="Name of the kiirtan"
                        placeholderTextColor={theme.textMuted}
                        accessibilityLabel="Title"
                        maxLength={120}
                        style={[styles.input, { color: theme.textHeading }]}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {videoId && !blocked && preview.state !== "loading" ? (
              <>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>Type</Text>
                  <View style={styles.chips}>
                    {KIRTAN_TYPES.map((t) => {
                      const on = t.id === type
                      return (
                        <KPress
                          key={t.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          onActivate={() => setType(t.id)}
                          pressedScale={0.95}
                          style={[styles.chip, { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : theme.line }]}
                        >
                          <Text style={[styles.chipText, { color: on ? theme.onInk : theme.textHeading }]}>{t.label}</Text>
                        </KPress>
                      )
                    })}
                  </View>
                </View>

                <KPress
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: confirmed }}
                  accessibilityLabel={CONFIRM_TEXT}
                  onActivate={() => setConfirmed((c) => !c)}
                  pressedScale={0.99}
                  style={styles.confirm}
                >
                  <View style={[styles.box, { borderColor: confirmed ? theme.brand : theme.textBody, backgroundColor: confirmed ? theme.brand : "transparent" }]}>
                    {confirmed ? <PlayerIcon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}
                  </View>
                  <Text style={[styles.confirmText, { color: theme.textHeading }]}>{CONFIRM_TEXT}</Text>
                </KPress>

                {error ? (
                  <Text style={[styles.hint, { color: amColors.danger }]} accessibilityLiveRegion="polite">
                    {error === "duplicate"
                      ? duplicate?.status === "approved"
                        ? "This video is already in the kiirtan list."
                        : "You already sent this video. It is waiting for review."
                      : SUBMISSION_ERROR_TEXT[error]}
                  </Text>
                ) : null}

                <KPress accessibilityRole="button" accessibilityLabel="Send for review" onPress={send} pressedScale={0.98} style={[styles.send, { backgroundColor: theme.brand }]}>
                  <Text style={styles.sendText}>Send for review</Text>
                </KPress>
                <Text style={[styles.hint, { color: theme.textBody, textAlign: "center" }]}>
                  A reviewer looks at every kiirtan before it appears for everyone. It plays in YouTube's own player.
                </Text>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Sent({ theme, kirtan, onView, onAnother }: { theme: SongsTheme; kirtan: Kirtan; onView: () => void; onAnother: () => void }) {
  return (
    <Reveal index={0} style={styles.sent}>
      <View style={[styles.sentDisc, { backgroundColor: theme.peach }]}>
        <PlayerIcon name="check" size={34} color={theme.accent} strokeWidth={2.5} />
      </View>
      <Text style={[styles.h1, { color: theme.textHeading, textAlign: "center" }]} accessibilityRole="header">
        Sent{"\n"}
        <Text style={{ color: theme.ink300 }}>for review</Text>
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line, padding: 14, gap: 8 }]}>
        <View style={styles.tagLine}>
          <KirtanTag theme={theme} />
          <Text style={[styles.pasteText, { color: theme.accent }]}>IN REVIEW</Text>
        </View>
        <Text style={[styles.cardTitle, { color: theme.textHeading }]} numberOfLines={3}>
          {kirtan.title}
        </Text>
      </View>
      <Text style={[styles.hint, { color: theme.textBody, textAlign: "center" }]}>
        Thank you. You can follow it under Kiirtan, Your submissions. It plays for everyone once it is approved.
      </Text>
      <KPress accessibilityRole="button" accessibilityLabel="See my submissions" onPress={onView} pressedScale={0.98} outerStyle={styles.full} style={[styles.send, { backgroundColor: theme.brand }]}>
        <Text style={styles.sendText}>See my submissions</Text>
      </KPress>
      <KPress accessibilityRole="button" accessibilityLabel="Add another" onPress={onAnother} pressedScale={0.98} outerStyle={styles.full} style={[styles.send, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }]}>
        <PlusGlyph color={theme.textHeading} />
        <Text style={[styles.sendText, { color: theme.textHeading }]}>Add another</Text>
      </KPress>
    </Reveal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { alignItems: "center", paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3, marginTop: 4 },
  close: { position: "absolute", right: 16, top: Platform.OS === "web" ? 18 : undefined },
  closeDisc: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 24, gap: 22, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  field: { gap: 10 },
  sub: { gap: 8, marginTop: 6 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  inputBox: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  inputBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pasteBtn: { height: 40, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pasteText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  card: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  cardBody: { padding: 14, gap: 8, minHeight: 74 },
  tagLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 22, letterSpacing: -0.1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 44, paddingHorizontal: 18, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  confirm: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 4 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  confirmText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  send: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  sendText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  sent: { alignItems: "stretch", gap: 20, paddingTop: 12 },
  sentDisc: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  full: { alignSelf: "stretch" },
})
