import { useState } from "react"
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import Constants from "expo-constants"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { buildMemberAuthHeaders, memberAuthAvailable } from "@/lib/memberAuth"
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhonePayload,
  validateNationalPhoneNumber,
} from "@prabhat/core"
import { useAuthStore } from "@/stores/authStore"

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "http://localhost:8000"

export default function CompleteProfileScreen() {
  const router = useRouter()
  const [countryCode, setCountryCode] = useState(DEFAULT_PHONE_COUNTRY.code)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const validationError = validateNationalPhoneNumber(countryCode, phoneNumber)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!memberAuthAvailable()) {
      setError("Member API is not configured on this build.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { email, displayName, memberId, identityProvider } = useAuthStore.getState()
      if (!email) throw new Error("Sign in again to continue.")
      const response = await fetch(`${apiBaseUrl}/api/v1/members/phone`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...buildMemberAuthHeaders(email, displayName, memberId, identityProvider || "aad"),
        },
        body: JSON.stringify(formatPhonePayload(countryCode, phoneNumber)),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
            ? body.detail
            : "Could not save your mobile number.",
        )
      }
      router.replace("/(tabs)")
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save phone.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Add your mobile number</Text>
        <Text style={styles.body}>
          Every member account needs a mobile number with country code. India uses +91 and a
          10-digit number starting with 6–9.
        </Text>
        <TextInput
          value={countryCode}
          onChangeText={(value) => setCountryCode(value.toUpperCase().slice(0, 2))}
          placeholder="Country (IN)"
          autoCapitalize="characters"
          style={styles.input}
        />
        <TextInput
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Mobile number"
          keyboardType="phone-pad"
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
        <PrimaryButton label="Continue" onPress={() => void submit()} disabled={busy} />
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
  },
  title: {
    fontFamily: "Lora_700Bold",
    fontSize: 28,
    color: colors.textPrimary,
    textAlign: "center",
  },
  body: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
  error: { ...typography.caption, color: colors.error, textAlign: "center" },
})
