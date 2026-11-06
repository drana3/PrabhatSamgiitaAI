import { useMemo } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { useLocalSearchParams, useRouter } from "expo-router"

import { HomeCover } from "@/components/home/HomeBlocks"
import { ChevronGlyph, KirtanRow, PlayFilled, PsTag } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtans } from "@/hooks/useKirtans"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { useT } from "@/lib/i18n"
import { sampleMixes } from "@/lib/fixtures/kirtanGate"
import { formatKirtanLength } from "@/lib/kirtan/list"
import { mixCaption, playableItems, type MixItem } from "@/lib/kirtan/mix"
import { playMix } from "@/lib/kirtan/mixPlayback"
import { photoForMix } from "@/lib/photos/catalog"
import { href } from "@/utils/href"

/**
 * One mix: songs (muted `PS 3` label) and Kiirtans (orange `KIIRTAN` label) in one order. Play starts
 * at the first item and a tap starts from that row. Every item goes into the ONE queue of the ONE
 * player, so song, Kiirtan, song plays through with no hand-over.
 */
export default function KirtanMixScreen() {
  const bottomInset = useScrollBottomInset()
  const router = useRouter()
  const theme = useSongsTheme()
  const t = useT()
  const params = useLocalSearchParams<{ id?: string }>()
  const actions = useKirtanActions()
  const { byId } = useKirtans()
  const catalog = useSongsV2Catalog()
  const mix = useMemo(() => sampleMixes().find((m) => m.id === params.id) ?? null, [params.id])
  const items = useMemo(() => (mix ? playableItems(mix.items, byId) : []), [mix, byId])
  const photo = useMemo(() => (mix ? photoForMix(mix.id) : null), [mix])

  const play = (index: number) => {
    if (!mix) return
    // `index` counts the playable items; map it back to the mix's own order for playMix.
    const item = items[index]
    const at = item ? mix.items.indexOf(item) : 0
    const message = playMix(mix, Math.max(0, at))
    if (message) actions.flash(message)
  }

  if (!mix) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.page }]}>
        <Text style={[styles.empty, { color: theme.textBody }]}>{t("kt.mix.missing")}</Text>
      </View>
    )
  }

  const top = 54
  const renderItem = ({ item, index }: { item: MixItem; index: number }) => {
    if (item.kind === "kirtan") {
      const k = byId.get(item.id)
      if (!k) return null
      return (
        <KirtanRow
          theme={theme}
          kirtan={k}
          onOpen={() => play(index)}
          onOpenArtist={actions.openArtist}
          trailing={
            <View style={styles.trail}>
              <PlayerIcon name="play" size={18} color={theme.textBody} />
            </View>
          }
        />
      )
    }
    const entry = catalog.byNumber.get(item.number)
    const title = entry?.title ?? `Prabhat Samgiita ${item.number}`
    return (
      <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
        <KPress accessibilityRole="button" accessibilityLabel={`PS ${item.number}, ${title}`} onPress={() => play(index)} pressedScale={0.985} outerStyle={styles.mainOuter} style={styles.main}>
          <HomeCover number={item.number} size={60} radius={14} />
          <View style={styles.text}>
            <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.sub}>
              <PsTag theme={theme} number={item.number} />
              <Text style={[styles.subText, { color: theme.textBody }]} numberOfLines={1}>
                {entry?.durationSeconds ? `Prabhat Samgiita · ${formatKirtanLength(entry.durationSeconds)}` : "Prabhat Samgiita"}
              </Text>
            </View>
          </View>
        </KPress>
        <View style={styles.trail}>
          <PlayerIcon name="play" size={18} color={theme.textBody} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <FlatList
        data={items}
        keyExtractor={(item, i) => `${i}-${item.kind === "ps" ? `ps-${item.number}` : item.id}`}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={
          <View>
            <View style={{ height: top }} />
            <View style={styles.back}>
              <KPress
                accessibilityRole="button"
                accessibilityLabel={t("common.back")}
                onPress={() => (router.canGoBack() ? router.back() : router.replace(href("/v2/today")))}
                pressedScale={0.9}
                style={[styles.backDisc, { backgroundColor: theme.card, borderColor: theme.line }]}
              >
                <View style={styles.flip}>
                  <ChevronGlyph color={theme.textHeading} />
                </View>
              </KPress>
            </View>
            {photo ? (
              <View style={[styles.photo, { backgroundColor: photo.tint }]}>
                <Image source={photo.cover} contentFit="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
              </View>
            ) : null}
            <View style={styles.titleBlock}>
              <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
                {mix.title}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text style={[styles.over, { color: theme.accent }]}>{mixCaption(items, t)}</Text>
              <Text style={[styles.blurb, { color: theme.textBody }]}>{mix.blurb}</Text>
              <KPress accessibilityRole="button" accessibilityLabel={t("kt.mix.playA11y", { title: mix.title })} onPress={() => play(0)} pressedScale={0.98} style={[styles.playBtn, { backgroundColor: theme.brand }]}>
                <PlayFilled size={18} color="#FFFFFF" />
                <Text style={styles.playText}>{t("common.play")}</Text>
              </KPress>
            </View>
          </View>
        }
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      />
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  empty: { fontFamily: amFonts.medium, fontSize: 16 },
  content: { paddingHorizontal: 10, paddingBottom: 190 },
  sep: { height: 10 },
  back: { paddingHorizontal: 10, paddingBottom: 4 },
  backDisc: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  flip: { transform: [{ scaleX: -1 }] },
  photo: { height: 190, borderRadius: 20, marginHorizontal: 10, marginTop: 8, overflow: "hidden" },
  titleBlock: { paddingTop: 12, paddingHorizontal: 10, paddingBottom: 12 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  meta: { paddingHorizontal: 10, paddingBottom: 18, gap: 10 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  blurb: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
  playBtn: { height: 52, borderRadius: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  playText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  row: { minHeight: 84, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingRight: 4 },
  mainOuter: { flex: 1, minWidth: 0 },
  main: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 10 },
  text: { flex: 1, minWidth: 0, gap: 6 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20, letterSpacing: -0.1 },
  sub: { flexDirection: "row", alignItems: "center", gap: 8 },
  subText: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  trail: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
})
