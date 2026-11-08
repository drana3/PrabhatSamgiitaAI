import { useMemo, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Shuffle } from "lucide-react-native"

import { artistGradient, ArtistAvatar } from "@/components/kirtan/ArtistParts"
import { Section, BlockStack } from "@/components/common/Layout"
import { KirtanMenuSheet, KirtanShareSheet } from "@/components/kirtan/KirtanMenus"
import { ChevronGlyph, KirtanRow, PlayFilled } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtans } from "@/hooks/useKirtans"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useT } from "@/lib/i18n"
import { sampleArtists } from "@/lib/fixtures/kirtanGate"
import { artistById, kirtansOfArtist, popularOf } from "@/lib/kirtan/artists"
import { kindsCountLabel } from "@/lib/kirtan/kind"
import { playArtist } from "@/lib/kirtan/mixPlayback"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import { newestFirst } from "@/lib/kirtan/list"
import type { Kirtan } from "@/lib/kirtan/types"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

/**
 * An artist: a big hero with the name in capitals over the gradient (or the photo), "N kiirtans · N bhajans",
 * Play and Shuffle for all of the artist's Kiirtans and Bhajans (one queue in the one player), Popular (up to 5),
 * All recordings (each row carries its KIIRTAN or BHAJAN tag), and a short About. No prices, no albums, no follow.
 * TODO(api): artists, photos and texts come from the backend.
 */
export default function KirtanArtistScreen() {
  const bottomInset = useScrollBottomInset()
  const router = useRouter()
  const theme = useSongsTheme()
  const t = useT()
  const params = useLocalSearchParams<{ id?: string }>()
  const actions = useKirtanActions()
  const { playable } = useKirtans()
  const savedIds = useKirtanStore((s) => s.savedIds)
  const [menu, setMenu] = useState<Kirtan | null>(null)
  const [share, setShare] = useState<Kirtan | null>(null)

  const artist = useMemo(() => artistById(sampleArtists(), params.id), [params.id])
  const all = useMemo(() => (artist ? newestFirst(kirtansOfArtist(artist, playable)) : []), [artist, playable])
  const popular = useMemo(() => popularOf(all, 5), [all])
  const top = useScreenTop()

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan")))
  const onShare = async (k: Kirtan, target: ShareTargetId) => {
    const message = shareToast(await runShare(target, kirtanSharePayload(k)))
    if (message) actions.flash(message)
  }

  if (!artist) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.page }]}>
        <Text style={[styles.body, { color: theme.textBody }]}>{t("kt.artist.missing")}</Text>
        <KPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={back} pressedScale={0.96} style={[styles.pill, { backgroundColor: theme.brand }]}>
          <Text style={styles.pillText}>{t("common.back")}</Text>
        </KPress>
      </View>
    )
  }

  const [from, to] = artistGradient(artist.id)
  const row = (k: Kirtan, context: readonly Kirtan[]) => (
    <KirtanRow key={`${context === popular ? "p" : "a"}-${k.id}`} theme={theme} kirtan={k} compact onOpen={(r) => actions.openIn(r, context, artist)} onMore={setMenu} />
  )

  const header = (
    <View>
      <View style={[styles.hero, { height: 300 + top }]}>
        <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.heroPhoto} pointerEvents="none">
          <ArtistAvatar artist={artist} size={220} />
        </View>
        <LinearGradient pointerEvents="none" colors={["rgba(10,14,8,0)", "rgba(10,14,8,0.7)"]} style={StyleSheet.absoluteFill} />
        <KPress
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={back}
          pressedScale={0.9}
          outerStyle={[styles.back, { top: top + 6 }]}
          style={[styles.backDisc, { backgroundColor: "rgba(255,255,255,0.88)" }]}
        >
          <View style={styles.flip}>
            <ChevronGlyph color="#1E1E1E" />
          </View>
        </KPress>
        <View style={styles.heroText}>
          <Text style={styles.heroEyebrow}>{artist.kind === "group" ? "GROUP" : "SINGER"}</Text>
          <Text style={styles.heroName} accessibilityRole="header">
            {artist.name}
          </Text>
          <Text style={styles.heroMeta}>{kindsCountLabel(all)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <KPress
          accessibilityRole="button"
          accessibilityLabel={t("kt.artist.playA11y", { name: artist.name })}
          onPress={() => actions.flash(playArtist(artist, all) ?? "")}
          pressedScale={0.97}
          outerStyle={styles.actionOuter}
          style={[styles.action, { backgroundColor: theme.brand }]}
        >
          <PlayFilled size={20} color="#FFFFFF" />
          <Text style={styles.actionText}>{t("common.play")}</Text>
        </KPress>
        <KPress
          accessibilityRole="button"
          accessibilityLabel={t("kt.artist.shuffleA11y", { name: artist.name })}
          onPress={() => actions.flash(playArtist(artist, all, { shuffle: true }) ?? "")}
          pressedScale={0.97}
          outerStyle={styles.actionOuter}
          style={[styles.action, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }]}
        >
          <Shuffle size={20} color={theme.textHeading} strokeWidth={2.2} />
          <Text style={[styles.actionText, { color: theme.textHeading }]}>{t("common.shuffle")}</Text>
        </KPress>
      </View>

      {popular.length ? (
        <Section title={t("kt.artist.popular")} size="page">
          <BlockStack gap={8}>{popular.map((k) => row(k, popular))}</BlockStack>
        </Section>
      ) : null}

      {/* no content: the rows of the list below follow, the same distance under the heading as in Popular */}
      <Section title={t("kt.artist.all")} size="page" />
    </View>
  )

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <FlatList
        data={all}
        keyExtractor={(k) => k.id}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => <View style={styles.rowSlot}>{row(item, all)}</View>}
        ListEmptyComponent={<Text style={[styles.body, styles.pad, { color: theme.textBody }]}>{t("kt.artist.empty")}</Text>}
        ListFooterComponent={
          <Section title={t("kt.artist.about")} size="page">
            <Text style={[styles.body, { color: theme.textBody }]}>{artist.about}</Text>
          </Section>
        }
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      />
      <KirtanMenuSheet
        open={Boolean(menu)}
        theme={theme}
        kirtan={menu}
        saved={menu ? savedIds.includes(menu.id) : false}
        onPlayNext={actions.playNext}
        onAddToPlaylist={actions.addToPlaylist}
        onToggleSave={actions.toggleSaved}
        onShare={(k) => setShare(k)}
        onClose={() => setMenu(null)}
      />
      <KirtanShareSheet open={Boolean(share)} theme={theme} kirtan={share} onShare={onShare} onClose={() => setShare(null)} />
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 16 },
  content: { paddingBottom: 128 },
  hero: { overflow: "hidden", justifyContent: "flex-end" },
  heroPhoto: { position: "absolute", right: -40, top: 70, opacity: 0.38 },
  back: { position: "absolute", left: 16 },
  backDisc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  flip: { transform: [{ scaleX: -1 }] },
  heroText: { paddingHorizontal: 20, paddingBottom: 24, gap: 4 },
  heroEyebrow: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, color: "rgba(255,255,255,0.86)" },
  heroName: { fontFamily: amFonts.display, fontSize: 52, lineHeight: 52, letterSpacing: -1.1, textTransform: "uppercase", color: "#FFFFFF" },
  heroMeta: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, color: "rgba(255,255,255,0.9)" },
  actions: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 24 },
  actionOuter: { flex: 1 },
  action: { height: 52, borderRadius: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  rowSlot: { paddingHorizontal: 20 },
  sep: { height: 8 },
  pad: { paddingHorizontal: 20 },
  body: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24 },
  pill: { height: 48, paddingHorizontal: 28, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 16, color: "#FFFFFF" },
})
