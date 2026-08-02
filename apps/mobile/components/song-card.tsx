import type { SongSummary } from "@prabhat/core"
import { Ionicons } from "@expo/vector-icons"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Link } from "expo-router"

import { cardElevation, hairline } from "@/lib/theme"
import { colors, radii, spacing, typography } from "@/lib/client"

export function SongCard({ song }: { song: SongSummary }) {
  return (
    <Link href={`/songs/${song.number}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{song.number}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{titleCase(song.title)}</Text>
          {song.first_line ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {titleCase(song.first_line)}
            </Text>
          ) : null}
          {song.theme ? <Text style={styles.theme}>{song.theme}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.stone500} />
      </Pressable>
    </Link>
  )
}

function titleCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: hairline,
    padding: spacing.md,
    ...cardElevation(1),
  },
  pressed: { opacity: 0.92 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.navy950,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.white, fontWeight: "700", fontSize: typography.caption },
  body: { flex: 1, minWidth: 0 },
  title: { color: colors.navy950, fontSize: typography.body, fontWeight: "700" },
  subtitle: { marginTop: 4, color: colors.stone600, fontSize: typography.caption, lineHeight: 18 },
  theme: {
    marginTop: 8,
    alignSelf: "flex-start",
    color: colors.gold500,
    fontSize: typography.label,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
})
