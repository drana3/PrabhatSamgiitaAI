import { memo } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { RecentRow } from "@/components/search-v2/BrowseBlocks"
import { HOME_INSET } from "@/components/home/HomeBlocks"
import { ChevronGlyph } from "@/components/today/protoIcons"
import { Reveal } from "@/components/today/motion"
import { TodayPress } from "@/components/today/TodayPress"
import { amColors, amPhotoChip, amScrimPhoto, amScrimPhotoTop } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { useT } from "@/lib/i18n"
import type { SearchCard } from "@/lib/searchCards/cards"
import { searchPhoto } from "@/lib/searchCards/photo"

type P = { p: AmProto }

/** Height of a wide card: the photo, the name and one row of pills fit with room to spare. */
export const CARD_HEIGHT = 156
const CARD_RADIUS = 18
const em = (size: number, value: number) => Math.round(size * value * 100) / 100

/**
 * One wide photo card (variant B): the photo fills it, the name sits bottom left over a scrim, three small pills show what is
 * inside (real examples), a round chevron says it opens. The pills are white chips with ink text (`amPhotoChip.white`, 12.6:1), one of the two looks allowed on a photograph.
 */
const WideCard = memo(function WideCard({ card, onOpen }: { card: SearchCard; onOpen: (card: SearchCard) => void }) {
  const t = useT()
  const photo = searchPhoto(card.photo, `card:${card.id}`)
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={card.empty ? t("searchCards.card.a11y", { title: card.title, examples: t("searchCards.card.nothing") }) : t("searchCards.card.a11y", { title: card.title, examples: card.spoken })}
      onPress={() => onOpen(card)}
      pressedScale={0.98}
      style={s.card}
      testID={`search-card-${card.id}`}
    >
      <Image source={photo.cover} contentFit="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={[amScrimPhotoTop[0], amScrimPhotoTop[1]]} style={s.top} />
      <LinearGradient pointerEvents="none" colors={[amScrimPhoto[0], amScrimPhoto[1]]} locations={[0.2, 1]} style={s.bottom} />
      <View style={s.chevron} pointerEvents="none">
        <ChevronGlyph size={20} color={amPhotoChip.glass.fg} />
      </View>
      <View style={s.text} pointerEvents="none">
        <Text style={s.title} numberOfLines={1} accessibilityRole="header">
          {card.title}
        </Text>
        <View style={s.pills}>
          {card.empty ? (
            <View style={s.pill}>
              <Text style={s.pillText}>{t("searchCards.card.nothing")}</Text>
            </View>
          ) : (
            card.pills.map((pill) => (
              <View key={pill.label} style={s.pill}>
                <Text style={s.pillText} numberOfLines={1}>
                  {pill.label}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </TodayPress>
  )
})

/**
 * The empty-field view of Search (Dada, 10 Nov 2026, variant B): the recent searches in one row, then five wide photo cards,
 * one under the other. Nothing else: the white blocks and chips of the old menu are gone, the other filters wait for a query.
 * The cards come in one after the other (a single staggered reveal), and each one gives touch feedback on pointer down.
 */
export function SearchCards({
  p,
  cards,
  recents,
  onRecent,
  onClearRecents,
  onOpen,
}: P & {
  cards: readonly SearchCard[]
  recents: readonly string[]
  onRecent: (q: string) => void
  onClearRecents: () => void
  onOpen: (card: SearchCard) => void
}) {
  return (
    <View style={s.root} testID="search-cards">
      <RecentRow p={p} items={recents} onPick={onRecent} onClear={onClearRecents} />
      <View style={s.list}>
        {cards.map((card, index) => (
          <Reveal key={card.id} index={index}>
            <WideCard card={card} onOpen={onOpen} />
          </Reveal>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 16, paddingTop: 8 },
  list: { gap: 12, paddingHorizontal: HOME_INSET },
  card: { height: CARD_HEIGHT, borderRadius: CARD_RADIUS, overflow: "hidden", backgroundColor: amColors.ink900 },
  top: { position: "absolute", left: 0, right: 0, top: 0, height: 64 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0 },
  chevron: { position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: amPhotoChip.glass.bg },
  text: { position: "absolute", left: 16, right: 16, bottom: 14, gap: 8 },
  title: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: em(28, -0.02), textTransform: "uppercase", color: amPhotoChip.glass.fg },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: "center", backgroundColor: amPhotoChip.white.bg, maxWidth: 190 },
  pillText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, color: amPhotoChip.white.fg },
})
