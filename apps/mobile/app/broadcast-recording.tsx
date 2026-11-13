import { useEffect, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { KPress } from "@/components/kirtan/KPress"
import { ActionButton, Hint } from "@/components/song-chords/parts"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { broadcastFailure, broadcastsBackend } from "@/lib/broadcasts/backend"
import { URL_MAX, parseRecordingLink } from "@/lib/broadcasts/rules"
import type { Broadcast, BroadcastFailure } from "@/lib/broadcasts/types"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { previewGuest } from "@/lib/songChords/backend"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

/**
 * "Add the recording" of an ended broadcast (docs/broadcasts.md). The author of the broadcast and the team add it at once;
 * anybody else signed in "suggests" it and the team decides. Two ways: a link (a YouTube video, a Zoom cloud recording,
 * Vimeo, archive.org; the phone checks it with the same safe parse as the server, never fetches it, never plays a Zoom
 * link in the app), or a recording file through the ordinary upload form, linked to the broadcast. Nothing is downloaded
 * from YouTube or Zoom, by the phone or by the server.
 */
export default function BroadcastRecordingScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const signedIn = useAuthStore((s) => s.mode === "signed_in") || (MOCKUP_DATA && !previewGuest())

  const [item, setItem] = useState<Broadcast | null>(null)
  const [failure, setFailure] = useState<BroadcastFailure | null>(null)
  const [link, setLink] = useState("")
  const [invalid, setInvalid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<"added" | "suggested" | null>(null)

  useEffect(() => {
    let live = true
    broadcastsBackend()
      .get(String(id))
      .then(
        (b) => live && setItem(b),
        (error: unknown) => live && setFailure(broadcastFailure(error)),
      )
    return () => {
      live = false
    }
  }, [id])

  const close = () => (router.canGoBack() ? router.back() : router.replace(href(`/broadcast/${encodeURIComponent(String(id))}`)))
  const say = (kind: BroadcastFailure) => (t as (key: string) => string)(`bc.err.${kind}`)
  const suggesting = item?.recordingAction === "suggest"

  async function send() {
    if (busy || !item) return
    setInvalid(null)
    const parsed = parseRecordingLink(link)
    if (!parsed.ok) return setInvalid(say(parsed.failure))
    setBusy(true)
    try {
      const added = await broadcastsBackend().addRecording(item.id, parsed.url)
      setDone(added.status === "pending" ? "suggested" : "added")
    } catch (error) {
      setInvalid(say(broadcastFailure(error)))
    } finally {
      setBusy(false)
    }
  }

  const upload = () => {
    if (!item) return
    router.push(href(`/add-kirtan?broadcast=${encodeURIComponent(item.id)}&broadcastTitle=${encodeURIComponent(item.title)}`))
  }

  const head = (
    <Reveal index={0}>
      <Text style={[s.over, { color: theme.accent }]}>{t("bc.rec.over")}</Text>
      <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
        {suggesting ? t("bc.rec.suggest") : t("bc.rec.add")}
      </Text>
      {item ? <Text style={[s.intro, { color: theme.textBody }]}>{item.title}</Text> : null}
    </Reveal>
  )

  let body
  if (!signedIn) {
    body = (
      <Reveal index={1} style={s.stack}>
        <Hint theme={theme}>{t("bc.rec.signin")}</Hint>
        <ActionButton theme={theme} tone="quiet" label={t("bc.f.signin.action")} onPress={() => router.push(href("/signin"))} />
      </Reveal>
    )
  } else if (failure) {
    body = (
      <Reveal index={1} style={s.stack}>
        <Hint theme={theme} tone="danger">{say(failure)}</Hint>
      </Reveal>
    )
  } else if (item && item.phase !== "ended") {
    body = (
      <Reveal index={1} style={s.stack}>
        <Hint theme={theme}>{say("notEnded")}</Hint>
      </Reveal>
    )
  } else if (done) {
    body = (
      <Reveal index={1} style={s.stack}>
        <Text style={[s.intro, { color: theme.textBody }]}>{done === "suggested" ? t("bc.rec.sent.suggested") : t("bc.rec.sent.added")}</Text>
        <Send label={t("bc.rec.sent.back")} onPress={close} />
      </Reveal>
    )
  } else if (item) {
    body = (
      <Reveal index={1} style={s.fields}>
        <View style={s.field}>
          <View style={s.labelRow}>
            <Text style={[s.label, { color: theme.textHeading }]}>{t("bc.rec.link")}</Text>
            <RequiredMark theme={theme} required invalid={!!invalid} />
          </View>
          <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: invalid ? amColors.danger : theme.line }]}>
            <TextInput
              value={link}
              onChangeText={(text) => {
                setInvalid(null)
                setLink(text)
              }}
              editable={!busy}
              placeholder={t("bc.f.link.ph")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t("bc.rec.link")}
              maxLength={URL_MAX + 200}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[s.input, { color: theme.textHeading }]}
            />
          </View>
          <Text style={[s.hint, { color: theme.textBody }]}>{t("bc.rec.link.hint")}</Text>
          <FieldError theme={theme} text={invalid} />
        </View>
        <View style={s.send}>
          {suggesting ? <Hint theme={theme}>{t("bc.rec.suggest.note")}</Hint> : null}
          <Send label={busy ? t("bc.f.sending") : suggesting ? t("bc.rec.suggest.send") : t("bc.rec.add.send")} onPress={() => void send()} disabled={busy || !link.trim()} />
        </View>
        <View style={s.send}>
          <Text style={[s.label, { color: theme.textHeading }]}>{t("bc.rec.orFile")}</Text>
          <Hint theme={theme}>{t("bc.rec.file.hint")}</Hint>
          <ActionButton theme={theme} tone="quiet" label={t("bc.rec.file.pick")} onPress={upload} />
        </View>
      </Reveal>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[s.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("bc.f.close")} onClose={close} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}>
        {head}
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Send({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} pressedScale={0.98} outerStyle={s.full} style={[s.sendButton, { backgroundColor: amColors.orange700, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={s.sendText}>{label}</Text>
    </KPress>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  stack: { gap: 16 },
  fields: { gap: 24 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 8 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  intro: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, marginTop: 12 },
  field: { gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  inputBox: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: "row" },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  send: { gap: 16 },
  full: { alignSelf: "stretch" },
  sendButton: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 20 },
  sendText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
})
