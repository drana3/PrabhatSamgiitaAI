import { useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { InlineError } from "@/components/account/AccountUi"
import { PillButton, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { CreditsFrame } from "@/components/credits/CreditsFrame"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { AUTHORS_HREF } from "@/lib/authors/constants"
import { say } from "@/lib/authors/text"
import { creditsApi } from "@/lib/credits/api"
import { useT } from "@/lib/i18n"
import { tokenFromLink } from "@/lib/kirtan/credits"
import { errorKeyOf } from "@/stores/authorStore"
import { href } from "@/utils/href"

/**
 * An invitation link ( …/credit/<token> ): the uploader gave it to a person who had no account when they were named. The person
 * signs in, makes an author page if they have none, and says "Yes, it's me". "Not me" only leaves the screen: the link keeps
 * working for the person it was meant for, until it is used or runs out.
 */
export default function CreditLinkScreen() {
  const t = useT()
  const params = useLocalSearchParams<{ token?: string | string[] }>()
  const raw = Array.isArray(params.token) ? params.token[0] : params.token
  const token = tokenFromLink(raw)
  return <CreditsFrame title={t("credits.link.bar")} needPage>{() => (token ? <Body token={token} /> : <Bad />)}</CreditsFrame>
}

function Bad() {
  const t = useT()
  const theme = useSongsTheme()
  return <StateBlock theme={theme} tone="error" title={t("credits.link.bad")} />
}

function Body({ token }: { token: string }) {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const bottom = useScrollBottomInset()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const yes = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await creditsApi().acceptLink(token)
      setDone(true)
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setBusy(false)
    }
  }

  const leave = () => (router.canGoBack() ? router.back() : router.replace(href(AUTHORS_HREF)))

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottom + 32, gap: 16, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
      <View style={s.pad}>
        <Text style={[s.heading, { color: theme.textHeading }]} accessibilityRole="header">
          {t("credits.link.title")}
        </Text>
        <Text style={[s.body, { color: theme.textBody }]}>{t("credits.link.lead")}</Text>
        {error ? <InlineError theme={theme}>{say(t, error)}</InlineError> : null}
        {done ? (
          <Text style={[s.note, { color: theme.accentText }]} accessibilityLiveRegion="polite" testID="credit-link-done">
            {t("credits.link.done")}
          </Text>
        ) : (
          <View style={s.actions}>
            <PillButton theme={theme} size="compact" busy={busy} label={t("credits.link.yes")} onPress={() => void yes()} />
            <PillButton theme={theme} size="compact" tone="line" disabled={busy} label={t("credits.link.no")} onPress={leave} />
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: SIDE, gap: 12 },
  heading: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
})
