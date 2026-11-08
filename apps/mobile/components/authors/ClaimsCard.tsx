import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { PillButton, SectionTitle, SIDE } from "@/components/authors/AuthorsUi"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAuthorRequest } from "@/hooks/useAuthorRequest"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { AUTHOR_CLAIMS_HREF, AUTHOR_FIND_HREF } from "@/lib/authors/constants"
import { useT } from "@/lib/i18n"
import { href } from "@/utils/href"

/**
 * On the author's own page: how many library recordings may be theirs, how many requests wait for the team, and the two
 * ways in (look through the suggestions, or search by hand). A failed count shows the card without numbers: the card is
 * a door, not a report, so it never shows an error of its own.
 */
export function ClaimsCard() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const api = authorsApi()
  const { data } = useAuthorRequest(() => api.claimSummary(), [])
  const suggested = data?.suggested ?? 0
  const pending = data?.pending ?? 0

  return (
    <View style={styles.pad}>
      <SectionTitle theme={theme}>{t("authors.claims.card.title")}</SectionTitle>
      <Text style={[styles.body, { color: theme.textBody }]}>{suggested > 0 ? t("authors.claims.card.some", { count: suggested }) : t("authors.claims.card.none")}</Text>
      {pending > 0 ? <Text style={[styles.waiting, { color: theme.accentText }]}>{t("authors.claims.card.waiting", { count: pending })}</Text> : null}
      <View style={styles.stack}>
        <PillButton theme={theme} tone={suggested > 0 ? "brand" : "line"} label={t("authors.claims.card.look")} onPress={() => router.push(href(AUTHOR_CLAIMS_HREF))} />
        <PillButton theme={theme} tone="line" label={t("authors.claims.card.find")} onPress={() => router.push(href(AUTHOR_FIND_HREF))} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: SIDE, gap: 8 },
  stack: { gap: 10, marginTop: 4 },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  waiting: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
})
