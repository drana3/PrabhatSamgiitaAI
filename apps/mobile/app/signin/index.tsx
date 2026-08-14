import { DEFAULT_PHONE_COUNTRY } from "@prabhat/core"
import { useEffect, useRef, useState } from "react"
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { Image } from "expo-image"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { PhoneInput, phoneInputValid } from "@/components/common/PhoneInput"
import { PrimaryButton } from "@/components/common/PrimaryButton"
import { SecondaryButton } from "@/components/common/SecondaryButton"
import { brandAssets } from "@/constants/brand"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { facebookAuthConfigured } from "@/lib/facebookAuth"
import { googleAuthConfigured, googleSetupHint } from "@/lib/googleAuth"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { expoGoOAuthMessage } from "@/lib/oauthRedirect"
import { oauthSignInConfigured } from "@/lib/authConfig"
import {
  microsoftAuthConfigured,
  signInMember,
  signInWithEmailPassword,
  signInWithFacebookAccount,
  signInWithGoogleAccount,
  signUpWithEmailPassword,
} from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

type EmailMode = "signin" | "signup"
type BusyAction = "microsoft" | "google" | "facebook" | "email" | null

function ModeTab({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string
  active: boolean
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.modeTab, active && styles.modeTabActive]}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
  )
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>
}

export default function SignInScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const completeWelcome = useAuthStore((s) => s.completeWelcome)
  const signOut = useAuthStore((s) => s.signOut)
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [emailMode, setEmailMode] = useState<EmailMode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY.code)
  const [phoneNumber, setPhoneNumber] = useState("")
  const msalReady = microsoftAuthConfigured()
  const googleReady = googleAuthConfigured()
  const facebookReady = facebookAuthConfigured()
  const expoGoOAuthHint = expoGoOAuthMessage()
  const oauthReady = oauthSignInConfigured()
  const busy = busyAction !== null

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const scrollFieldIntoView = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    })
  }

  const continueGuest = () => {
    signOut()
    completeWelcome()
    router.replace(href("/(tabs)"))
  }

  const completeSignIn = async (
    action: Exclude<BusyAction, null>,
    run: () => Promise<{ message?: string; needsPhone?: boolean }>,
  ) => {
    setBusyAction(action)
    setError(null)
    setNotice(null)
    try {
      const result = await run()
      setNotice(result.message ?? null)
      completeWelcome()
      if (result.needsPhone) {
        router.replace(href("/complete-profile"))
        return
      }
      router.replace(href("/(tabs)"))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign-in failed.")
    } finally {
      setBusyAction(null)
    }
  }

  const submitEmail = async () => {
    setError(null)
    if (emailMode === "signup" && !phoneInputValid(phoneCountryCode, phoneNumber)) {
      setError("Enter a valid mobile number with country code.")
      return
    }
    if (emailMode === "signup") {
      await completeSignIn("email", () =>
        signUpWithEmailPassword(
          email,
          password,
          displayName || email.split("@")[0] || "Member",
          phoneCountryCode,
          phoneNumber,
        ),
      )
      return
    }
    await completeSignIn("email", () => signInWithEmailPassword(email, password))
  }

  const signupReady =
    email.length > 0 &&
    password.length >= 8 &&
    (emailMode !== "signup" || phoneInputValid(phoneCountryCode, phoneNumber))

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            keyboardVisible ? styles.scrollKeyboard : styles.scrollIdle,
            { paddingBottom: keyboardVisible ? spacing.xxl * 4 : spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Image source={brandAssets.emblemClear} style={styles.logo} contentFit="contain" />
            <Text style={styles.eyebrow}>Member account</Text>
            <Text style={styles.title}>Namaskar. Continue your journey.</Text>
            <Text style={styles.body}>
              Sign in to sync favorites, quiz progress, and AI chat across website, Android, and
              iOS.
            </Text>

            {error ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {notice && !error ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {expoGoOAuthHint && oauthReady ? (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>{expoGoOAuthHint}</Text>
              </View>
            ) : null}

            {!oauthReady && !__DEV__ ? (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                  Microsoft and Google sign-in are not configured in this build. Use email sign-in
                  below, or install an updated app build from the team.
                </Text>
              </View>
            ) : null}

            <View style={styles.socialStack}>
              {msalReady ? (
                <PrimaryButton
                  label="Continue with Microsoft"
                  onPress={() => void completeSignIn("microsoft", () => signInMember())}
                  disabled={busy}
                  loading={busyAction === "microsoft"}
                />
              ) : null}
              {googleReady ? (
                <SecondaryButton
                  label="Continue with Google"
                  onPress={() => void completeSignIn("google", () => signInWithGoogleAccount())}
                  disabled={busy}
                  loading={busyAction === "google"}
                />
              ) : __DEV__ ? (
                <View style={styles.hintBox}>
                  <Text style={styles.hintText}>{googleSetupHint()}</Text>
                </View>
              ) : null}
              {facebookReady ? (
                <SecondaryButton
                  label="Continue with Facebook"
                  onPress={() => void completeSignIn("facebook", () => signInWithFacebookAccount())}
                  disabled={busy}
                  loading={busyAction === "facebook"}
                />
              ) : null}
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or email</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.modeRow} accessibilityRole="tablist">
              <ModeTab
                label="Sign in"
                active={emailMode === "signin"}
                onPress={() => {
                  setEmailMode("signin")
                  setError(null)
                }}
                disabled={busy}
              />
              <ModeTab
                label="Create account"
                active={emailMode === "signup"}
                onPress={() => {
                  setEmailMode("signup")
                  setError(null)
                }}
                disabled={busy}
              />
            </View>

            <View style={styles.form}>
              {emailMode === "signup" ? (
                <View style={styles.field}>
                  <FieldLabel>Name</FieldLabel>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    autoCapitalize="words"
                    autoComplete="name"
                    style={styles.input}
                    onFocus={scrollFieldIntoView}
                  />
                </View>
              ) : null}
              {emailMode === "signup" ? (
                <PhoneInput
                  countryCode={phoneCountryCode}
                  nationalNumber={phoneNumber}
                  onCountryCodeChange={setPhoneCountryCode}
                  onNationalNumberChange={setPhoneNumber}
                  disabled={busy}
                />
              ) : null}
              <View style={styles.field}>
                <FieldLabel>Email</FieldLabel>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  style={styles.input}
                  onFocus={scrollFieldIntoView}
                />
              </View>
              <View style={styles.field}>
                <FieldLabel>Password</FieldLabel>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={emailMode === "signup" ? "At least 8 characters" : "Your password"}
                  secureTextEntry
                  autoComplete={emailMode === "signup" ? "new-password" : "password"}
                  style={styles.input}
                  onFocus={scrollFieldIntoView}
                />
              </View>
              <PrimaryButton
                label={emailMode === "signup" ? "Create account" : "Sign in with email"}
                onPress={() => void submitEmail()}
                disabled={busy || !signupReady}
                loading={busyAction === "email"}
              />
            </View>

            {__DEV__ && !memberAuthAvailable() ? (
              <Text style={styles.syncHint}>
                Dev note: add EXPO_PUBLIC_MEMBER_PROXY_KEY to sync favorites, quiz, and chat memory
                with the live API.
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={continueGuest}
              style={styles.guestLink}
              disabled={busy}
            >
              <Text style={styles.guestLinkText}>Continue without account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  scrollIdle: {
    justifyContent: "center",
  },
  scrollKeyboard: {
    justifyContent: "flex-start",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(2),
  },
  logo: { width: 64, height: 64, alignSelf: "center" },
  eyebrow: {
    ...typography.caption,
    textAlign: "center",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  title: {
    fontFamily: "Lora_700Bold",
    fontSize: 26,
    lineHeight: 32,
    color: colors.textPrimary,
    textAlign: "center",
  },
  body: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
  socialStack: { gap: spacing.sm, marginTop: spacing.xs },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.xs },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textMuted },
  modeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  modeTabActive: {
    backgroundColor: colors.textPrimary,
  },
  modeTabText: { ...typography.label, color: colors.textSecondary },
  modeTabTextActive: { color: colors.white },
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label, color: colors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: "#FDEEEE",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#F5C2C2",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: { ...typography.caption, color: colors.error, textAlign: "center" },
  noticeBox: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  hintBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  hintText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  syncHint: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  guestLink: { alignSelf: "center", paddingVertical: spacing.sm },
  guestLinkText: {
    ...typography.label,
    color: colors.secondary,
    textDecorationLine: "underline",
  },
})
