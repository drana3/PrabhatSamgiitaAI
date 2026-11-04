import { FlatList, StyleSheet, View, useWindowDimensions } from "react-native"
import { useRouter } from "expo-router"

import { StripCard } from "@/components/home/HomeBlocks"
import { AvatarButton, KirtanScreenHead } from "@/components/kirtan/KirtanParts"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { protoFor } from "@/constants/tokens/amToday"
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { MIX_FIXTURES } from "@/lib/fixtures/kirtan"
import { mixCaption } from "@/lib/kirtan/mix"
import { href } from "@/utils/href"

/** Side inset of the cards: the Songs screens use 10. */
const CARD_INSET = 10

/**
 * Songs > Mixes: cards with a coloured label strip, like Home's "To get you started". A mix combines
 * Prabhat Samgiita songs and kirtans in one order. TODO(api): the system mixes come from the backend.
 */
export function MixesSegment({ inset, avatarTop }: { inset: number; avatarTop: number }) {
  const router = useRouter()
  const theme = useSongsTheme()
  const p = protoFor(theme)
  const initial = useProfileInitial()
  const openedAt = useRevealClock()
  const { width } = useWindowDimensions()
  const cardWidth = width - CARD_INSET * 2

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.fill, { backgroundColor: theme.page }]}>
        <FlatList
          data={MIX_FIXTURES as unknown as (typeof MIX_FIXTURES)[number][]}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={
            <View>
              <View style={{ height: inset }} />
              <SongsReveal index={0}>
                <KirtanScreenHead theme={theme} title="Mixes" count={MIX_FIXTURES.length} />
              </SongsReveal>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item, index }) => (
            <SongsReveal index={index + 1} style={styles.card}>
              <StripCard
                p={p}
                width={cardWidth}
                height={160}
                card={{ id: item.id, label: item.title, tone: item.tone, cover: item.cover, title: mixCaption(item.items), caption: item.blurb }}
                onPress={() => router.push(href(`/kirtan-mix?id=${item.id}`))}
              />
            </SongsReveal>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        />
        <AvatarButton theme={theme} top={avatarTop} initial={initial} onPress={() => router.push(href("/profile-sheet"))} />
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: 190 },
  card: { paddingHorizontal: CARD_INSET },
  sep: { height: 22 },
})
