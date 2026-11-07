import { useMemo } from "react"
import { StyleSheet, Text } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { PressBox } from "@/components/learn-v2/PressBox"
import { CardText, CardTitle, LCard, OverlayScreen, Over, Pill } from "@/components/learn-v2/ui"
import { FestivalSongSections } from "@/components/festivals/FestivalSongSections"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { allCollections } from "@/data/collections"
import { protoFor } from "@/constants/tokens/amToday"
import { getFestivalById } from "@/data/festivals"
import { useAmTheme } from "@/hooks/useAmTheme"
import { formatDate, useLanguage, useT } from "@/lib/i18n"
import { festivalText } from "@/lib/i18n/festivalText"
import { daysUntilFestival, festivalPhase } from "@/lib/festivalEve"
import { nowMs } from "@/lib/notifications/clock"
import { href } from "@/utils/href"

/**
 * One observance: its date, a line about it and the way to its songs. A festival with a matching
 * collection opens that collection; any other opens a search by the festival's name. Nothing is
 * suggested that the catalog does not actually hold.
 */
export default function FestivalDetailScreen() {
  const t = useT()
  const language = useLanguage()
  const theme = useAmTheme()
  const router = useRouter()
  const { festivalId } = useLocalSearchParams<{ festivalId: string }>()

  const festival = useMemo(() => getFestivalById(String(festivalId ?? "")), [festivalId])
  // today or tomorrow by the phone's local day (the web preview can move the clock: see lib/notifications/clock.ts)
  const phase = useMemo(() => (festival ? festivalPhase(daysUntilFestival(new Date(nowMs()), festival)) : null), [festival])
  const collection = festival?.relatedCollectionLabel
    ? allCollections.find((item) => item.label === festival.relatedCollectionLabel)
    : undefined

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/festivals"))
  }
  const openCollection = () => {
    if (!collection) return
    router.push(
      href(`/songs-v2-collection?id=${encodeURIComponent(collection.label)}&title=${encodeURIComponent(collection.label)}`),
    )
  }
  const openSearch = () => {
    if (festival) router.push(href(`/search-v2?q=${encodeURIComponent(festival.title)}`))
  }

  return (
    <OverlayScreen theme={theme} onBack={back} label={t("fest.detail.label")}>
      {!festival ? (
        <LCard theme={theme} tone="white">
          {(c) => (
            <>
              <CardTitle color={c.text}>{t("fest.missing.title")}</CardTitle>
              <CardText color={c.body} wide>{t("fest.missing.text")}</CardText>
              <Pill theme={theme} go label={t("fest.title")} onPress={() => router.replace(href("/festivals"))} />
            </>
          )}
        </LCard>
      ) : (
        <>
          <Reveal index={0}>
            <Over color={theme.eyebrow} numeric style={styles.date}>
              {formatDate(new Date(festival.year, festival.month - 1, festival.day), "long")}
              {phase ? ` · ${phase === "today" ? t("fest.today") : t("fest.tomorrow")}` : ""}
            </Over>
            <Text accessibilityRole="header" style={[styles.heading, { color: theme.textHeading }]}>
              {festivalText(festival, language).title}
            </Text>
            <Text style={[styles.sub, { color: theme.textBody }]}>{festivalText(festival, language).subtitle}</Text>
            {festival.expected ? (
              <Text style={[styles.expected, { color: theme.textBody }]}>
                <Text style={styles.expectedLead}>{t("fest.expected")}. </Text>
                {t("fest.expected.why")}
              </Text>
            ) : null}
          </Reveal>
          <Reveal index={1}>
            <LCard theme={theme} tone="white">
              {(c) =>
                collection ? (
                  <>
                    <Over color={c.over}>{t("fest.collection.eyebrow")}</Over>
                    <CardTitle color={c.text}>{collection.label}</CardTitle>
                    <CardText color={c.body} wide>{t("fest.collection.count", { count: collection.count })}</CardText>
                    <Pill theme={theme} go label={t("fest.collection.open")} onPress={openCollection} />
                  </>
                ) : (
                  <>
                    <Over color={c.over}>{t("fest.search.eyebrow")}</Over>
                    <CardTitle color={c.text}>{t("fest.search.title")}</CardTitle>
                    <CardText color={c.body} wide>{t("fest.search.text")}</CardText>
                    <Pill theme={theme} go label={t("fest.search.open")} onPress={openSearch} />
                  </>
                )
              }
            </LCard>
          </Reveal>
          <Reveal index={2}>
            <FestivalSongSections p={protoFor(theme)} festival={festival} />
          </Reveal>
          <Reveal index={3}>
            <PressBox
              accessibilityRole="button"
              accessibilityLabel={t("fest.browse")}
              onPress={() => router.push(href("/collections-v2"))}
              style={styles.browse}
            >
              <Text style={[styles.browseText, { color: theme.eyebrow }]}>{t("fest.browse")}</Text>
            </PressBox>
          </Reveal>
        </>
      )}
    </OverlayScreen>
  )
}

const styles = StyleSheet.create({
  date: { paddingHorizontal: 10 },
  heading: { fontFamily: amFonts.display, fontSize: 34, lineHeight: 36, letterSpacing: -0.7, textTransform: "uppercase", paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
  sub: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24, paddingHorizontal: 10 },
  expected: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 21, paddingHorizontal: 10, paddingTop: 12 },
  expectedLead: { fontFamily: amFonts.semi },
  browse: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  browseText: { fontFamily: amFonts.semi, fontSize: 15 },
})
