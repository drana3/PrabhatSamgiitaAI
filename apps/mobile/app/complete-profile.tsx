import { DEFAULT_PHONE_COUNTRY, formatPhonePayload } from "@prabhat/core"
import { useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { keyboardBehavior } from "@/lib/keyboardBehavior"
import { AccountBar, AccountButton, AccountField, ACCOUNT_SIDE, InlineError, topInset } from "@/components/account/AccountUi"
import { PhoneField, phoneError } from "@/components/account/PhoneField"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { NAME_MAX, normalizeName, validateName } from "@/lib/profile/validate"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authErrorMessage } from "@/lib/auth/signInFlow"
import { apiBaseUrl } from "@/lib/client"
import { buildMemberAuthHeaders, memberAuthAvailable } from "@/lib/memberAuth"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { localProfileSink } from "@/lib/profile/localSink"
import { saveProfile } from "@/lib/profile/saveProfile"
import { refreshMemberSession } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"
import { t as tPlain, useT } from "@/lib/i18n"
import { href } from "@/utils/href"

/**
 * One-time page after sign-in for what the provider did not give: the name (Apple only sends it the
 * first time) and/or the mobile number the member account needs. `?name=1` and `?phone=1` say which;
 * with neither it asks for the number, as it always did. A missing name can be skipped, the number can
 * not. Preview only: with EXPO_PUBLIC_MOCKUP_DATA=1 nothing is sent anywhere.
 */
export default function CompleteProfileScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const inset = topInset(insets.top)
  const openedAt = useRevealClock()
  const params = useLocalSearchParams<{ name?: string; phone?: string; state?: string }>()
  const needsName = params.name === "1"
  const needsPhone = params.phone === "1" || !needsName
  const preview = MOCKUP_DATA ? params.state : undefined

  const [name, setName] = useState("")
  const [countryCode, setCountryCode] = useState(DEFAULT_PHONE_COUNTRY.code)
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(preview === "error")
  const [error, setError] = useState<string | null>(
    preview === "error" ? t("account.error.network") : null,
  )
  const phoneRef = useRef<TextInput>(null)

  const nameCheck = useMemo(() => validateName(name), [name])
  const nameError = needsName && touched && !nameCheck.ok ? nameCheck.error : null
  const phoneProblem = needsPhone && touched ? phoneError(countryCode, phone) : null

  const leave = () => router.replace(href("/(tabs)"))

  const submit = async () => {
    setTouched(true)
    if (needsName && !nameCheck.ok) return
    if (needsPhone && phoneError(countryCode, phone)) return
    setBusy(true)
    setError(null)
    try {
      if (MOCKUP_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 600))
        leave()
        return
      }
      if (needsName) {
        const saved = await saveProfile({ name }, localProfileSink)
        if (!saved.ok) throw new Error(saved.error)
        await rememberAppleName(normalizeName(name))
      }
      if (needsPhone) await savePhone(countryCode, phone)
      leave()
    } catch (failure) {
      setError(authErrorMessage(failure) ?? t("account.error.saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  const title = needsName && needsPhone ? t("account.complete.title.both") : needsName ? t("account.complete.title.name") : t("account.complete.title.phone")
  const lead =
    needsName && needsPhone
      ? t("account.complete.lead.both")
      : needsName
        ? t("account.complete.lead.name")
        : t("account.complete.lead.phone")

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page }]}>
        <AccountBar theme={theme} title={title} onBack={() => (router.canGoBack() ? router.back() : leave())} inset={inset} />
        <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior(Platform.OS)}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            <SongsReveal index={1}>
              <Text style={[styles.lead, { color: theme.textBody }]}>{lead}</Text>
            </SongsReveal>

            <SongsReveal index={2} style={styles.form}>
              {needsName ? (
                <AccountField
                  theme={theme}
                  label={t("common.name")}
                  value={name}
                  onChangeText={setName}
                  onBlur={() => setTouched(true)}
                  error={nameError}
                  hint={t("account.edit.nameHint")}
                  autoFocus
                  autoCapitalize="words"
                  autoComplete="name"
                  autoCorrect={false}
                  returnKeyType={needsPhone ? "next" : "done"}
                  maxLength={NAME_MAX + 20}
                  editable={!busy}
                  onSubmitEditing={() => (needsPhone ? phoneRef.current?.focus() : void submit())}
                />
              ) : null}
              {needsPhone ? (
                <PhoneField
                  theme={theme}
                  countryCode={countryCode}
                  nationalNumber={phone}
                  onCountryCodeChange={setCountryCode}
                  onNationalNumberChange={setPhone}
                  error={phoneProblem}
                  disabled={busy}
                />
              ) : null}
              {error ? (
                <InlineError theme={theme} onRetry={() => void submit()}>
                  {error}
                </InlineError>
              ) : null}
            </SongsReveal>
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: theme.page, borderTopColor: theme.line, paddingBottom: Platform.OS === "web" ? 20 : Math.max(insets.bottom, 12) + 8 }]}>
            <AccountButton theme={theme} label={t("common.continue")} onPress={() => void submit()} loading={busy} />
            {needsName && !needsPhone ? (
              <AccountButton theme={theme} tone="quiet" label={t("account.complete.skip")} onPress={leave} disabled={busy} />
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </RevealClock.Provider>
  )
}

/** Apple sends the name once: keep the one the person typed for the next sign-in. */
async function rememberAppleName(name: string) {
  const { identityProvider, memberId } = useAuthStore.getState()
  if (identityProvider !== "apple" || !memberId) return
  try {
    const { rememberAppleDisplayName } = await import("@/lib/appleAuth")
    await rememberAppleDisplayName(memberId, name)
  } catch {
    // Best-effort: the name is already saved on this phone.
  }
}

async function savePhone(countryCode: string, nationalNumber: string) {
  if (!memberAuthAvailable()) throw new Error(tPlain("account.error.apiMissing"))
  const { email, displayName, memberId, identityProvider } = useAuthStore.getState()
  if (!email) throw new Error(tPlain("account.error.signInAgain"))
  const response = await fetch(`${apiBaseUrl}/api/v1/members/phone`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildMemberAuthHeaders(email, displayName, memberId, identityProvider || "aad"),
    },
    body: JSON.stringify(formatPhonePayload(countryCode, nationalNumber)),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : tPlain("account.complete.phoneFailed"),
    )
  }
  await refreshMemberSession()
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: ACCOUNT_SIDE, paddingTop: 8, paddingBottom: 32, gap: 24 },
  lead: { fontFamily: amFonts.medium, fontSize: 17, lineHeight: 25 },
  form: { gap: 20 },
  footer: { paddingHorizontal: ACCOUNT_SIDE, paddingTop: 12, gap: 4, borderTopWidth: StyleSheet.hairlineWidth },
})
