import { useCallback, useMemo, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { keyboardBehavior } from "@/lib/keyboardBehavior"
import { FieldLabel, KindPicker, SongPicker, TextBox } from "@/components/feedback/FeedbackParts"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpRound } from "@/components/song-v2/SpUi"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import {
  appDetailsNote,
  MAX_EMAIL,
  MAX_MESSAGE,
  buildRequest,
  canSend,
  clampMessage,
  counterText,
  emailProblem,
  friendlyError,
  messageHelper,
  parseSongParam,
  type FeedbackForm,
  type FeedbackKind,
  type PickedSong,
} from "@/lib/feedback/model"
import { readAppDetails, sendFeedback } from "@/lib/feedback/submit"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { songTitleFromHit } from "@/lib/mineView"
import { displayTitle } from "@/lib/songsV2/entry"
import { useT } from "@/lib/i18n"
import { useAuthStore } from "@/stores/authStore"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { href } from "@/utils/href"

type Status = "idle" | "sending" | "sent" | "error"

/** The song named by `?song=`, with its catalogue title, or null. */
function songFromParam(value: string | string[] | undefined): PickedSong | null {
  const number = parseSongParam(value)
  if (number == null) return null
  const hit = catalogSongsByNumbers([number], 1)[0]
  return { number, title: displayTitle(songTitleFromHit(hit, number)) }
}

/**
 * Send feedback. What it is (four choices), the message with a counter, an optional song for a mistake in
 * a song, an optional email (a signed-in member is answered at the account email), a switch for the app
 * details, and Send. Opened from Profile, and from a song's "Report a mistake" with ?song=NUMBER.
 */
export default function FeedbackScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const insets = useSafeAreaInsets()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = Platform.OS === "web" ? 54 : insets.top
  const openedAt = useRevealClock()
  const params = useLocalSearchParams<{ song?: string | string[] }>()
  const mode = useAuthStore((s) => s.mode)
  const accountEmail = useAuthStore((s) => (s.mode === "signed_in" ? s.email : null))

  const fromSong = useMemo(() => songFromParam(params.song), [params.song])
  const [kind, setKind] = useState<FeedbackKind>(fromSong ? "song" : "broken")
  const [song, setSong] = useState<PickedSong | null>(fromSong)
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [includeApp, setIncludeApp] = useState(true)
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState("")
  const [touchedEmail, setTouchedEmail] = useState(false)

  const form: FeedbackForm = {
    kind,
    message,
    song,
    email,
    accountEmail,
    includeAppDetails: includeApp,
    appDetails: readAppDetails(),
  }
  const ready = canSend(form)
  const busy = status === "sending"
  const helper = messageHelper(message)
  const emailError = touchedEmail ? emailProblem(email) : null

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace(href(NAV_V2_HOME_ROUTE))), [router])

  const send = useCallback(async () => {
    const request = buildRequest({ ...form, appDetails: readAppDetails() })
    if (!request || busy) return
    setStatus("sending")
    setError("")
    try {
      await sendFeedback(request)
      setStatus("sent")
    } catch (caught) {
      setError(friendlyError(caught))
      setStatus("error")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form is rebuilt from the state below
  }, [kind, message, song, email, accountEmail, includeApp, busy])

  const body =
    status === "sent" ? (
      <SongsReveal index={1}>
        <View style={[styles.done, { backgroundColor: theme.card, borderColor: theme.line }]} accessibilityLiveRegion="polite">
          <View style={[styles.doneMark, { backgroundColor: theme.brand }]}>
            <SpIcon name="check" size={30} strokeWidth={2.4} color={amColors.white} />
          </View>
          <Text style={[styles.doneTitle, { color: theme.textHeading }]} accessibilityRole="header">
            {t("feedback.done.title")}
          </Text>
          <Text style={[styles.doneBody, { color: theme.textBody }]}>{t("feedback.done.body")}</Text>
          <Press accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={close} pressedScale={0.97} outerStyle={styles.fullWidth} style={[styles.send, { backgroundColor: theme.brand }]}>
            <Text style={styles.sendText}>{t("common.close")}</Text>
          </Press>
        </View>
      </SongsReveal>
    ) : (
      <>
        <SongsReveal index={1} style={styles.block}>
          <FieldLabel theme={theme}>{t("feedback.whatIsIt")}</FieldLabel>
          <KindPicker theme={theme} value={kind} onChange={setKind} />
        </SongsReveal>

        {kind === "song" ? (
          <SongsReveal index={2} style={styles.block}>
            <FieldLabel theme={theme}>{t("feedback.whichSong")}</FieldLabel>
            <SongPicker theme={theme} value={song} onChange={setSong} />
          </SongsReveal>
        ) : null}

        <SongsReveal index={3} style={styles.block}>
          <FieldLabel theme={theme} note={counterText(message)}>
            {t("feedback.yourMessage")}
          </FieldLabel>
          <TextBox
            theme={theme}
            value={message}
            onChangeText={(text) => setMessage(clampMessage(text))}
            placeholder={
              kind === "song"
                ? t("feedback.ph.song")
                : kind === "idea"
                  ? t("feedback.ph.idea")
                  : t("feedback.ph.default")
            }
            accessibilityLabel={t("feedback.yourMessage")}
            multiline
            maxLength={MAX_MESSAGE}
            textAlignVertical="top"
            editable={!busy}
            style={styles.message}
          />
          {helper ? (
            <Text style={[styles.helper, { color: theme.textBody }]} accessibilityLiveRegion="polite">
              {helper}
            </Text>
          ) : null}
        </SongsReveal>

        <SongsReveal index={4} style={styles.block}>
          {accountEmail ? (
            <>
              <FieldLabel theme={theme}>{t("feedback.reply")}</FieldLabel>
              <Text style={[styles.account, { color: theme.textBody }]}>{t("feedback.replyToAccount")}</Text>
            </>
          ) : (
            <>
              <FieldLabel theme={theme} note={t("feedback.optional")}>
                {t("feedback.yourEmail")}
              </FieldLabel>
              <TextBox
                theme={theme}
                value={email}
                onChangeText={setEmail}
                onBlur={() => setTouchedEmail(true)}
                placeholder={t("feedback.email.ph")}
                accessibilityLabel={t("feedback.email.a11y")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                maxLength={MAX_EMAIL}
                editable={!busy}
                invalid={emailError != null}
              />
              {emailError ? (
                <Text style={[styles.helper, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
                  {emailError}
                </Text>
              ) : null}
            </>
          )}
        </SongsReveal>

        <SongsReveal index={5}>
          <View style={[styles.switchRow, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <View style={styles.switchText}>
              <Text style={[styles.switchTitle, { color: theme.textHeading }]}>{t("feedback.includeApp")}</Text>
              <Text style={[styles.switchNote, { color: theme.textBody }]}>{appDetailsNote()}</Text>
            </View>
            <Switch
              value={includeApp}
              onValueChange={setIncludeApp}
              disabled={busy}
              accessibilityLabel={t("feedback.includeApp")}
              trackColor={{ false: theme.line, true: theme.brand }}
              thumbColor={amColors.white}
              // react-native-web draws the thumb with activeThumbColor (teal by default)
              {...({ activeThumbColor: amColors.white } as object)}
              ios_backgroundColor={theme.line}
            />
          </View>
        </SongsReveal>

        <SongsReveal index={6} style={styles.block}>
          {status === "error" ? (
            <View style={[styles.errorBox, { backgroundColor: theme.card, borderColor: theme.dangerText }]} accessibilityLiveRegion="assertive">
              <SpIcon name="close" size={20} strokeWidth={2.4} color={theme.dangerText} />
              <View style={styles.switchText}>
                <Text style={[styles.errorTitle, { color: theme.dangerText }]}>{t("feedback.error.title")}</Text>
                <Text style={[styles.switchNote, { color: theme.textBody }]}>{error}</Text>
              </View>
            </View>
          ) : null}
          <Press
            accessibilityRole="button"
            accessibilityLabel={status === "error" ? t("feedback.retry") : busy ? t("feedback.sendingA11y") : t("feedback.send")}
            accessibilityState={{ disabled: !ready || busy, busy }}
            disabled={!ready || busy}
            onPress={() => void send()}
            pressedScale={0.98}
            outerStyle={styles.fullWidth}
            style={[styles.send, ready ? { backgroundColor: theme.brand } : { backgroundColor: theme.inner, borderWidth: 1, borderColor: theme.line }]}
          >
            {busy ? (
              <>
                <ActivityIndicator color={amColors.white} />
                <Text style={styles.sendText}>{t("feedback.sending")}</Text>
              </>
            ) : (
              <Text style={[styles.sendText, !ready && { color: theme.textMuted }]}>{status === "error" ? t("feedback.retry") : t("feedback.send")}</Text>
            )}
          </Press>
        </SongsReveal>
      </>
    )

  return (
    <RevealClock.Provider value={openedAt}>
      <KeyboardAvoidingView behavior={keyboardBehavior(Platform.OS)} style={[styles.root, { backgroundColor: theme.page }]}>
        <View style={{ paddingTop: inset }}>
          <SongsReveal index={0}>
            <View style={styles.titleRow}>
              <SpRound t={sp} icon="back" label={t("common.back")} onPress={close} />
              <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1} accessibilityRole="header">
                {t("feedback.title")}
              </Text>
            </View>
          </SongsReveal>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {status === "sent" ? null : (
            <Text style={[styles.lead, { color: theme.textBody }]}>
              {mode === "signed_in" ? t("feedback.lead.member") : t("feedback.lead.guest")}
            </Text>
          )}
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: 16, height: 56 },
  title: { flex: 1, fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, textTransform: "uppercase" },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48, gap: 24 },
  lead: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, paddingHorizontal: 4 },
  block: { gap: 10 },
  message: { minHeight: 150, paddingTop: 16 },
  helper: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  account: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingHorizontal: 4 },
  switchRow: { borderRadius: 24, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  switchText: { flex: 1, minWidth: 0, gap: 3 },
  switchTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  switchNote: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  fullWidth: { alignSelf: "stretch" },
  send: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  sendText: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22, color: amColors.white },
  errorBox: { borderRadius: 20, borderWidth: 1.5, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  errorTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  done: { borderRadius: 30, borderWidth: 1, padding: 28, alignItems: "center", gap: 12 },
  doneMark: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  doneTitle: { fontFamily: amFonts.display, fontSize: 36, lineHeight: 38, letterSpacing: -0.7, textTransform: "uppercase" },
  doneBody: { fontFamily: amFonts.medium, fontSize: 17, lineHeight: 24, marginBottom: 12 },
})
