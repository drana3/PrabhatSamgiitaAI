import { StyleSheet, Text } from "react-native"
import { useRouter } from "expo-router"

import { CardText, CardTitle, OverlayScreen, Over, PageHeading } from "@/components/learn-v2/ui"
import { PressBox } from "@/components/learn-v2/PressBox"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { getUpcomingFestivals, type FestivalListItem } from "@/data/festivals"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLanguage, useT } from "@/lib/i18n"
import { festivalText } from "@/lib/i18n/festivalText"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { href } from "@/utils/href"

/**
 * Upcoming observances with confirmed dates (data/festivals.ts). Dates that are not confirmed are not
 * listed and not hinted at: see docs/festival-calendar.md.
 */
export default function FestivalsScreen() {
  const t = useT()
  const language = useLanguage()
  const router = useRouter()
  const theme = useAmTheme()
  const upcoming = getUpcomingFestivals(new Date(), 20)

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(NAV_V2_HOME_ROUTE))
  }
  const when = (item: FestivalListItem) =>
    item.daysUntil === 0
      ? t("fest.today")
      : item.daysUntil === 1
        ? t("fest.tomorrow")
        : t("fest.inDays", { count: item.daysUntil })

  return (
    <OverlayScreen theme={theme} onBack={back} label={t("fest.title")}>
      <PageHeading theme={theme} first={t("fest.heading.first")} second={t("fest.heading.second")} />
      {upcoming.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textBody }]}>{t("fest.empty")}</Text>
      ) : (
        upcoming.map((item, index) => (
          <Reveal key={item.id} index={Math.min(index, 6)}>
            <PressBox
              accessibilityRole="button"
              accessibilityLabel={t("fest.open.a11y", { title: festivalText(item, language).title, date: item.dateLabel })}
              onPress={() => router.push(href(`/festival/${item.id}`))}
              pressedScale={0.98}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}
            >
              <Over color={theme.eyebrow} numeric>{`${item.dateLabel} · ${when(item)}`}</Over>
              <CardTitle color={theme.textHeading}>{festivalText(item, language).title}</CardTitle>
              <CardText color={theme.textBody} wide>{festivalText(item, language).subtitle}</CardText>
            </PressBox>
          </Reveal>
        ))
      )}
    </OverlayScreen>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 8 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24, paddingHorizontal: 10 },
})
