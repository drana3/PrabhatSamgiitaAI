import { ScrollView, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { BroadcastCard } from "@/components/broadcasts/BroadcastCard"
import { HOME_INSET, HomeSectionHead } from "@/components/home/HomeBlocks"
import type { AmProto } from "@/constants/tokens/amToday"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import type { Broadcast } from "@/lib/broadcasts/types"
import { useT } from "@/lib/i18n"
import { href } from "@/utils/href"

const CARD_WIDTH = 264
const SHELF_SIZE = 10

/**
 * The "Live and upcoming" shelf of the Kiirtan screen: the broadcasts it is given (already in shelf order, lib/broadcasts/rules.ts
 * shelfOrder: on the air first, then the next to start), and "See all" into the list. The screen loads them with
 * `useBroadcasts("shelf")` and draws the shelf only when there is at least one, so an empty shelf never takes room.
 */
export function BroadcastsShelf({ p, items }: { p: AmProto; items: readonly Broadcast[] }) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const shown = items.slice(0, SHELF_SIZE)
  if (!shown.length) return null
  return (
    <View style={styles.wrap}>
      <HomeSectionHead p={p} eyebrow={t("bc.shelf.eyebrow")} first={t("bc.shelf.first")} second={t("bc.shelf.second")} action={{ label: t("bc.shelf.all"), onPress: () => router.push(href("/broadcasts")) }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {shown.map((b) => (
          <BroadcastCard key={b.id} item={b} theme={theme} width={CARD_WIDTH} onPress={() => router.push(href(`/broadcast/${b.id}`))} />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  row: { paddingHorizontal: HOME_INSET, gap: 12 },
})
