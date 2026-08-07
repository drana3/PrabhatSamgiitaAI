import { useState } from "react"
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { Image } from "expo-image"
import { SafeAreaView } from "react-native-safe-area-context"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { SecondaryButton } from "@/components/common/SecondaryButton"
import { brandAssets } from "@/constants/brand"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { facebookAuthConfigured } from "@/lib/facebookAuth"
import { googleAuthConfigured } from "@/lib/googleAuth"
import { memberAuthAvailable } from "@/lib/memberAuth"
import {
  getMicrosoftRedirectUri,
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

export default function SignInScreen() {
  const router = useRouter()
  const completeWelcome = useAuthStore((s) => s.completeWelcome)
  const signOut = useAuthStore((s) => s.signOut)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [emailMode, setEmailMode] = useState<EmailMode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const msalReady = microsoftAuthConfigured()
  const googleReady = googleAuthConfigured()
  const facebookReady = facebookAuthConfigured()
  const redirectUri = msalReady ? getMicrosoftRedirectUri() : null

  const continueGuest = () => {
    signOut()
    completeWelcome()
    router.replace(href("/(tabs)"))
  }

  const completeSignIn = async (action: () => Promise<{ message?: string }>) => {
    setBusy(true)
    setStatus(null)
    try {
      const result = await action()
      setStatus(result.message ?? null)
      completeWelcome()
      router.replace(href("/(tabs)/index"))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign-in failed.")
    } finally {
      setBusy(false)
    }
  }

  const submitEmail = async () => {
    if (emailMode === "signup") {
      await completeSignIn(() =>
        signUpWithEmailPassword(email, password, displayName || email.split("@")[0] || "Member"),
      )
      return
    }
    await completeSignIn(() => signInWithEmailPassword(email, password))
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Image source={brandAssets.emblemClear} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.body}>
          Use the same account across website, Android, and iOS to sync favorites, quiz, certificates, and AI chat memory.
        </Text>
        <Text style={styles.list}>
          {memberAuthAvailable()
            ? "Your member profile is stored in the database and restored on every device you sign into."
            : "Favorites can stay on this device if you continue without a synced member account."}
        </Text>
        {__DEV__ && redirectUri ? (
          <Text style={styles.redirect}>Dev only — Azure redirect URI: {redirectUri}</Text>
        ) : null}

        {busy ? <ActivityIndicator color={colors.primary} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        {msalReady ? (
          <PrimaryButton
            label="Continue with Microsoft"
            onPress={() => void completeSignIn(() => signInMember())}
            disabled={busy}
          />
        ) : null}
        {googleReady ? (
          <PrimaryButton
            label="Continue with Google"
            onPress={() => void completeSignIn(() => signInWithGoogleAccount())}
            disabled={busy}
          />
        ) : null}
        {facebookReady ? (
          <PrimaryButton
            label="Continue with Facebook"
            onPress={() => void completeSignIn(() => signInWithFacebookAccount())}
            disabled={busy}
          />
        ) : null}
        {!msalReady && !googleReady && !facebookReady ? (
          <PrimaryButton
            label="Continue with preview member"
            onPress={() => void completeSignIn(() => signInMember({ preferPreview: true }))}
            disabled={busy}
          />
        ) : null}

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or email</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.modeRow}>
          <SecondaryButton
            label="Sign in"
            onPress={() => setEmailMode("signin")}
            disabled={busy || emailMode === "signin"}
          />
          <SecondaryButton
            label="Sign up"
            onPress={() => setEmailMode("signup")}
            disabled={busy || emailMode === "signup"}
          />
        </View>

        {emailMode === "signup" ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            autoCapitalize="words"
            style={styles.input}
          />
        ) : null}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={emailMode === "signup" ? "Password (8+ characters)" : "Password"}
          secureTextEntry
          style={styles.input}
        />
        <PrimaryButton
          label={emailMode === "signup" ? "Create account" : "Sign in with email"}
          onPress={() => void submitEmail()}
          disabled={busy || !email || password.length < (emailMode === "signup" ? 8 : 1)}
        />

        <SecondaryButton label="Continue without account" onPress={continueGuest} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(2),
  },
  logo: { width: 72, height: 72, alignSelf: "center" },
  title: {
    fontFamily: "Lora_700Bold",
    fontSize: 28,
    color: colors.textPrimary,
    textAlign: "center",
  },
  body: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
  list: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginBottom: spacing.sm },
  redirect: { ...typography.caption, color: colors.primaryDark, textAlign: "center" },
  status: { ...typography.caption, color: colors.primaryDark, textAlign: "center" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.xs },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textMuted },
  modeRow: { flexDirection: "row", gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
})
