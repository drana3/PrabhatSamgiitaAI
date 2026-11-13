import { StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ChevronRight, History } from "lucide-react-native"

import { HOME_INSET, HomeSectionHead, HomeShelf } from "@/components/home/HomeBlocks"
import { CARD_W, ShelfCard } from "@/components/search-v2/MenuShelves"
import { TodayPress } from "@/components/today/TodayPress"
import type { AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtans } from "@/hooks/useKirtans"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { demoCatalog, parseStage } from "@/lib/fixtures/searchMenuDemo"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { MENU_RULES } from "@/lib/searchMenu/config"
import { shelfItems } from "@/lib/searchMenu/live"
import { href } from "@/utils/href"

const NO_STATS = { bhajanLanguages: {}, listener: undefined }
const SHOWN = 10

/**
 * Two additions to Today (the shelf Home): a shelf of Baba's Audio Discourses (hidden while there are none; the head's button
 * opens the whole list) and one quiet row: "My listening history". The shelf shows under "All" and "Kiirtan", the
 * link under "All". The old "Top played" row is gone: the "Most played" shelf (TodayMostPlayed) opens the same screen with its "Top 100" button.
 */
export function TodayListeningExtras({ p, filter }: { p: AmProto; filter: string }) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const kActions = useKirtanActions()
  const params = useLocalSearchParams<{ menu?: string }>()
  const { playable } = useKirtans()
  const stage = MOCKUP_DATA ? (parseStage(params.menu) ?? "grown") : null
  const catalog = stage ? demoCatalog(playable, stage) : playable
  const baba = shelfItems("baba", catalog, NO_STATS, Date.now())
  const showBaba = (filter === "all" || filter === "kiirtan") && baba.length >= MENU_RULES.baba.on

  return (
    <>
      {showBaba ? (
        <View style={s.sect}>
          <HomeSectionHead
            p={p}
            eyebrow={t("searchMenu.baba.title")}
            first={t("today.baba.first")}
            second={t("today.baba.second")}
            action={{ label: t("today.baba.more"), onPress: () => router.push(href("/browse-shelf?id=baba")) }}
          />
          <HomeShelf itemWidth={CARD_W} gap={10}>
            {baba.slice(0, SHOWN).map((k) => (
              <ShelfCard key={k.id} theme={theme} kirtan={k} onPress={() => kActions.open(k, baba, t("searchMenu.baba.title"))} />
            ))}
          </HomeShelf>
        </View>
      ) : null}
      {filter === "all" ? (
        <View style={s.linkWrap}>
          <TodayPress accessibilityRole="button" accessibilityLabel={t("history.link")} onPress={() => router.push(href("/listening-history"))} pressedScale={0.98} style={[s.link, { backgroundColor: p.white, borderColor: p.sand300 }]}>
            <View style={[s.mark, { backgroundColor: p.orange100 }]}>
              <History size={20} color={p.orange700} strokeWidth={1.9} />
            </View>
            <View style={s.linkText}>
              <Text style={[s.linkTitle, { color: p.ink800 }]}>{t("history.link")}</Text>
              <Text style={[s.linkSub, { color: p.ink500 }]} numberOfLines={1}>{t("history.link.sub")}</Text>
            </View>
            <ChevronRight size={20} color={p.ink500} strokeWidth={1.9} />
          </TodayPress>
        </View>
      ) : null}
    </>
  )
}

const s = StyleSheet.create({
  sect: { gap: 16 },
  linkWrap: { paddingHorizontal: HOME_INSET },
  link: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 72, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16 },
  mark: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  linkText: { flex: 1, gap: 2 },
  linkTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  linkSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
})
