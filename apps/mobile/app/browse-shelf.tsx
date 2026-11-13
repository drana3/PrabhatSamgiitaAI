import { useMemo } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { KirtanRow } from "@/components/kirtan/KirtanParts"
import { SpRound } from "@/components/song-v2/SpUi"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSearchMenu } from "@/hooks/useSearchMenu"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { labelFromId, shelfCountLabel, shelfItems, shelfTitle } from "@/lib/searchMenu/live"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

/**
 * The whole list behind a shelf of the Search menu ("See all"): `/browse-shelf?id=<shelf id>`. It holds the same
 * recordings the shelf counted, so the number in its header matches the number of rows. A shelf that is empty now
 * (a link kept from before) says so and offers the way back instead of an empty page.
 */
export default function BrowseShelfScreen() {
  const tr = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const inset = useScreenTop()
  const bottomInset = useScrollBottomInset()
  const params = useLocalSearchParams<{ id?: string; menu?: string }>()
  const id = typeof params.id === "string" ? params.id : ""
  const kActions = useKirtanActions()
  const menu = useSearchMenu(params.menu)

  const label = useMemo(() => labelFromId(id, menu.stats.authors), [id, menu.stats.authors])
  const items = useMemo(() => (label ? shelfItems(id, menu.kirtans, menu.stats, menu.now) : []), [id, label, menu])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the title follows the language
  const title = useMemo(() => (label ? shelfTitle({ label }) : ""), [label, tr])

  const back = () => (router.canGoBack() ? router.back() : router.replace(href(NAV_V2_HOME_ROUTE)))

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: inset, backgroundColor: theme.page }]}>
        <View style={s.titleRow}>
          <SpRound t={sp} icon="back" label={tr("common.back")} onPress={back} />
          <View style={s.titleText}>
            <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2} accessibilityRole="header">
              {title}
            </Text>
            {items.length ? <Text style={[s.count, { color: theme.textBody }]}>{shelfCountLabel(items.length)}</Text> : null}
          </View>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(k) => k.id}
        renderItem={({ item }) => (
          <View style={s.rowWrap}>
            <KirtanRow theme={theme} kirtan={item} onOpen={(k) => kActions.open(k, items, title)} onOpenArtist={kActions.openArtist} />
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: theme.textBody }]}>{tr(label ? "searchMenu.shelf.gone" : "searchMenu.shelf.empty")}</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset, paddingTop: 8 }}
        initialNumToRender={14}
        windowSize={7}
      />
      <Toast message={kActions.toast} theme={theme} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { zIndex: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: 16, minHeight: 56 },
  titleText: { flex: 1, gap: 2 },
  title: { fontFamily: amFonts.display, fontSize: 26, lineHeight: 29, letterSpacing: -0.5, textTransform: "uppercase" },
  count: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  rowWrap: { paddingHorizontal: 16, paddingVertical: 4 },
  empty: { paddingHorizontal: 24, paddingTop: 48, alignItems: "center" },
  emptyText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, textAlign: "center" },
})
