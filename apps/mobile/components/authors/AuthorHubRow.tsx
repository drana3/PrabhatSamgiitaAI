import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SIDE } from "@/components/authors/AuthorsUi"
import { KPress } from "@/components/kirtan/KPress"
import { ChevronGlyph } from "@/components/kirtan/KirtanParts"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { BECOME_AUTHOR_HREF, MY_AUTHOR_HREF } from "@/lib/authors/constants"
import { say } from "@/lib/authors/text"
import { useT } from "@/lib/i18n"
import { canUseServer } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthorStore } from "@/stores/authorStore"
import { href } from "@/utils/href"

/**
 * One row for the Upload hub (and the profile sheet): "Become an author" when there is no page yet, "Your author page"
 * with its state when there is one. One line for the hub: `<AuthorHubRow theme={theme} />`.
 */
export function AuthorHubRow({ theme, flush }: { theme: SongsTheme; flush?: boolean }) {
  const t = useT()
  const router = useRouter()
  const load = useAuthorStore((s) => s.load)
  const mine = useAuthorStore((s) => s.mine)
  const refresh = useAuthorStore((s) => s.refresh)

  useEffect(() => {
    if (load === "idle" && (MOCKUP_DATA || canUseServer())) void refresh()
  }, [load, refresh])

  const title = mine ? t("authors.hub.mine") : t("authors.hub.become")
  const sub = mine ? say(t, `authors.status.${mine.review_needed && mine.status !== "published" ? "review" : mine.status}`) : t("authors.hub.becomeSub")
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={() => router.push(href(mine ? MY_AUTHOR_HREF : BECOME_AUTHOR_HREF))}
      pressedScale={0.98}
      outerStyle={flush ? undefined : styles.outer}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.textHeading }]}>{title}</Text>
        <Text style={[styles.sub, { color: theme.textBody }]} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <ChevronGlyph color={theme.textMuted} />
    </KPress>
  )
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: SIDE },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, borderWidth: 1, minHeight: 64 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  sub: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
})
