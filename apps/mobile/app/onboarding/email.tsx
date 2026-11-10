import { useCallback, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View, type TextInput } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import {
  OnbButton,
  OnbError,
  OnbEyebrow,
  OnbField,
  OnbHeading,
  OnbLink,
  OnbPage,
  OnbReveal,
  OnbScroll,
  OnbSub,
  OnbTopBar,
} from "@/components/onboarding/OnboardingUi"
import { AgeCheckbox } from "@/components/auth/AgeConfirm"
import { useOnboardingSignIn } from "@/components/onboarding/useOnboardingSignIn"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amFonts } from "@/constants/tokens/amTypography"
import { useResolvedAppearance } from "@/hooks/useAmTheme"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { ageGateOk } from "@/lib/auth/ageConfirm"
import { checkEmailForm, isEmailValid, PASSWORD_MIN } from "@/lib/auth/signInFlow"
import { useT } from "@/lib/i18n"
import { keyboardBehavior } from "@/lib/keyboardBehavior"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { openExternal } from "@/lib/openLink"
import { signInWithEmailPassword, signUpWithEmailPassword } from "@/lib/session"
import { forgotPasswordUrl, privacyUrl, termsUrl } from "@/lib/webLinks"
import { href } from "@/utils/href"

type Stage = "email" | "password" | "signup"
type FieldKey = "email" | "password" | "name"

const PREVIEW_EMAIL = "dada@example.com"

/**
 * Sign in with email, inside the onboarding. Three small stages on one screen (the heading and the page stay,
 * only the fields change): the address, then the password; or "Create an account" with name, email and password.
 * There is no phone number here. `?returning=1` is the "I have an account" path (Back goes to "Your songs are back").
 * `?stage=` is for the web preview only (email, password, signup).
 */
export default function OnboardingEmailScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const resolved = useResolvedAppearance()
  const openedAt = useRevealClock()
  const params = useLocalSearchParams<{ returning?: string; stage?: string }>()
  const returning = params.returning === "1"
  const previewStage = MOCKUP_DATA ? params.stage : undefined

  const [stage, setStage] = useState<Stage>(previewStage === "password" || previewStage === "signup" ? previewStage : "email")
  const [email, setEmail] = useState(previewStage ? PREVIEW_EMAIL : "")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  // "I'm 16 or older": needed to create an account, never pre-ticked (docs/age-confirmation.md)
  const [ageTicked, setAgeTicked] = useState(false)
  const [ageMissing, setAgeMissing] = useState(false)
  const [fieldError, setFieldError] = useState<{ field: FieldKey; error: string } | null>(null)

  // A new account is never "welcome back": only a real sign-in to an existing account is.
  const { busy, error, setError, run, retry } = useOnboardingSignIn(returning && stage !== "signup")
  const passwordRef = useRef<TextInput>(null)
  const nameRef = useRef<TextInput>(null)
  const emailRef = useRef<TextInput>(null)
  const inactive = busy !== null
  const legalParts = t("account.legal", { terms: "{terms}", privacy: "{privacy}" }).split(/(\{terms\}|\{privacy\})/)

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href(returning ? "/onboarding/signin?returning=1" : "/onboarding/signin"))
  }, [returning, router])

  const back = () => {
    if (stage === "password") {
      setStage("email")
      setError(null)
      setFieldError(null)
    } else if (stage === "signup") {
      setStage("email")
      setError(null)
      setFieldError(null)
    } else leave()
  }

  const toPassword = () => {
    if (!isEmailValid(email)) {
      setFieldError({ field: "email", error: t("account.error.email") })
      return
    }
    setFieldError(null)
    setError(null)
    setStage("password")
    setTimeout(() => passwordRef.current?.focus(), 80)
  }

  const switchTo = (next: Stage) => {
    setStage(next)
    setError(null)
    setFieldError(null)
    if (next === "signup") setTimeout(() => nameRef.current?.focus(), 80)
  }

  const submit = () => {
    const mode = stage === "signup" ? "signup" : "signin"
    const check = checkEmailForm({ mode, email, password, name })
    if (!check.ok) {
      setFieldError({ field: check.field, error: check.error })
      return
    }
    if (!ageGateOk(mode, ageTicked)) {
      setAgeMissing(true)
      return
    }
    const address = email.trim()
    void run("email", () =>
      mode === "signup"
        ? signUpWithEmailPassword(address, password, name.trim(), { ageConfirmed: true })
        : signInWithEmailPassword(address, password),
    )
  }

  const errorFor = (field: FieldKey) => (fieldError?.field === field ? fieldError.error : null)
  const clear = (field: FieldKey) => setFieldError((current) => (current?.field === field ? null : current))

  const eyebrow = stage === "signup" ? t("onb.signup.eyebrow") : t("onb.email.eyebrow")
  const first = stage === "signup" ? t("onb.signup.h1") : stage === "password" ? t("onb.password.h1") : t("onb.email.h1")
  const second = stage === "signup" ? t("onb.signup.h2") : stage === "password" ? t("onb.password.h2") : t("onb.email.h2")

  return (
    <RevealClock.Provider value={openedAt}>
      <OnbPage theme={theme}>
        <StatusBar style={statusBarStyleFor(resolved)} />
        <OnbTopBar theme={theme} step={0} onBack={back} />
        <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior(Platform.OS)}>
          <OnbScroll>
            <OnbReveal index={0}>
              <OnbEyebrow theme={theme}>{eyebrow}</OnbEyebrow>
              <OnbHeading theme={theme} first={first} second={second} />
              {stage === "email" ? <OnbSub theme={theme}>{t("onb.email.sub")}</OnbSub> : null}
            </OnbReveal>

            <OnbReveal index={1} style={styles.form}>
              {stage === "email" || stage === "signup" ? (
                <>
                  {stage === "signup" ? (
                    <OnbField
                      ref={nameRef}
                      theme={theme}
                      label={t("common.name")}
                      value={name}
                      onChangeText={(value) => {
                        setName(value)
                        clear("name")
                      }}
                      error={errorFor("name")}
                      autoCapitalize="words"
                      autoComplete="name"
                      autoCorrect={false}
                      returnKeyType="next"
                      editable={!inactive}
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  ) : null}
                  <OnbField
                    ref={emailRef}
                    theme={theme}
                    label={t("account.email")}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value)
                      clear("email")
                    }}
                    error={errorFor("email")}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    editable={!inactive}
                    onSubmitEditing={stage === "signup" ? () => passwordRef.current?.focus() : toPassword}
                  />
                </>
              ) : (
                <View style={[styles.emailRow, { backgroundColor: theme.card, borderColor: theme.lineStrong }]}>
                  <Text style={[styles.emailText, { color: theme.textHeading }]} numberOfLines={1}>
                    {email.trim()}
                  </Text>
                  <Press
                    accessibilityRole="button"
                    accessibilityLabel={t("account.email.changeA11y")}
                    disabled={inactive}
                    onPress={back}
                    pressedScale={0.96}
                    style={styles.change}
                  >
                    <Text style={[styles.changeText, { color: theme.accentText }]}>{t("account.email.change")}</Text>
                  </Press>
                </View>
              )}

              {stage !== "email" ? (
                <OnbField
                  ref={passwordRef}
                  theme={theme}
                  label={t("account.password")}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value)
                    clear("password")
                  }}
                  error={errorFor("password")}
                  hint={stage === "signup" ? t("account.password.hint", { count: PASSWORD_MIN }) : null}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete={stage === "signup" ? "new-password" : "password"}
                  textContentType={stage === "signup" ? "newPassword" : "password"}
                  returnKeyType="go"
                  editable={!inactive}
                  onSubmitEditing={submit}
                />
              ) : null}

              {stage === "signup" ? (
                <AgeCheckbox
                  theme={theme}
                  checked={ageTicked}
                  invalid={ageMissing && !ageTicked}
                  disabled={inactive}
                  onToggle={() => {
                    setAgeTicked((on) => !on)
                    setAgeMissing(false)
                  }}
                />
              ) : null}

              {error && error.action === "email" ? <OnbError theme={theme} text={error.text} onRetry={retry} /> : null}

              {stage === "password" ? (
                <View style={styles.links}>
                  <OnbLink theme={theme} chevron={false} style={styles.linkReset} label={t("account.createAnAccount")} onPress={() => switchTo("signup")} />
                  <OnbLink theme={theme} chevron={false} style={styles.linkReset} label={t("account.forgot")} onPress={() => void openExternal(forgotPasswordUrl())} />
                </View>
              ) : null}
            </OnbReveal>

            <View style={styles.grow} />

            <OnbReveal index={2} style={styles.bottom}>
              <OnbButton
                theme={theme}
                tone="brand"
                label={stage === "signup" ? t("account.createAccount") : stage === "password" ? t("account.signIn.title") : t("onb.continue")}
                loading={busy === "email"}
                disabled={inactive && busy !== "email"}
                onPress={stage === "email" ? toPassword : submit}
              />
              {stage === "signup" ? (
                <>
                  <OnbButton theme={theme} tone="quiet" label={t("account.haveAccount")} disabled={inactive} onPress={() => switchTo("email")} />
                  <Text style={[styles.legal, { color: theme.textMuted }]}>
                    {legalParts.map((part, index) =>
                      part === "{terms}" ? (
                        <Text key={index} accessibilityRole="link" onPress={() => void openExternal(termsUrl())} style={[styles.legalLink, { color: theme.textBody }]}>
                          {t("account.legal.terms")}
                        </Text>
                      ) : part === "{privacy}" ? (
                        <Text key={index} accessibilityRole="link" onPress={() => void openExternal(privacyUrl())} style={[styles.legalLink, { color: theme.textBody }]}>
                          {t("account.legal.privacy")}
                        </Text>
                      ) : (
                        part
                      ),
                    )}
                  </Text>
                </>
              ) : null}
            </OnbReveal>
          </OnbScroll>
        </KeyboardAvoidingView>
      </OnbPage>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1, minHeight: 24 },
  form: { marginTop: 24, gap: 16 },
  bottom: { gap: 4 },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 16, marginTop: -8 },
  linkReset: { marginTop: 0 },
  legal: { marginTop: 8, textAlign: "center", paddingHorizontal: 8, fontFamily: amFonts.regular, fontSize: 13, lineHeight: 19 },
  legalLink: { fontFamily: amFonts.semi, textDecorationLine: "underline" },
  emailRow: { minHeight: 56, borderRadius: 16, borderWidth: 1, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  emailText: { flex: 1, fontFamily: amFonts.medium, fontSize: 17 },
  change: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  changeText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
})
