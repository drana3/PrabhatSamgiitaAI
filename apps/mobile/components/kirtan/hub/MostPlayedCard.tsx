import { StyleSheet, Text, View } from "react-native"
import { ChevronRight, TrendingUp } from "lucide-react-native"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { KPress } from "@/components/kirtan/KPress"
import { PhotoSurface } from "@/components/photos/PhotoSurface"
import { amColors, amPhotoChip } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import type { ChartCardData } from "@/hooks/useKiirtanCharts"
import { useBlocksT } from "@/lib/kirtan/blocksCopy"
import type { ChartLine } from "@/lib/kirtan/charts"
import { MOST_PLAYED_VARIANT, type MostPlayedVariant } from "@/lib/kirtan/mostPlayedVariant"
import { useT } from "@/lib/i18n"
import { photoForSeed } from "@/lib/photos/catalog"

/**
 * "Most played": ONE card (Dada, 12 Nov 2026), drawn only while the week chart has enough rows (lib/kirtan/charts.ts). It names places 1 to 3,
 * no numbers of plays; the numbers and the switch Week / Month / All time live on the screen it opens (app/top-played.tsx).
 * Dada did not like the first design, so there are three (13 Nov 2026), and three more without lines or a framed card (D, E, F, same day) and ONE constant picks the one the page draws
 * (lib/kirtan/mostPlayedVariant.ts). The picture of a place is a photo the system picks by the recording's name (the chart carries no
 * cover), the same every time.
 */
export function MostPlayedCard({ p, card, onOpen, variant = MOST_PLAYED_VARIANT }: { p: AmProto; card: ChartCardData; onOpen: () => void; variant?: MostPlayedVariant }) {
  const t = useT()
  const title = t("kh.chart.title")
  const open = {
    accessibilityRole: "button" as const,
    accessibilityLabel: t("kh.chart.a11y", { title, first: card.lines[0]?.title ?? "" }),
    onPress: onOpen,
  }
  if (variant === "D") return <Plates p={p} card={card} title={title} open={open} />
  if (variant === "E") return <Chart p={p} card={card} title={title} open={open} />
  if (variant === "F") return <Hero p={p} card={card} title={title} open={open} />
  if (variant === "B") return <Poster p={p} card={card} title={title} open={open} />
  if (variant === "C") return <CoverRow p={p} card={card} title={title} open={open} />
  return <Ranking p={p} card={card} title={title} open={open} />
}

type Open = { accessibilityRole: "button"; accessibilityLabel: string; onPress: () => void }
type VariantProps = { p: AmProto; card: ChartCardData; title: string; open: Open }

const linePhoto = (line: ChartLine) => photoForSeed(`chart:${line.title}`, undefined, { size: "small" })

/* ------------------------------------------------------------------ A: a ranking */

/**
 * A. The ranking. Principle: type is the picture. Three big numerals, the first in the accent colour and the other two quiet, each with the
 * recording's name; the header carries the period and a chevron. No photo, no icon disc: the page around it is full of pictures, this
 * block is the one that reads like a chart.
 */
function Ranking({ p, card, title, open }: VariantProps) {
  const t = useT()
  return (
    <KPress {...open} pressedScale={0.98} outerStyle={styles.outer} style={[styles.rankCard, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <View style={styles.rankHead}>
        <View style={styles.headText}>
          <Text style={[styles.over, { color: p.accentText }]} numberOfLines={1}>
            {t("kh.chart.sub").toUpperCase()}
          </Text>
          <Text style={[styles.rankTitle, { color: p.ink800 }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={[styles.round, { backgroundColor: p.orange100 }]}>
          <TrendingUp size={20} color={p.ink800} strokeWidth={1.9} />
        </View>
      </View>
      <View>
        {card.lines.map((line, i) => (
          <View key={line.rank} style={[styles.rankRow, i > 0 && { borderTopColor: p.sand300, borderTopWidth: 1 }]}>
            <Text style={[styles.numeral, { color: i === 0 ? p.accentText : p.ink300 }]}>{line.rank}</Text>
            <Text style={[styles.rankName, { color: p.ink800 }]} numberOfLines={2}>
              {line.title}
            </Text>
            {i === 0 ? <ChevronRight size={20} color={p.ink500} strokeWidth={2.2} /> : null}
          </View>
        ))}
      </View>
    </KPress>
  )
}

/* ------------------------------------------------------------------ B: one poster */

/**
 * B. The poster. Principle: one winner. Place 1 is a full photo card (the same size as the recording of the day) with its name large in
 * capitals; places 2 and 3 sit on the photo as two dark-glass chips. Everything on the photo is white on the scrim or a neutral glass chip.
 */
function Poster({ p, card, title, open }: VariantProps) {
  const tb = useBlocksT()
  const [first, ...rest] = card.lines
  const photo = photoForSeed(`chart:${first?.title ?? ""}`, "live", { size: "large" })
  return (
    <KPress {...open} pressedScale={0.985} outerStyle={styles.outer} style={styles.poster}>
      <PhotoSurface photo={photo} small={false} scrim={0.86} />
      <View style={styles.posterTop}>
        <View style={styles.glassChip}>
          <TrendingUp size={14} color={amPhotoChip.glass.fg} strokeWidth={2.2} />
          <Text style={styles.glassText}>{title}</Text>
        </View>
      </View>
      <View style={styles.posterBottom}>
        <Text style={styles.posterOver}>{tb("kb.mp.number1").toUpperCase()}</Text>
        <Text style={styles.posterTitle} numberOfLines={3}>
          {first?.title}
        </Text>
        <View style={styles.chipRow}>
          {rest.map((line) => (
            <View key={line.rank} style={styles.placeChip}>
              <Text style={styles.placeNo}>{line.rank}</Text>
              <Text style={styles.placeName} numberOfLines={1}>
                {line.title}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </KPress>
  )
}

/* ------------------------------------------------------------------ C: a row of covers */

/**
 * C. The cover row. Principle: a Top 3 shelf. Three photo covers side by side with their big numeral over the lower left corner and the
 * name under each; the header is a plain line with the period and a chevron. Pictures lead, the names follow.
 */
function CoverRow({ p, card, title, open }: VariantProps) {
  const t = useT()
  const tb = useBlocksT()
  return (
    <KPress {...open} pressedScale={0.98} outerStyle={styles.outer} style={[styles.coverCard, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <View style={styles.rankHead}>
        <View style={styles.headText}>
          <Text style={[styles.rankTitle, { color: p.ink800 }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.coverSub, { color: p.ink500 }]} numberOfLines={1}>
            {t("kh.chart.sub")} · {tb("kb.mp.more")}
          </Text>
        </View>
        <ChevronRight size={22} color={p.ink500} strokeWidth={2.2} />
      </View>
      <View style={styles.covers}>
        {card.lines.map((line) => (
          <View key={line.rank} style={styles.coverCol}>
            <View style={styles.cover}>
              <PhotoSurface photo={linePhoto(line)} scrim={0.94} />
              <Text style={styles.coverNo}>{line.rank}</Text>
            </View>
            <Text style={[styles.coverName, { color: p.ink800 }]} numberOfLines={3}>
              {line.title}
            </Text>
          </View>
        ))}
      </View>
    </KPress>
  )
}


/* ------------------------------------------------------------------ D, E, F: no lines, no framed card (Dada, 13 Nov 2026) */

/** The head the three line-free designs share: title and period on the page itself, a round chevron that opens the full chart. */
function Head({ p, title }: { p: AmProto; title: string }) {
  const t = useT()
  const tb = useBlocksT()
  return (
    <View style={styles.rankHead}>
      <View style={styles.headText}>
        <Text style={[styles.rankTitle, { color: p.ink800 }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.coverSub, { color: p.ink500 }]} numberOfLines={1}>
          {t("kh.chart.sub")} · {tb("kb.mp.more")}
        </Text>
      </View>
      <View style={[styles.round, { backgroundColor: p.white }]}>
        <ChevronRight size={22} color={p.ink800} strokeWidth={2.2} />
      </View>
    </View>
  )
}

/**
 * D. Plates. Principle: tone, not lines. Each place is a soft white plate on the page with its numeral on the left and a small cover;
 * the plates are told apart by the empty 8 px between them and by their tone against the page. No border, no rule, no shadow.
 */
function Plates({ p, card, title, open }: VariantProps) {
  return (
    <KPress {...open} pressedScale={0.98} outerStyle={styles.outer} style={styles.free}>
      <Head p={p} title={title} />
      <View style={styles.plates}>
        {card.lines.map((line, i) => (
          <View key={line.rank} style={[styles.plate, { backgroundColor: p.white }]}>
            <Text style={[styles.plateNo, { color: i === 0 ? p.accentText : p.ink300 }]}>{line.rank}</Text>
            <View style={styles.plateCover}>
              <PhotoSurface photo={linePhoto(line)} scrim={0} mid={0} />
            </View>
            <Text style={[styles.rankName, { color: p.ink800 }]} numberOfLines={2}>
              {line.title}
            </Text>
          </View>
        ))}
      </View>
    </KPress>
  )
}

/**
 * E. The chart. Principle: the numeral is the sticker. Three square covers side by side; each numeral sits on a tab in the colour of the
 * page, half over the cover's lower left corner and half below it (so it is ink on the page colour, never text on a photo), the name under it.
 */
function Chart({ p, card, title, open }: VariantProps) {
  return (
    <KPress {...open} pressedScale={0.98} outerStyle={styles.outer} style={styles.free}>
      <Head p={p} title={title} />
      <View style={styles.tiles}>
        {card.lines.map((line, i) => (
          <View key={line.rank} style={styles.tile}>
            <View style={styles.tileCoverBox}>
              <View style={styles.tileCover}>
                <PhotoSurface photo={linePhoto(line)} scrim={0} mid={0} />
              </View>
              <View style={[styles.tab, { backgroundColor: p.sand200 }]}>
                <Text style={[styles.tabNo, { color: i === 0 ? p.accentText : p.ink800 }]}>{line.rank}</Text>
              </View>
            </View>
            <Text style={[styles.tileName, { color: p.ink800 }]} numberOfLines={3}>
              {line.title}
            </Text>
          </View>
        ))}
      </View>
    </KPress>
  )
}

/**
 * F. The hero. Principle: one winner, two followers. Place 1 is a large peach plate with a big cover, a very large "1" and the name;
 * places 2 and 3 are smaller white plates under it. Size and tone carry the order, nothing is drawn around anything.
 */
function Hero({ p, card, title, open }: VariantProps) {
  const [first, ...rest] = card.lines
  return (
    <KPress {...open} pressedScale={0.98} outerStyle={styles.outer} style={styles.free}>
      <Head p={p} title={title} />
      <View style={styles.plates}>
        {first ? (
          <View style={[styles.heroPlate, { backgroundColor: p.orange100 }]}>
            <View style={styles.heroCover}>
              <PhotoSurface photo={linePhoto(first)} small={false} scrim={0} mid={0} />
            </View>
            <View style={styles.heroText}>
              <Text style={[styles.heroNo, { color: p.accentText }]}>{first.rank}</Text>
              <Text style={[styles.heroName, { color: p.ink800 }]} numberOfLines={3}>
                {first.title}
              </Text>
            </View>
          </View>
        ) : null}
        {rest.map((line) => (
          <View key={line.rank} style={[styles.smallPlate, { backgroundColor: p.white }]}>
            <Text style={[styles.smallNo, { color: p.ink300 }]}>{line.rank}</Text>
            <View style={styles.smallCover}>
              <PhotoSurface photo={linePhoto(line)} scrim={0} mid={0} />
            </View>
            <Text style={[styles.smallName, { color: p.ink800 }]} numberOfLines={2}>
              {line.title}
            </Text>
          </View>
        ))}
      </View>
    </KPress>
  )
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: HOME_INSET },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  over: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.1 },

  rankCard: { borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8 },
  rankHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  rankTitle: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.4, textTransform: "uppercase" },
  rankRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 8 },
  numeral: { width: 44, fontFamily: amFonts.display, fontSize: 44, lineHeight: 48, letterSpacing: -1, textAlign: "center", fontVariant: ["tabular-nums"] },
  rankName: { flex: 1, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },

  poster: { height: 232, borderRadius: 30, overflow: "hidden", backgroundColor: amColors.ink900 },
  posterTop: { position: "absolute", left: 16, top: 16 },
  glassChip: { height: 28, paddingHorizontal: 12, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: amPhotoChip.glass.bg },
  glassText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase", color: amPhotoChip.glass.fg },
  posterBottom: { position: "absolute", left: 16, right: 16, bottom: 16, gap: 6 },
  posterOver: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, color: amColors.gold300 },
  posterTitle: { fontFamily: amFonts.display, fontSize: 26, lineHeight: 27, letterSpacing: -0.4, textTransform: "uppercase", color: "#FFFFFF" },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  placeChip: { flex: 1, minWidth: 0, height: 32, borderRadius: 16, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: amPhotoChip.glass.bg },
  placeNo: { fontFamily: amFonts.display, fontSize: 15, lineHeight: 18, color: amColors.gold300 },
  placeName: { flex: 1, fontFamily: amFonts.semi, fontSize: 13, lineHeight: 17, color: amPhotoChip.glass.fg },

  free: { gap: 16 },
  plates: { gap: 8 },
  plate: { minHeight: 80, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 16 },
  plateNo: { width: 36, fontFamily: amFonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1, textAlign: "center", fontVariant: ["tabular-nums"] },
  plateCover: { width: 56, height: 56, borderRadius: 16, overflow: "hidden", backgroundColor: amColors.ink900 },

  tiles: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, minWidth: 0 },
  tileCoverBox: { aspectRatio: 1 },
  tileCover: { flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: amColors.ink900 },
  tab: { position: "absolute", left: -4, bottom: -28, minWidth: 48, height: 56, paddingHorizontal: 8, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tabNo: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  tileName: { marginTop: 36, fontFamily: amFonts.semi, fontSize: 13, lineHeight: 17 },

  heroPlate: { borderRadius: 30, flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
  heroCover: { width: 128, height: 128, borderRadius: 24, overflow: "hidden", backgroundColor: amColors.ink900 },
  heroText: { flex: 1, minWidth: 0, gap: 4 },
  heroNo: { fontFamily: amFonts.display, fontSize: 72, lineHeight: 76, letterSpacing: -2, fontVariant: ["tabular-nums"] },
  heroName: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 23 },
  smallPlate: { minHeight: 64, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingLeft: 16, paddingRight: 16 },
  smallNo: { width: 28, fontFamily: amFonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.5, textAlign: "center", fontVariant: ["tabular-nums"] },
  smallCover: { width: 44, height: 44, borderRadius: 14, overflow: "hidden", backgroundColor: amColors.ink900 },
  smallName: { flex: 1, fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },

  coverCard: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 16 },
  coverSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  covers: { flexDirection: "row", gap: 12 },
  coverCol: { flex: 1, minWidth: 0, gap: 8 },
  cover: { aspectRatio: 0.82, borderRadius: 18, overflow: "hidden", justifyContent: "flex-end", padding: 8, backgroundColor: amColors.ink900 },
  coverNo: { fontFamily: amFonts.display, fontSize: 52, lineHeight: 54, letterSpacing: -1.5, color: "#FFFFFF", textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  coverName: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 17 },
})
