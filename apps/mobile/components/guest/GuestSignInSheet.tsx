import { useCallback, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpringSheet } from "@/components/assistant-v2/SpringSheet"
import { AccountButton, InlineError } from "@/components/account/AccountUi"
import { AppleMark, GoogleMark } from "@/components/account/BrandMarks"
import { AgeNotice } from "@/components/auth/AgeConfirm"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { appleSignInOffered } from "@/lib/appleAuth"
import { afterSignIn, authErrorMessage, visibleProviders } from "@/lib/auth/signInFlow"
import { promptCopy, type GuestPromptKind } from "@/lib/guest/signInPrompt"
import { googleAuthConfigured } from "@/lib/googleAuth"
import { isDarkTheme } from "@/lib/navV2"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { signInWithAppleAccount, signInWithGoogleAccount } from "@/lib/session"
import { useSaveSheetStore } from "@/stores/saveSheetStore"
import { href } from "@/utils/href"

type Props = {
  visible: boolean
  kind: GuestPromptKind
  /** Not now, a swipe down, the scrim or Back, or a finished sign-in. */
  onClose: () => void
}

type Busy = "apple" | "google" | null

/**
 * "Keep your saved songs" (and "Sign in to upload", "Sign in to comment"): the white sheet over whatever the guest was
 * doing. Apple and Google sign in right here, the email button goes to the sign-in page, Not now closes it. The
 * guest's saved songs join the account in the sign-in itself (lib/session.ts), so nothing else is asked here.
 * Same layout as the board in Для-Дады/онбординг-v2 ("Предложение войти гостю"): two-line title, one line of why,
 * three 52 pt buttons, a quiet Not now.
 */
export function GuestSignInSheet({ visible, kind, onClose }: Props) {
  const t = useT()
  const router = useRouter()
  const am = useAmTheme()
  const songs = useSongsTheme()
  const dark = isDarkTheme(am)
  const showToast = useSaveSheetStore((s) => s.showToast)
  const copy = promptCopy(kind)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const retry = useRef<(() => void) | null>(null)
  const providers = visibleProviders({ apple: appleSignInOffered(), google: googleAuthConfigured(), microsoft: false }, MOCKUP_DATA)

  const run = useCallback(
    async (action: Exclude<Busy, null>, task: () => Promise<{ needsName?: boolean; needsPhone?: boolean }>) => {
      retry.current = () => void run(action, task)
      setBusy(action)
      setError(null)
      try {
        if (MOCKUP_DATA) {
          // Preview: never touch the real sign-in or the session (same as the sign-in page).
          await new Promise((resolve) => setTimeout(resolve, 900))
          throw new Error(t("account.error.previewOff"))
        }
        const result = await task()
        const next = afterSignIn(result, false)
        onClose()
        if (next.to === "complete-profile") router.push(href(next.path))
        else if (kind === "saves") showToast(t("guest.signedIn.saved"))
      } catch (failure) {
        // closing the Apple or Google window is not an error: authErrorMessage says so with null
        setError(authErrorMessage(failure))
      } finally {
        setBusy(null)
      }
    },
    [kind, onClose, router, showToast, t],
  )

  const inactive = busy !== null
  const heading = (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.title, { color: am.textHeading }]}>
        {copy.first}
        {"\n"}
        <Text style={{ color: am.headingSecond }}>{copy.second}</Text>
      </Text>
      <Text style={[styles.body, { color: am.textBody }]}>{copy.body}</Text>
    </View>
  )

  return (
    <SpringSheet
      visible={visible}
      onClose={onClose}
      title={t("account.signIn.title")}
      theme={am}
      surface={dark ? am.card : undefined}
      edge={dark ? am.glassEdge : undefined}
      heading={heading}
    >
      <View style={styles.stack}>
        {providers.apple ? (
          <AccountButton
            theme={songs}
            tone="black"
            label={t("account.continueWith", { provider: "Apple" })}
            icon={<AppleMark size={20} />}
            loading={busy === "apple"}
            disabled={inactive && busy !== "apple"}
            onPress={() => void run("apple", () => signInWithAppleAccount())}
          />
        ) : null}
        {providers.google ? (
          <AccountButton
            theme={songs}
            tone="white"
            label={t("account.continueWith", { provider: "Google" })}
            icon={<GoogleMark size={20} />}
            loading={busy === "google"}
            disabled={inactive && busy !== "google"}
            onPress={() => void run("google", () => signInWithGoogleAccount())}
          />
        ) : null}
        <AccountButton
          theme={songs}
          tone="ghost"
          label={t("account.continueEmail")}
          disabled={inactive}
          onPress={() => {
            onClose()
            router.push(href("/signin"))
          }}
        />
        {error ? (
          <InlineError theme={songs} onRetry={() => retry.current?.()}>
            {error}
          </InlineError>
        ) : null}
        {providers.apple || providers.google ? <AgeNotice theme={songs} /> : null}
      </View>
      <AccountButton theme={songs} tone="quiet" label={t("common.notNow")} disabled={inactive} onPress={onClose} style={styles.notNow} />
    </SpringSheet>
  )
}

const styles = StyleSheet.create({
  heading: { paddingTop: 20, paddingBottom: 12, gap: 12 },
  title: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 28, letterSpacing: -0.56, textTransform: "uppercase" },
  body: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 22 },
  stack: { gap: 12, marginTop: 12, paddingHorizontal: 10 },
  notNow: { marginTop: 8, marginHorizontal: 10, alignSelf: "stretch" },
})
