import { StyleSheet, Text, View } from "react-native"
import { Bookmark, Upload } from "lucide-react-native"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { KPress } from "@/components/kirtan/KPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { useLanguage, useT } from "@/lib/i18n"

/**
 * "My Kiirtan": two tiles at the bottom of the page (Dada, 10 Nov 2026). Saved (one list; the second line says how many of them are on this
 * phone) and My uploads (everything the person uploaded, by kind). They left the chips row; each opens the list screen.
 */
export function MineTiles({ p, savedCount, onPhoneCount, uploadCount, onSaved, onMine }: { p: AmProto; savedCount: number; onPhoneCount: number; uploadCount: number; onSaved: () => void; onMine: () => void }) {
  useLanguage()
  const t = useT()
  const savedSub = savedCount > 0 ? t("kh.tile.saved.count", { count: savedCount }) : t("kh.tile.empty")
  const savedPhone = savedCount > 0 && onPhoneCount > 0 ? t("kh.tile.onPhone", { count: onPhoneCount }) : null
  const mineSub = uploadCount > 0 ? t("kh.tile.uploads.count", { count: uploadCount }) : t("kh.tile.empty")
  const savedTitle = t("kt.chip.saved")
  const mineTitle = t("kt.chip.mine")
  return (
    <View style={styles.row}>
      <Tile p={p} icon={<Bookmark size={22} color={p.ink800} strokeWidth={1.9} />} title={savedTitle} sub={savedSub} extra={savedPhone} label={t("kh.tile.a11y", { title: savedTitle, sub: [savedSub, savedPhone].filter(Boolean).join(", ") })} onPress={onSaved} />
      <Tile p={p} icon={<Upload size={22} color={p.ink800} strokeWidth={1.9} />} title={mineTitle} sub={mineSub} extra={null} label={t("kh.tile.a11y", { title: mineTitle, sub: mineSub })} onPress={onMine} />
    </View>
  )
}

function Tile({ p, icon, title, sub, extra, label, onPress }: { p: AmProto; icon: React.ReactNode; title: string; sub: string; extra: string | null; label: string; onPress: () => void }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.97} outerStyle={styles.outer} style={[styles.tile, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <View style={[styles.disc, { backgroundColor: p.orange100 }]}>{icon}</View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: p.ink800 }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.sub, { color: p.ink500 }]} numberOfLines={1}>
          {sub}
        </Text>
        {extra ? (
          <Text style={[styles.sub, { color: p.ink500 }]} numberOfLines={1}>
            {extra}
          </Text>
        ) : null}
      </View>
    </KPress>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingHorizontal: HOME_INSET },
  outer: { flex: 1 },
  tile: { minHeight: 112, borderRadius: 24, borderWidth: 1, padding: 14, justifyContent: "space-between", gap: 12 },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  text: { gap: 2 },
  title: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
})
