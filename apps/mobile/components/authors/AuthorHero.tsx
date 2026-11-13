import { StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

import { artistGradient } from "@/components/kirtan/ArtistParts"
import { AuthorAvatar, DemoBadge } from "@/components/authors/AuthorsUi"
import { KPress } from "@/components/kirtan/KPress"
import { ChevronGlyph } from "@/components/kirtan/KirtanParts"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AuthorType } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"

export type HeroData = {
  slug: string
  name: string
  type: AuthorType
  verified: boolean
  place: string
  photoUrl: string | null
  /** a line under the name, already worded ("12 recordings") */
  meta: string
}

/**
 * The top of an author page: the gradient of the author, the round picture, the name in capitals, where from and how
 * many recordings. The same hero is the live preview in the "Become an author" flow (`onBack` omitted there).
 */
export function AuthorHero({ theme, data, top, onBack, demo }: { theme: SongsTheme; data: HeroData; top: number; onBack?: () => void; demo?: boolean }) {
  const t = useT()
  const [from, to] = artistGradient(data.slug || "author")
  return (
    <View style={[styles.hero, { minHeight: 280 + (onBack ? top : 0) }]}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={["rgba(10,14,8,0)", "rgba(10,14,8,0.72)"]} style={StyleSheet.absoluteFill} />
      {onBack ? (
        <KPress
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          pressedScale={0.9}
          outerStyle={[styles.back, { top: top + 6 }]}
          style={styles.backDisc}
        >
          <View style={styles.flip}>
            <ChevronGlyph color="#1E1E1E" />
          </View>
        </KPress>
      ) : null}
      {demo ? (
        <View style={[styles.demo, { top: (onBack ? top : 0) + 12 }]}>
          <DemoBadge theme={theme} />
        </View>
      ) : null}
      <View style={styles.body}>
        <AuthorAvatar slug={data.slug || "author"} name={data.name || "?"} photoUrl={data.photoUrl} size={96} />
        <View style={styles.text}>
          <Text style={styles.eyebrow}>{data.verified ? `${t(data.type === "group" ? "authors.type.group" : "authors.type.solo")} · ${t("authors.verified")}` : t(data.type === "group" ? "authors.type.group" : "authors.type.solo")}</Text>
          <Text style={styles.name} accessibilityRole="header" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>
            {data.name || t("authors.hero.namePlaceholder")}
          </Text>
          {data.place ? <Text style={styles.meta}>{data.place}</Text> : null}
          {data.meta ? <Text style={styles.meta}>{data.meta}</Text> : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", justifyContent: "flex-end" },
  back: { position: "absolute", left: 16, zIndex: 2 },
  backDisc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.88)" },
  flip: { transform: [{ scaleX: -1 }] },
  demo: { position: "absolute", right: 16, zIndex: 2 },
  body: { paddingHorizontal: 20, paddingBottom: 22, gap: 14 },
  text: { gap: 3 },
  eyebrow: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, color: "rgba(255,255,255,0.88)", textTransform: "uppercase" },
  name: { fontFamily: amFonts.display, fontSize: 44, lineHeight: 46, letterSpacing: -1, textTransform: "uppercase", color: "#FFFFFF" },
  meta: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, color: "rgba(255,255,255,0.92)" },
})
