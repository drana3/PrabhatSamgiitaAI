import { StyleSheet, Text, View } from "react-native"

import { AuthorAvatar, SIDE } from "@/components/authors/AuthorsUi"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AuthorCardData } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"

/** One author in the directory, the search block and the "By ..." line: avatar, name, a short line, the numbers. */
export function AuthorRow({ theme, author, onOpen, inset = true }: { theme: SongsTheme; author: AuthorCardData; onOpen: (slug: string) => void; inset?: boolean }) {
  const t = useT()
  const bits: string[] = []
  if (author.country) bits.push(author.country)
  bits.push(t("authors.count.recordings", { count: author.recordings_count }))
  if (author.monthly_listeners != null) bits.push(t("authors.count.listeners", { count: author.monthly_listeners }))
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={t("authors.row.a11y", { name: author.display_name })}
      onPress={() => onOpen(author.slug)}
      pressedScale={0.98}
      outerStyle={inset ? styles.outer : undefined}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <AuthorAvatar slug={author.slug} name={author.display_name} photoUrl={author.photo_url} size={52} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.textHeading }]} numberOfLines={1}>
            {author.display_name}
          </Text>
          {author.verified ? (
            <View style={[styles.verified, { backgroundColor: theme.peach }]} accessibilityLabel={t("authors.verified")}>
              <Text style={[styles.verifiedText, { color: theme.accentText }]}>{t("authors.verified")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.line, { color: theme.textBody }]} numberOfLines={1}>
          {bits.join(" · ")}
        </Text>
        {author.bio ? (
          <Text style={[styles.bio, { color: theme.textMuted }]} numberOfLines={1}>
            {author.bio}
          </Text>
        ) : null}
      </View>
    </KPress>
  )
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: SIDE },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: 18, borderWidth: 1 },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  verified: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  verifiedText: { fontFamily: amFonts.bold, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.6, textTransform: "uppercase" },
  line: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  bio: { fontFamily: amFonts.regular, fontSize: 13, lineHeight: 18 },
})
