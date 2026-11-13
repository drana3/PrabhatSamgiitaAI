import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { HOME_INSET, HomeSectionHead } from "@/components/home/HomeBlocks"
import { KindMark } from "@/components/listening/KindMark"
import { Press } from "@/components/songs-v2/Press"
import { Chip } from "@/components/topPlayed/TopPlayedParts"
import type { AmProto } from "@/constants/tokens/amToday"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useTopShelf } from "@/hooks/useTopShelf"
import { useT } from "@/lib/i18n"
import { historySubline } from "@/lib/listening/labels"
import { categoryName } from "@/lib/radio/labels"
import { playTopItem } from "@/lib/topPlayed/play"
import { SHELF_KINDS } from "@/lib/topPlayed/shelf"
import { href } from "@/utils/href"

type Shelf = ReturnType<typeof useTopShelf>

/**
 * "Most played this week": five rows from the Top played list (places 1 to 5, no play counts: the counts live on the full
 * screen), chips for All, Prabhat Samgiita, Kiirtan and Bhajan, and a "Top 100" button into the Top played screen. A row plays
 * the shelf from that row down. The caller shows it only while `shelf.visible`.
 */
export function TodayMostPlayed({ p, theme, shelf, onMessage }: { p: AmProto; theme: SongsTheme; shelf: Shelf; onMessage: (text: string) => void }) {
  const t = useT()
  const router = useRouter()
  return (
    <>
      <HomeSectionHead
        p={p}
        eyebrow={t("home.mostPlayed.eyebrow")}
        first={t("home.mostPlayed.first")}
        second={t("home.mostPlayed.second")}
        action={{ label: t("home.mostPlayed.more"), onPress: () => router.push(href("/top-played")) }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel={t("top.kind.a11y")}>
        {SHELF_KINDS.map((k) => {
          const label = k === "all" ? t("top.kind.all") : categoryName(k)
          return <Chip key={k} theme={theme} label={label} a11y={label} on={k === shelf.kind} onPress={() => shelf.setKind(k)} />
        })}
      </ScrollView>
      <View style={styles.list}>
        {shelf.rows.length === 0 && !shelf.loading ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>{t("top.empty.title")}</Text>
        ) : (
          shelf.rows.map((item, index) => (
            <Press
              key={`${item.ref}:${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={t("home.mostPlayed.row.a11y", { rank: item.rank, title: item.title })}
              onPress={() => {
                const message = playTopItem(shelf.rows, index)
                if (message) onMessage(message)
              }}
              pressedScale={0.985}
              style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}
            >
              <Text style={[styles.rank, { color: item.rank <= 3 ? theme.accent : theme.textMuted }]} accessibilityElementsHidden>
                {item.rank}
              </Text>
              <KindMark theme={theme} kind={item.kind} size={40} />
              <View style={styles.text}>
                <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.sub, { color: theme.textBody }]} numberOfLines={1}>
                  {historySubline(item)}
                </Text>
              </View>
            </Press>
          ))
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: HOME_INSET },
  list: { paddingHorizontal: HOME_INSET, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, minHeight: 68 },
  rank: { width: 30, textAlign: "center", fontFamily: amFonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  text: { flex: 1, gap: 3 },
  title: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  empty: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21, paddingVertical: 8 },
})
