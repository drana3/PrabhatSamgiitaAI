import { DEFAULT_PHONE_COUNTRY } from "@prabhat/core"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AccountBar, AccountButton, AccountField, ACCOUNT_SIDE, InlineError, topInset } from "@/components/account/AccountUi"
import { AppleMark, FacebookMark, GoogleMark, MicrosoftMark } from "@/components/account/BrandMarks"
import { PhoneField } from "@/components/account/PhoneField"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { appleSignInOffered } from "@/lib/appleAuth"
import {
  authErrorMessage,
  checkEmailForm,
  isEmailValid,
  PASSWORD_MIN,
  visibleProviders,
  afterSignIn,
  type EmailMode,
  type EmailStep,
} from "@/lib/auth/signInFlow"
import { facebookAuthConfigured } from "@/lib/facebookAuth"
import { googleAuthConfigured } from "@/lib/googleAuth"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import {
  microsoftAuthConfigured,
  signInMember,
  signInWithAppleAccount,
  signInWithEmailPassword,
  signInWithFacebookAccount,
  signInWithGoogleAccount,
  signUpWithEmailPassword,
} from "@/lib/session"
import { forgotPasswordUrl, privacyUrl, termsUrl } from "@/lib/webLinks"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

type Busy = "apple" | "google" | "microsoft" | "facebook" | "email" | null
type FieldKey = "email" | "password" | "name" | "phone"
type SignInResult = { needsName?: boolean; needsPhone?: boolean }

const PREVIEW_EMAIL = "dada@example.com"

/**
 * Sign in. Apple (black) and Google (white) first, then one email field. "Continue with email" goes to
 * the password step, which can switch to Create account (name, mobile number). The name and the Google
 * picture come from the provider (lib/session.ts finishSignIn); if no name arrives, complete-profile
 * asks once. "Not now" continues as a guest. Facebook stays in code and shows only when it is enabled.
 *
 * Preview only (EXPO_PUBLIC_MOCKUP_DATA=1): Apple and Google show as buttons but never call the real
 * sign-in, they end in a quiet error. `?state=` is `typed`, `password`, `signup`, `error` or `loading`.
 */
export default function SignInScreen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const inset = topInset(insets.top)
  const openedAt = useRevealClock()
  const params = useLocalSearchParams<{ state?: string }>()
  const preview = MOCKUP_DATA ? params.state : undefined

  const completeWelcome = useAuthStore((s) => s.completeWelcome)
  const signOut = useAuthStore((s) => s.signOut)

  const providers = useMemo(
    () =>
      visibleProviders(
        {
          apple: appleSignInOffered(),
          google: googleAuthConfigured(),
          microsoft: microsoftAuthConfigured(),
          facebook: facebookAuthConfigured(),
        },
        MOCKUP_DATA,
      ),
    [],
  )

  const [busy, setBusy] = useState<Busy>(preview === "loading" ? "apple" : null)
  const [error, setError] = useState<{ text: string; where: "provider" | "email" } | null>(
    preview === "error" ? { text: "Can't reach the server. Check your connection and try again.", where: "provider" } : null,
  )
  const [step, setStep] = useState<EmailStep>(preview === "password" || preview === "signup" ? "password" : "email")
  const [mode, setMode] = useState<EmailMode>(preview === "signup" ? "signup" : "signin")
  const [email, setEmail] = useState(preview === "typed" || preview === "password" || preview === "signup" ? PREVIEW_EMAIL : "")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [countryCode, setCountryCode] = useState(DEFAULT_PHONE_COUNTRY.code)
  const [phone, setPhone] = useState("")
  const [fieldError, setFieldError] = useState<{ field: FieldKey; error: string } | null>(null)

  const scrollRef = useRef<ScrollView>(null)
  const passwordRef = useRef<TextInput>(null)
  const nameRef = useRef<TextInput>(null)
  const lastRun = useRef<(() => void) | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const goBack = useCallback(() => (router.canGoBack() ? router.back() : router.replace(href("/(tabs)"))), [router])

  const continueGuest = useCallback(() => {
    signOut()
    completeWelcome()
    if (router.canGoBack()) router.back()
    else router.replace(href("/(tabs)"))
  }, [completeWelcome, router, signOut])

  const run = useCallback(
    async (action: Exclude<Busy, null>, task: () => Promise<SignInResult>) => {
      lastRun.current = () => void run(action, task)
      setBusy(action)
      setError(null)
      setFieldError(null)
      try {
        let result: SignInResult
        if (MOCKUP_DATA) {
          // Preview: never touch the real sign-in or the session.
          await new Promise((resolve) => setTimeout(resolve, 900))
          throw new Error(action === "email" ? "Incorrect email or password." : "Sign-in isn't connected in the preview.")
        } else {
          result = await task()
        }
        const cameFromWelcome = !useAuthStore.getState().hasCompletedWelcome
        completeWelcome()
        const next = afterSignIn(result, cameFromWelcome)
        if (next.to === "complete-profile") router.replace(href(next.path))
        else if (next.to === "tabs") router.replace(href("/(tabs)"))
        else goBack()
      } catch (failure) {
        if (!alive.current) return
        const text = authErrorMessage(failure)
        setError(text ? { text, where: action === "email" ? "email" : "provider" } : null)
      } finally {
        if (alive.current) setBusy(null)
      }
    },
    [completeWelcome, goBack, router],
  )

  // Preview of the error state: Try again repeats a Google attempt (which ends in the preview error again).
  useEffect(() => {
    if (preview === "error") lastRun.current = () => void run("google", () => signInWithGoogleAccount())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nextToPassword = () => {
    if (!isEmailValid(email)) {
      setFieldError({ field: "email", error: "Enter a valid email address." })
      return
    }
    setFieldError(null)
    setError(null)
    setStep("password")
    setTimeout(() => (mode === "signup" ? nameRef : passwordRef).current?.focus(), 80)
  }

  const submitEmail = () => {
    const check = checkEmailForm({ mode, email, password, name, phoneCountryCode: countryCode, phoneNumber: phone })
    if (!check.ok) {
      setFieldError({ field: check.field, error: check.error })
      return
    }
    const address = email.trim()
    void run("email", () =>
      mode === "signup"
        ? signUpWithEmailPassword(address, password, name.trim(), countryCode, phone)
        : signInWithEmailPassword(address, password),
    )
  }

  const switchMode = (next: EmailMode) => {
    setMode(next)
    setFieldError(null)
    setError(null)
  }

  const errorFor = (field: FieldKey) => (fieldError?.field === field ? fieldError.error : null)
  const clear = (field: FieldKey) => setFieldError((current) => (current?.field === field ? null : current))
  const inactive = busy !== null

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page }]}>
        <AccountBar theme={theme} title="Sign in" onBack={goBack} inset={inset} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 32 : Math.max(insets.bottom, 12) + 24 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            <SongsReveal index={1}>
              <Text style={[styles.lead, { color: theme.textBody }]}>Keep your songs, playlists and progress on every device.</Text>
            </SongsReveal>

            <SongsReveal index={2} style={styles.stack}>
              {providers.apple ? (
                <AccountButton
                  theme={theme}
                  tone="black"
                  label="Continue with Apple"
                  icon={<AppleMark size={20} />}
                  loading={busy === "apple"}
                  disabled={inactive && busy !== "apple"}
                  onPress={() => void run("apple", () => signInWithAppleAccount())}
                />
              ) : null}
              {providers.google ? (
                <AccountButton
                  theme={theme}
                  tone="white"
                  label="Continue with Google"
                  icon={<GoogleMark size={20} />}
                  loading={busy === "google"}
                  disabled={inactive && busy !== "google"}
                  onPress={() => void run("google", () => signInWithGoogleAccount())}
                />
              ) : null}
              {providers.microsoft ? (
                <AccountButton
                  theme={theme}
                  tone="white"
                  label="Continue with Microsoft"
                  icon={<MicrosoftMark size={18} />}
                  loading={busy === "microsoft"}
                  disabled={inactive && busy !== "microsoft"}
                  onPress={() => void run("microsoft", () => signInMember())}
                />
              ) : null}
              {providers.facebook ? (
                <AccountButton
                  theme={theme}
                  tone="white"
                  label="Continue with Facebook"
                  icon={<FacebookMark size={20} />}
                  loading={busy === "facebook"}
                  disabled={inactive && busy !== "facebook"}
                  onPress={() => void run("facebook", () => signInWithFacebookAccount())}
                />
              ) : null}
              {error?.where === "provider" ? (
                <InlineError theme={theme} onRetry={() => lastRun.current?.()}>
                  {error.text}
                </InlineError>
              ) : null}
            </SongsReveal>

            <SongsReveal index={3} style={styles.divider}>
              <View style={[styles.rule, { backgroundColor: theme.line }]} />
              <Text style={[styles.dividerText, { color: theme.textMuted }]}>or</Text>
              <View style={[styles.rule, { backgroundColor: theme.line }]} />
            </SongsReveal>

            <SongsReveal index={4} style={styles.form}>
              {step === "email" ? (
                <>
                  <AccountField
                    theme={theme}
                    label="Email"
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
                    onSubmitEditing={nextToPassword}
                  />
                  <AccountButton
                    theme={theme}
                    tone="brand"
                    label="Continue with email"
                    disabled={inactive}
                    onPress={nextToPassword}
                  />
                </>
              ) : (
                <>
                  <View style={[styles.emailRow, { backgroundColor: theme.card, borderColor: theme.line }]}>
                    <Text style={[styles.emailText, { color: theme.textHeading }]} numberOfLines={1}>
                      {email.trim()}
                    </Text>
                    <Press
                      accessibilityRole="button"
                      accessibilityLabel="Change email"
                      disabled={inactive}
                      onPress={() => {
                        setStep("email")
                        setError(null)
                        setFieldError(null)
                      }}
                      pressedScale={0.96}
                      style={styles.change}
                    >
                      <Text style={[styles.linkText, { color: theme.accent }]}>Change</Text>
                    </Press>
                  </View>

                  {mode === "signup" ? (
                    <>
                      <AccountField
                        ref={nameRef}
                        theme={theme}
                        label="Name"
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
                        onSubmitEditing={() => passwordRef.current?.focus()}
                      />
                      <PhoneField
                        theme={theme}
                        countryCode={countryCode}
                        nationalNumber={phone}
                        onCountryCodeChange={setCountryCode}
                        onNationalNumberChange={(value) => {
                          setPhone(value)
                          clear("phone")
                        }}
                        error={errorFor("phone")}
                        disabled={inactive}
                      />
                    </>
                  ) : null}

                  <AccountField
                    ref={passwordRef}
                    theme={theme}
                    label="Password"
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value)
                      clear("password")
                    }}
                    error={errorFor("password")}
                    hint={mode === "signup" ? `At least ${PASSWORD_MIN} characters.` : null}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete={mode === "signup" ? "new-password" : "password"}
                    textContentType={mode === "signup" ? "newPassword" : "password"}
                    returnKeyType="go"
                    editable={!inactive}
                    onSubmitEditing={submitEmail}
                  />

                  {error?.where === "email" ? (
                    <InlineError theme={theme} onRetry={() => lastRun.current?.()}>
                      {error.text}
                    </InlineError>
                  ) : null}

                  <AccountButton
                    theme={theme}
                    tone="brand"
                    label={mode === "signup" ? "Create account" : "Sign in"}
                    loading={busy === "email"}
                    disabled={inactive && busy !== "email"}
                    onPress={submitEmail}
                  />

                  <View style={styles.links}>
                    <Press
                      accessibilityRole="button"
                      accessibilityLabel={mode === "signup" ? "I already have an account" : "Create an account"}
                      disabled={inactive}
                      onPress={() => switchMode(mode === "signup" ? "signin" : "signup")}
                      pressedScale={0.96}
                      style={styles.link}
                    >
                      <Text style={[styles.linkText, { color: theme.accent }]}>
                        {mode === "signup" ? "I already have an account" : "Create an account"}
                      </Text>
                    </Press>
                    {mode === "signin" ? (
                      <Press
                        accessibilityRole="link"
                        accessibilityLabel="Forgot password"
                        onPress={() => void Linking.openURL(forgotPasswordUrl())}
                        pressedScale={0.96}
                        style={styles.link}
                      >
                        <Text style={[styles.linkText, { color: theme.accent }]}>Forgot password?</Text>
                      </Press>
                    ) : null}
                  </View>
                </>
              )}
            </SongsReveal>

            <SongsReveal index={5} style={styles.foot}>
              <Text style={[styles.legal, { color: theme.textMuted }]}>
                {"By continuing you agree to the "}
                <Text accessibilityRole="link" onPress={() => void Linking.openURL(termsUrl())} style={[styles.legalLink, { color: theme.textBody }]}>
                  Terms
                </Text>
                {" and the "}
                <Text accessibilityRole="link" onPress={() => void Linking.openURL(privacyUrl())} style={[styles.legalLink, { color: theme.textBody }]}>
                  Privacy Policy
                </Text>
                .
              </Text>
              <AccountButton theme={theme} tone="quiet" label="Not now" disabled={inactive} onPress={continueGuest} style={styles.notNow} />
            </SongsReveal>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: ACCOUNT_SIDE, paddingTop: 8, gap: 24 },
  lead: { fontFamily: amFonts.medium, fontSize: 17, lineHeight: 25 },
  stack: { gap: 12 },
  divider: { flexDirection: "row", alignItems: "center", gap: 16 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  form: { gap: 16 },
  emailRow: { minHeight: 56, borderRadius: 16, borderWidth: 1, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  emailText: { flex: 1, fontFamily: amFonts.medium, fontSize: 17 },
  change: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", columnGap: 16 },
  link: { minHeight: 44, justifyContent: "center" },
  linkText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  foot: { gap: 4, alignItems: "stretch" },
  legal: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 19, textAlign: "center", paddingHorizontal: 8 },
  legalLink: { fontFamily: amFonts.semi, textDecorationLine: "underline" },
  notNow: { alignSelf: "center", minWidth: 140 },
})
