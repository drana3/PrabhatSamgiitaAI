import { useEffect, useMemo } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { HomeCover } from "@/components/home/HomeBlocks"
import { KirtanRow, KirtanScreenHead, PlayFilled, PsTag, ChevronGlyph } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtans } from "@/hooks/useKirtans"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { MIX_FIXTURES } from "@/lib/fixtures/kirtan"
import { formatKirtanLength } from "@/lib/kirtan/list"
import { handoffAfter, mixCaption, playableItems, runFrom, songRunFinished, type MixItem } from "@/lib/kirtan/mix"
import { newSession, startMixItem } from "@/lib/kirtan/mixPlayback"
import { useKirtanPlayerStore } from "@/stores/kirtanPlayerStore"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

/**
 * One mix: songs (muted `PS 3` label) and kirtans (orange `KIRTAN` label) in one order. Play starts
 * at the first item; a tap starts the mix from that row. Songs play in the song player, kirtans in
 * the kirtan player, and when one kind ends the other player opens. That hand-over is not gapless.
 */
export default function KirtanMixScreen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const params = useLocalSearchParams<{ id?: string }>()
  const actions = useKirtanActions()
  const { byId } = useKirtans()
  const catalog = useSongsV2Catalog()
  const mix = useMemo(() => MIX_FIXTURES.find((m) => m.id === params.id) ?? null, [params.id])
  const items = useMemo(() => (mix ? playableItems(mix.items, byId) : []), [mix, byId])

  const navigate = (path: string) => router.push(href(path))
  const play = (index: number) => {
    if (!mix || !items[index]) return
    startMixItem(navigate, newSession(mix, items, index), index)
  }

  // When the last song of a run ends, open the kirtan player for what follows (best effort, see the report).
  useEffect(() => {
    if (!mix) return
    let handed = false
    const check = () => {
      const session = useKirtanPlayerStore.getState().mix
      if (handed || !session || session.mixId !== mix.id) return
      if (!songRunFinished(session, usePlayerStore.getState())) return
      const run = runFrom(session.items, session.index)
      if (!run) return
      const after = handoffAfter(session.items, run.end)
      handed = true
      if (after.action === "done") {
        useKirtanPlayerStore.getState().endMix()
        return
      }
      startMixItem((path) => router.replace(href(path)), session, after.index)
    }
    return usePlayerStore.subscribe(check)
  }, [mix, router])

  if (!mix) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.page }]}>
        <Text style={[styles.empty, { color: theme.textBody }]}>This mix does not exist.</Text>
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
          onOpen={() => {
            play(index)
          }}
          trailing={<View style={styles.trail}><PlayerIcon name="play" size={18} color={theme.textBody} /></View>}
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
              <KPress accessibilityRole="button" accessibilityLabel="Back to Mixes" onPress={() => (router.canGoBack() ? router.back() : router.replace(href("/v2/songs?source=mixes")))} pressedScale={0.9} style={[styles.backDisc, { backgroundColor: theme.card, borderColor: theme.line }]}>
                <View style={styles.flip}>
                  <ChevronGlyph color={theme.textHeading} />
                </View>
              </KPress>
            </View>
            <KirtanScreenHead theme={theme} title={mix.title} logo={false} />
            <View style={styles.meta}>
              <Text style={[styles.over, { color: theme.accent }]}>{mixCaption(items)}</Text>
              <Text style={[styles.blurb, { color: theme.textBody }]}>{mix.blurb}</Text>
              <KPress accessibilityRole="button" accessibilityLabel={`Play ${mix.title}`} onPress={() => play(0)} pressedScale={0.98} style={[styles.playBtn, { backgroundColor: theme.brand }]}>
                <PlayFilled size={18} color="#FFFFFF" />
                <Text style={styles.playText}>Play</Text>
              </KPress>
              <Text style={[styles.note, { color: theme.textBody }]}>Songs play in the song player, kirtans in the YouTube player. The other player opens when it is its turn, with a short pause between.</Text>
            </View>
          </View>
        }
        renderItem={renderItem}
        contentContainerStyle={styles.content}
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
  content: { paddingHorizontal: 10, paddingBottom: 120 },
  sep: { height: 10 },
  back: { paddingHorizontal: 10, paddingBottom: 4 },
  backDisc: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  flip: { transform: [{ scaleX: -1 }] },
  meta: { paddingHorizontal: 10, paddingBottom: 18, gap: 10 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  blurb: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
  playBtn: { height: 52, borderRadius: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  playText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  row: { minHeight: 84, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingRight: 4 },
  mainOuter: { flex: 1, minWidth: 0 },
  main: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 10 },
  text: { flex: 1, minWidth: 0, gap: 6 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20, letterSpacing: -0.1 },
  sub: { flexDirection: "row", alignItems: "center", gap: 8 },
  subText: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  trail: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
})
