import { useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { KPress } from "@/components/kirtan/KPress"
import { ActionButton, Chip, Hint } from "@/components/song-chords/parts"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { broadcastFailure, broadcastsBackend } from "@/lib/broadcasts/backend"
import { DESCRIPTION_MAX, ORGANIZER_MAX, TITLE_MAX, URL_MAX, cleanBroadcastText, cleanBroadcastTitle, deviceZone, localDateString, parseBroadcastLink, resolveEnd, resolveStart } from "@/lib/broadcasts/rules"
import type { Broadcast, BroadcastFailure } from "@/lib/broadcasts/types"
import { useFormFocus } from "@/lib/forms/useFormFocus"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { previewGuest } from "@/lib/songChords/backend"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

type FieldKey = "link" | "title" | "start" | "end" | "about" | "organizer"

/** Which field a failure belongs to; the others are said above the send button. */
const FIELD_OF: Partial<Record<BroadcastFailure, FieldKey>> = {
  empty: "link",
  badLink: "link",
  notHttps: "link",
  notPublic: "link",
  channel: "link",
  bareSite: "link",
  tooLong: "link",
  duplicate: "link",
  titleShort: "title",
  titleLong: "title",
  titleLatin: "title",
  titleLink: "title",
  textLink: "about",
  startBad: "start",
  startPast: "start",
  startFar: "start",
  endBad: "end",
  endPast: "end",
  endBeforeStart: "end",
  endFar: "end",
}

/**
 * Share a broadcast (docs/broadcasts.md): the link (Zoom, YouTube Live, Facebook, Instagram or any https address), a Latin
 * title, an optional start (date and time in the phone's zone: empty means "on the air now"), a description and an
 * organizer. It goes live at once; anyone can report it. The link is only ever opened by a person tapping "Open", never
 * fetched here.
 */
export default function UploadBroadcastScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const form = useFormFocus()
  const signedIn = useAuthStore((s) => s.mode === "signed_in") || (MOCKUP_DATA && !previewGuest())

  const [link, setLink] = useState("")
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [endDate, setEndDate] = useState("")
  const [endTime, setEndTime] = useState("")
  const [about, setAbout] = useState("")
  const [organizer, setOrganizer] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [posted, setPosted] = useState<Broadcast | null>(null)

  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/")))
  const say = (failure: BroadcastFailure) => (t as (key: string) => string)(`bc.err.${failure}`)
  const zone = deviceZone() ?? ""

  async function send() {
    if (busy) return
    setProblem(null)
    const found: { key: FieldKey; failure: BroadcastFailure }[] = []
    const parsed = parseBroadcastLink(link)
    if (!parsed.ok) found.push({ key: "link", failure: parsed.failure })
    const cleanTitle = cleanBroadcastTitle(title)
    if (!cleanTitle.ok) found.push({ key: "title", failure: cleanTitle.failure })
    const start = resolveStart({ date, time })
    if (!start.ok) found.push({ key: "start", failure: start.failure })
    const end = resolveEnd({ date: endDate, time: endTime }, { startsAt: start.ok ? start.startsAt : null })
    if (!end.ok) found.push({ key: "end", failure: end.failure })
    const description = cleanBroadcastText(about, DESCRIPTION_MAX)
    if (!description.ok) found.push({ key: "about", failure: description.failure })
    const who = cleanBroadcastText(organizer, ORGANIZER_MAX)
    if (!who.ok) found.push({ key: "organizer", failure: who.failure })
    if (found.length || !parsed.ok || !cleanTitle.ok || !start.ok || !end.ok || !description.ok || !who.ok) {
      const messages: Record<string, string> = {}
      for (const item of found) messages[item.key] = say(item.failure)
      void form.focusFirst(
        found.map((item) => item.key),
        messages,
      )
      return
    }
    setBusy(true)
    try {
      setPosted(await broadcastsBackend().create({ url: parsed.url, title: cleanTitle.title, description: description.text, organizer: who.text, startsAt: start.startsAt, endsAt: end.endsAt, timezone: start.timezone ?? end.timezone }))
    } catch (error) {
      const failure = broadcastFailure(error)
      const key = FIELD_OF[failure]
      if (key) void form.focusFirst([key], { [key]: say(failure) })
      else setProblem(say(failure))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: FieldKey, label: string, value: string, onChange: (text: string) => void, options: { placeholder?: string; hint?: string; optional?: boolean; max: number; multiline?: boolean; url?: boolean }) => (
    <View {...form.field(key)} style={s.field}>
      <View style={s.labelRow}>
        <Text style={[s.label, { color: theme.textHeading }]}>{label}</Text>
        <RequiredMark theme={theme} required={!options.optional} invalid={!!form.error(key)} />
      </View>
      <View style={[s.inputBox, options.multiline && s.inputBoxTall, { backgroundColor: theme.card, borderColor: form.error(key) ? amColors.danger : theme.line }]}>
        <TextInput
          ref={form.input(key)}
          value={value}
          onChangeText={(text) => {
            if (form.error(key)) form.clear()
            onChange(text)
          }}
          editable={!busy}
          placeholder={options.placeholder}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={label}
          maxLength={options.max}
          multiline={options.multiline}
          autoCapitalize={options.url ? "none" : "sentences"}
          autoCorrect={!options.url}
          keyboardType={options.url ? "url" : "default"}
          style={[s.input, options.multiline && s.inputMulti, { color: theme.textHeading }]}
        />
      </View>
      {options.hint ? <Text style={[s.hint, { color: theme.textBody }]}>{options.hint}</Text> : null}
      <FieldError theme={theme} text={form.error(key)} />
    </View>
  )

  if (posted) {
    return (
      <View style={[s.root, { backgroundColor: theme.page }]}>
        <SheetTopBar closeLabel={t("bc.f.close")} onClose={close} />
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}>
          <Reveal index={0} style={s.stack}>
            <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
              {t("bc.f.sent.title")}
            </Text>
            <Text style={[s.intro, { color: theme.textBody }]}>{t("bc.f.sent.body")}</Text>
          </Reveal>
          <Reveal index={1} style={s.stack}>
            <Send theme={theme} label={t("bc.f.sent.see")} onPress={() => router.replace(href(`/broadcast/${posted.id}`))} />
            <ActionButton theme={theme} tone="quiet" label={t("bc.f.sent.mine")} onPress={() => router.replace(href("/broadcasts?tab=mine"))} />
          </Reveal>
        </ScrollView>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[s.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("bc.f.close")} onClose={close} />
      <ScrollView ref={form.scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}>
        <Reveal index={0}>
          <Text style={[s.over, { color: theme.accent }]}>{t("bc.f.over")}</Text>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("bc.f.title")}
          </Text>
          <Text style={[s.intro, { color: theme.textBody }]}>{t("bc.f.intro")}</Text>
        </Reveal>

        {!signedIn ? (
          <Reveal index={1} style={s.stack}>
            <Hint theme={theme}>{t("bc.f.signin")}</Hint>
            <ActionButton theme={theme} tone="quiet" label={t("bc.f.signin.action")} onPress={() => router.push(href("/signin"))} />
          </Reveal>
        ) : (
          <Reveal index={1} style={s.fields}>
            {field("link", t("bc.f.link"), link, setLink, { placeholder: t("bc.f.link.ph"), hint: t("bc.f.link.hint"), max: URL_MAX + 200, url: true })}
            {field("title", t("bc.f.name"), title, setTitle, { placeholder: t("bc.f.name.ph"), hint: t("bc.f.name.hint"), max: TITLE_MAX + 40 })}

            <View {...form.field("start")} style={s.field}>
              <View style={s.labelRow}>
                <Text style={[s.label, { color: theme.textHeading }]}>{t("bc.f.when")}</Text>
                <RequiredMark theme={theme} required={false} />
              </View>
              <View style={s.chips} accessibilityRole="radiogroup">
                {[
                  { label: t("bc.f.today"), value: localDateString(0) },
                  { label: t("bc.f.tomorrow"), value: localDateString(1) },
                ].map((choice) => (
                  <Chip key={choice.value} theme={theme} label={choice.label} on={date === choice.value} onPress={() => setDate(date === choice.value ? "" : choice.value)} />
                ))}
              </View>
              <View style={s.pair}>
                <View style={s.pairItem}>
                  <Text style={[s.sub, { color: theme.textBody }]}>{t("bc.f.date")}</Text>
                  <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: form.error("start") ? amColors.danger : theme.line }]}>
                    <TextInput ref={form.input("start")} value={date} onChangeText={(text) => { if (form.error("start")) form.clear(); setDate(text) }} editable={!busy} placeholder={t("bc.f.date.ph")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("bc.f.date")} maxLength={10} keyboardType="numbers-and-punctuation" style={[s.input, { color: theme.textHeading }]} />
                  </View>
                </View>
                <View style={s.pairItem}>
                  <Text style={[s.sub, { color: theme.textBody }]}>{t("bc.f.time")}</Text>
                  <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: form.error("start") ? amColors.danger : theme.line }]}>
                    <TextInput value={time} onChangeText={(text) => { if (form.error("start")) form.clear(); setTime(text) }} editable={!busy} placeholder={t("bc.f.time.ph")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("bc.f.time")} maxLength={5} keyboardType="numbers-and-punctuation" style={[s.input, { color: theme.textHeading }]} />
                  </View>
                </View>
              </View>
              <Text style={[s.hint, { color: theme.textBody }]}>{t("bc.f.when.hint", { zone })}</Text>
              <FieldError theme={theme} text={form.error("start")} />
            </View>

            <View {...form.field("end")} style={s.field}>
              <View style={s.labelRow}>
                <Text style={[s.label, { color: theme.textHeading }]}>{t("bc.f.ends")}</Text>
                <RequiredMark theme={theme} required={false} />
              </View>
              <View style={s.chips} accessibilityRole="radiogroup">
                {[
                  { label: t("bc.f.today"), value: localDateString(0) },
                  { label: t("bc.f.tomorrow"), value: localDateString(1) },
                  { label: t("bc.f.inWeek"), value: localDateString(7) },
                ].map((choice) => (
                  <Chip key={choice.value} theme={theme} label={choice.label} on={endDate === choice.value} onPress={() => setEndDate(endDate === choice.value ? "" : choice.value)} />
                ))}
              </View>
              <View style={s.pair}>
                <View style={s.pairItem}>
                  <Text style={[s.sub, { color: theme.textBody }]}>{t("bc.f.date")}</Text>
                  <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: form.error("end") ? amColors.danger : theme.line }]}>
                    <TextInput ref={form.input("end")} value={endDate} onChangeText={(text) => { if (form.error("end")) form.clear(); setEndDate(text) }} editable={!busy} placeholder={t("bc.f.date.ph")} placeholderTextColor={theme.textMuted} accessibilityLabel={`${t("bc.f.ends")}, ${t("bc.f.date")}`} maxLength={10} keyboardType="numbers-and-punctuation" style={[s.input, { color: theme.textHeading }]} />
                  </View>
                </View>
                <View style={s.pairItem}>
                  <Text style={[s.sub, { color: theme.textBody }]}>{t("bc.f.time")}</Text>
                  <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: form.error("end") ? amColors.danger : theme.line }]}>
                    <TextInput value={endTime} onChangeText={(text) => { if (form.error("end")) form.clear(); setEndTime(text) }} editable={!busy} placeholder={t("bc.f.time.ph")} placeholderTextColor={theme.textMuted} accessibilityLabel={`${t("bc.f.ends")}, ${t("bc.f.time")}`} maxLength={5} keyboardType="numbers-and-punctuation" style={[s.input, { color: theme.textHeading }]} />
                  </View>
                </View>
              </View>
              <Text style={[s.hint, { color: theme.textBody }]}>{t("bc.f.ends.hint")}</Text>
              <FieldError theme={theme} text={form.error("end")} />
            </View>

            {field("about", t("bc.f.about"), about, setAbout, { placeholder: t("bc.f.about.ph"), optional: true, max: DESCRIPTION_MAX + 40, multiline: true })}
            {field("organizer", t("bc.f.organizer"), organizer, setOrganizer, { placeholder: t("bc.f.organizer.ph"), optional: true, max: ORGANIZER_MAX + 40 })}

            <View style={s.send}>
              {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
              <Hint theme={theme}>{t("bc.f.note")}</Hint>
              <Send theme={theme} label={busy ? t("bc.f.sending") : t("bc.f.send")} onPress={() => void send()} disabled={busy} />
            </View>
          </Reveal>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Send({ label, onPress, disabled }: { theme: ReturnType<typeof useSongsTheme>; label: string; onPress: () => void; disabled?: boolean }) {
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
  /** the fields of the form: the blocks are 24 apart, never touching (docs/layout-rules.md, "Space between blocks") */
  fields: { gap: 24 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 8 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  intro: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, marginTop: 12 },
  field: { gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pair: { flexDirection: "row", gap: 16 },
  pairItem: { flex: 1, minWidth: 0, gap: 8 },
  inputBox: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: "row" },
  inputBoxTall: { minHeight: 112 },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  inputMulti: { textAlignVertical: "top", minHeight: 88 },
  /** the last block: a problem, the note, then the button; the note and the button 16 apart */
  send: { gap: 16 },
  full: { alignSelf: "stretch" },
  sendButton: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 20 },
  sendText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
})
