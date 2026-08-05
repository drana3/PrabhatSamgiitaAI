import { useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
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
import { memberAuthAvailable } from "@/lib/memberAuth"
import { getMicrosoftRedirectUri, microsoftAuthConfigured, signInMember } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

export default function SignInScreen() {
  const router = useRouter()
  const completeWelcome = useAuthStore((s) => s.completeWelcome)
  const signOut = useAuthStore((s) => s.signOut)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const msalReady = microsoftAuthConfigured()
  const redirectUri = msalReady ? getMicrosoftRedirectUri() : null

  const continueGuest = () => {
    signOut()
    completeWelcome()
    router.replace(href("/(tabs)"))
  }

  const signIn = async (preferPreview = false) => {
    setBusy(true)
    setStatus(null)
    try {
      const result = await signInMember({ preferPreview: preferPreview || !msalReady })
      setStatus(result.message)
      completeWelcome()
      router.replace(href("/(tabs)"))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign-in failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Image source={brandAssets.emblemClear} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.body}>
          {msalReady
            ? "Sign in with the same Microsoft account you use on the website to sync favorites, quiz, and chat."
            : "You can continue as a guest, or use a preview member session on this device."}
        </Text>
        <Text style={styles.list}>
          {memberAuthAvailable()
            ? "Favorites, quiz, feedback, and AI chat memory sync with your member profile when signed in."
            : "Favorites can stay on this device if you continue without a synced member account."}
        </Text>
        {__DEV__ && redirectUri ? (
          <Text style={styles.redirect}>Dev only — Azure redirect URI: {redirectUri}</Text>
        ) : null}

        {busy ? <ActivityIndicator color={colors.primary} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <PrimaryButton
          label={msalReady ? "Continue with Microsoft" : "Continue with preview member"}
          onPress={() => void signIn(false)}
          disabled={busy}
        />
        {msalReady && __DEV__ ? (
          <SecondaryButton
            label="Continue with preview member (dev)"
            onPress={() => void signIn(true)}
          />
        ) : null}
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
})
