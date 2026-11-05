import { createElement, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import { KirtanTag, PlusGlyph } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { CONFIRM_TEXT, SUBMISSION_ERROR_TEXT, validateSubmission, type SubmissionError } from "@/lib/kirtan/submissions"
import { KIRTAN_TYPES, type Kirtan, type KirtanTypeId } from "@/lib/kirtan/types"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

const CloseGlyph = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
  </Svg>
)

type PickedFile = { name: string; uri: string }

/**
 * Add Kiirtan: the author uploads an audio file, names it, says who sings, chooses a type, confirms the
 * rights and sends it for review. It then waits under "My uploads" with the status in review.
 * The file picker works in the web preview (an `<input type=file accept="audio/*">`). On a phone the
 * native picker needs expo-document-picker, which is not installed yet, so "Choose file" is off there.
 * TODO(api): upload the file (multipart or a signed URL) and POST the metadata; an admin approves it there.
 * TODO(native): add expo-document-picker and call getDocumentAsync({ type: "audio/*" }) in `choose`.
 */
export default function AddKirtanScreen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = Platform.OS === "web" ? 24 : Math.max(insets.top, 16)
  const isWeb = Platform.OS === "web"

  const [file, setFile] = useState<PickedFile | null>(null)
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [type, setType] = useState<KirtanTypeId | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<SubmissionError | "duplicate" | null>(null)
  const [duplicate, setDuplicate] = useState<Kirtan | null>(null)
  const [sent, setSent] = useState<Kirtan | null>(null)
  const [focus, setFocus] = useState<"title" | "author" | null>(null)
  const inputRef = useRef<{ click: () => void } | null>(null)

  const choose = () => {
    if (isWeb) inputRef.current?.click()
  }
  const onPicked = (picked: { name: string; type?: string } & Blob | null) => {
    if (!picked) return
    const uri = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(picked) : ""
    setFile({ name: picked.name, uri })
    setError(null)
    // A good first title: the file name without its extension.
    if (!title.trim()) setTitle(picked.name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]+/g, " ").trim())
  }

  const send = () => {
    const input = { fileName: file?.name ?? null, fileUri: file?.uri ?? null, title, author, type, confirmed, addedBy: "You" }
    const problem = validateSubmission(input)
    if (problem) {
      setError(problem)
      return
    }
    const result = useKirtanStore.getState().submit(input)
    if (result.added) {
      setSent(result.added)
      setError(null)
    } else {
      setDuplicate(result.duplicate)
      setError("duplicate")
    }
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan")))
  const viewSubmissions = () => router.replace(href("/v2/kiirtan?filter=mine"))
  const another = () => {
    setSent(null)
    setFile(null)
    setTitle("")
    setAuthor("")
    setType(null)
    setConfirmed(false)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.root, { backgroundColor: theme.page }]}>
      <View style={[styles.bar, { paddingTop: top }]}>
        <View style={[styles.handle, { backgroundColor: theme.dark ? "rgba(255,255,255,0.22)" : amColors.sand400 }]} />
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
              <Text style={[styles.over, { color: theme.accent }]}>Share a recording</Text>
              <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
                Add{"\n"}
                <Text style={{ color: theme.ink300 }}>Kiirtan</Text>
              </Text>
            </Reveal>

            <Reveal index={1} style={styles.field}>
              <Text style={[styles.label, { color: theme.textHeading }]}>Audio file</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: error === "file" ? amColors.danger : theme.line }]}>
                <PlayerIcon name="link" size={20} color={theme.textBody} />
                <Text style={[styles.fileName, { color: file ? theme.textHeading : theme.textBody }]} numberOfLines={1}>
                  {file ? file.name : isWeb ? "No file chosen yet" : "Choosing a file is not available on the phone yet"}
                </Text>
                <KPress
                  accessibilityRole="button"
                  accessibilityLabel="Choose file"
                  accessibilityState={{ disabled: !isWeb }}
                  onPress={choose}
                  disabled={!isWeb}
                  pressedScale={0.94}
                  style={[styles.pasteBtn, { backgroundColor: theme.peach, opacity: isWeb ? 1 : 0.45 }]}
                >
                  <Text style={[styles.pasteText, { color: theme.accent }]}>{file ? "Change" : "Choose file"}</Text>
                </KPress>
              </View>
              {isWeb
                ? createElement("input", {
                    ref: (node: { click: () => void } | null) => {
                      inputRef.current = node
                    },
                    type: "file",
                    accept: "audio/*",
                    "aria-label": "Audio file",
                    style: { display: "none" },
                    onChange: (event: { target: { files?: ArrayLike<File> | null; value: string } }) => {
                      onPicked(event.target.files?.[0] ?? null)
                      event.target.value = ""
                    },
                  })
                : null}
              <Text style={[styles.hint, { color: theme.textBody }]}>MP3, M4A, WAV or another audio file that you recorded.</Text>
            </Reveal>

            <Reveal index={2} style={styles.field}>
              <Text style={[styles.label, { color: theme.textHeading }]}>Title</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: focus === "title" ? theme.brand : error === "title" ? amColors.danger : theme.line }]}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  onFocus={() => setFocus("title")}
                  onBlur={() => setFocus(null)}
                  placeholder="Name of the Kiirtan"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="Title"
                  maxLength={120}
                  style={[styles.input, { color: theme.textHeading }]}
                />
              </View>
              <Text style={[styles.label, { color: theme.textHeading, marginTop: 6 }]}>Performer or author</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: focus === "author" ? theme.brand : error === "author" ? amColors.danger : theme.line }]}>
                <TextInput
                  value={author}
                  onChangeText={setAuthor}
                  onFocus={() => setFocus("author")}
                  onBlur={() => setFocus(null)}
                  placeholder="Who sings it, a person or a group"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="Performer or author"
                  maxLength={80}
                  style={[styles.input, { color: theme.textHeading }]}
                />
              </View>
            </Reveal>

            <Reveal index={3} style={styles.field}>
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
            </Reveal>

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
              <Text style={[styles.hint, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
                {error === "duplicate"
                  ? duplicate?.status === "approved"
                    ? "This Kiirtan is already in the list."
                    : "You already sent this one. It is waiting for review."
                  : SUBMISSION_ERROR_TEXT[error]}
              </Text>
            ) : null}

            <KPress accessibilityRole="button" accessibilityLabel="Send for review" onPress={send} pressedScale={0.98} style={[styles.send, { backgroundColor: theme.brand }]}>
              <Text style={styles.sendText}>Send for review</Text>
            </KPress>
            <Text style={[styles.hint, { color: theme.textBody, textAlign: "center" }]}>A reviewer listens to every Kiirtan before it appears for everyone.</Text>
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
        Thank you. You can follow it under Kiirtan, My uploads. It plays for everyone once it is approved.
      </Text>
      <KPress accessibilityRole="button" accessibilityLabel="See my uploads" onPress={onView} pressedScale={0.98} outerStyle={styles.full} style={[styles.send, { backgroundColor: theme.brand }]}>
        <Text style={styles.sendText}>See my uploads</Text>
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
  fileName: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
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
