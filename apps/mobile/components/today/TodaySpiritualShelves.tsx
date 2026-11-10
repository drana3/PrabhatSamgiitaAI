import { StyleSheet, View } from "react-native"

import { HOME_INSET, HomeSectionHead, HomeShelf } from "@/components/home/HomeBlocks"
import { KirtanRow } from "@/components/kirtan/KirtanParts"
import { CARD_W, ShelfCard } from "@/components/search-v2/MenuShelves"
import type { AmProto } from "@/constants/tokens/amToday"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import type { Kirtan } from "@/lib/kirtan/types"
import { useT } from "@/lib/i18n"

type Common = {
  p: AmProto
  theme: SongsTheme
  /** play `k` with `context` as the queue */
  onOpen: (k: Kirtan, context: readonly Kirtan[]) => void
  onMore: (k: Kirtan) => void
  onOpenArtist: (artistId: string) => void
  /** the "See all" of the shelf head */
  onAll: () => void
}

/**
 * "Spiritual for today": a few spiritual songs as rows, a different handful each day (lib/spiritualToday.ts).
 * The same rows as "Kiirtan for today", so Prabhat Samgiita, Kiirtan and spiritual songs sit side by side on Today.
 */
export function SpiritualForToday({ p, theme, items, onOpen, onMore, onOpenArtist, onAll }: Common & { items: readonly Kirtan[] }) {
  const t = useT()
  return (
    <>
      <HomeSectionHead
        p={p}
        eyebrow={t("home.spiritual.today.eyebrow")}
        first={t("home.spiritual.today.first")}
        second={t("home.spiritual.today.second")}
        action={{ label: t("home.spiritual.more"), onPress: onAll }}
      />
      <View style={styles.list}>
        {items.map((k) => (
          <KirtanRow key={k.id} theme={theme} kirtan={k} onOpen={() => onOpen(k, items)} onMore={onMore} onOpenArtist={onOpenArtist} />
        ))}
      </View>
    </>
  )
}

/** "Newly added spiritual songs": the newest ones the day's handful does not hold, as cards. */
export function SpiritualNewlyAdded({ p, theme, items, onOpen, onAll }: Pick<Common, "p" | "theme" | "onOpen" | "onAll"> & { items: readonly Kirtan[] }) {
  const t = useT()
  return (
    <>
      <HomeSectionHead
        p={p}
        eyebrow={t("home.spiritual.new.eyebrow")}
        first={t("home.spiritual.new.first")}
        second={t("home.spiritual.new.second")}
        action={{ label: t("home.spiritual.more"), onPress: onAll }}
      />
      <HomeShelf itemWidth={CARD_W} gap={10}>
        {items.map((k) => (
          <ShelfCard key={k.id} theme={theme} kirtan={k} onPress={() => onOpen(k, items)} />
        ))}
      </HomeShelf>
    </>
  )
}

const styles = StyleSheet.create({ list: { paddingHorizontal: HOME_INSET, gap: 8 } })
