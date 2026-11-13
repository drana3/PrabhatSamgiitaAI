import { ScrollView, StyleSheet, Text, View } from "react-native"

import { HOME_INSET, HomeEmpty, HomeSectionHead } from "@/components/home/HomeBlocks"
import { KiirtanCover } from "@/components/kirtan/KiirtanCover"
import { KirtanTag } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useBlocksT, type BlocksKey } from "@/lib/kirtan/blocksCopy"
import { formatKirtanLength } from "@/lib/kirtan/list"
import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"
import { useT } from "@/lib/i18n"
import { recordingSeed } from "@/lib/photos/recordingPhoto"

/** The kinds that have a shelf of their own on the Kiirtan page (Dada, 13 Nov 2026), in the order of the page, with the words of their heading. */
export const SHELF_KINDS: readonly { kind: RecordingKind; first: BlocksKey; second: BlocksKey }[] = [
  { kind: "baba_audio", first: "kb.shelf.baba.first", second: "kb.shelf.baba.second" },
  { kind: "dance_song", first: "kb.shelf.dance.first", second: "kb.shelf.dance.second" },
  { kind: "spiritual_song", first: "kb.shelf.spiritual.first", second: "kb.shelf.spiritual.second" },
]

/**
 * A shelf of one kind: Discourses, Dance music or Spiritual songs. Its cards are the newest recordings of that kind, read from what the
 * app already receives; a kind with none says so in one line instead of hiding (the shelf is the door to the kind). "See all" opens the
 * full list of the kind. A card has the recording's own cover, or the photo the system picks for it (by id and kind), never a bare tile.
 */
export function KindShelf({ p, kind, first, second, items, onSeeAll, onPlay }: { p: AmProto; kind: RecordingKind; first: BlocksKey; second: BlocksKey; items: readonly Kirtan[]; onSeeAll: () => void; onPlay: (k: Kirtan) => void }) {
  const t = useT()
  const tb = useBlocksT()
  const theme = useSongsTheme()
  return (
    <View style={styles.wrap}>
      <HomeSectionHead p={p} first={tb(first)} second={tb(second)} action={{ label: tb("kb.shelf.all"), onPress: onSeeAll }} />
      {items.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {items.map((k) => (
            <KPress key={k.id} accessibilityRole="button" accessibilityLabel={t("kt.card.a11y", { title: k.title, length: formatKirtanLength(k.durationSec ?? 0) })} onPress={() => onPlay(k)} pressedScale={0.97} style={styles.card}>
              <View>
                <KiirtanCover type={k.type} kind={kind} coverUrl={k.thumbnailUrl} width={200} height={120} radius={22} photoSeed={recordingSeed(k)} title={k.title} durationSec={k.durationSec} />
                <View style={styles.length}>
                  <Text style={styles.lengthText}>{formatKirtanLength(k.durationSec ?? 0)}</Text>
                </View>
              </View>
              <View style={styles.meta}>
                <KirtanTag theme={theme} kind={kind} />
              </View>
              <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
                {k.title}
              </Text>
            </KPress>
          ))}
        </ScrollView>
      ) : (
        <HomeEmpty p={p} text={tb("kb.shelf.empty")} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  row: { paddingHorizontal: HOME_INSET, gap: 12 },
  card: { width: 200, gap: 6 },
  length: { position: "absolute", right: 8, bottom: 8, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: "rgba(10,14,8,0.62)", justifyContent: "center" },
  lengthText: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 15, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  title: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
})
