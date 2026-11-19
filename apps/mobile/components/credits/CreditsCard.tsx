import { StyleSheet, Text } from "react-native"
import { useRouter } from "expo-router"

import { PillButton } from "@/components/authors/AuthorsUi"
import { Section, BlockStack } from "@/components/common/Layout"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAuthorRequest } from "@/hooks/useAuthorRequest"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { creditsApi } from "@/lib/credits/api"
import { useT } from "@/lib/i18n"
import { href } from "@/utils/href"

/**
 * On the author's own page: the door to "My credits" (recordings where others named the person) with the number of invitations
 * that wait. A failed count shows the card without a number: the card is a door, never an error.
 */
export function CreditsCard() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const { data } = useAuthorRequest(() => creditsApi().invites(), [])
  const waiting = data?.length ?? 0
  return (
    <Section title={t("credits.mine.bar")}>
      <Text style={[s.body, { color: theme.textBody }]}>{t("credits.mine.lead")}</Text>
      {waiting > 0 ? <Text style={[s.waiting, { color: theme.accentText }]}>{`${t("credits.mine.invitations")}: ${waiting}`}</Text> : null}
      <BlockStack>
        {waiting > 0 ? <PillButton theme={theme} size="compact" label={t("credits.mine.invitationsOpen")} onPress={() => router.push(href("/credit-invites"))} /> : null}
        <PillButton theme={theme} size="compact" tone="line" label={t("credits.mine.bar")} onPress={() => router.push(href("/my-credits"))} />
      </BlockStack>
    </Section>
  )
}

const s = StyleSheet.create({
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  waiting: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
})
