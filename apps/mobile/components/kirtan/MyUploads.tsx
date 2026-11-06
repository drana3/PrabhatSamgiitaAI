import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { KirtanRow, KirtanTag, StatusBadge } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { formatDate, useT } from "@/lib/i18n"
import { CONTACT_ROUTE, uploadErrorText } from "@/lib/kirtan/rules"
import type { Kirtan } from "@/lib/kirtan/types"
import { runUpload } from "@/lib/kirtan/uploadRunner"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

/**
 * One of the person's own recordings under Kiirtan, My uploads. A recording is published the moment the upload
 * succeeds, so there is no "in review" state: it is Uploading, Published, Not uploaded (with Try again) or Removed
 * by the team (with the reason, the date, and what to do next).
 */

type RowProps = { theme: SongsTheme; kirtan: Kirtan; onOpen: (k: Kirtan) => void; onMore: (k: Kirtan) => void; onOpenArtist: (id: string) => void }

export function UploadRow({ theme, kirtan: k, onOpen, onMore, onOpenArtist }: RowProps) {
  const t = useT()
  const withdraw = useKirtanStore((s) => s.withdraw)
  const retry = (id: string) => {
    useKirtanStore.getState().retry(id)
    void runUpload(id)
  }
  const failed = k.status === "failed"
  return (
    <View style={styles.wrap}>
      <KirtanRow
        theme={theme}
        kirtan={k}
        compact
        onOpen={onOpen}
        onMore={k.status === "published" ? onMore : undefined}
        onOpenArtist={onOpenArtist}
        trailing={
          <View style={styles.status}>
            <StatusBadge theme={theme} status={k.status} />
            {k.byAuthor ? <Text style={[styles.byAuthor, { color: theme.textMuted }]}>{t("kt.byAuthor")}</Text> : null}
          </View>
        }
      />
      {k.status === "uploading" ? <Text style={[styles.note, { color: theme.textBody }]}>{t("ugc.mine.uploading")}</Text> : null}
      {failed ? (
        <View style={styles.failed}>
          <Text style={[styles.note, { color: theme.dangerText }]}>{uploadErrorText(k.failure ?? { code: "network" })}</Text>
          <View style={styles.actions}>
            <KPress accessibilityRole="button" accessibilityLabel={t("ugc.mine.retry")} onPress={() => retry(k.id)} pressedScale={0.96} style={[styles.pill, { backgroundColor: amColors.orange700 }]}>
              <Text style={styles.pillText}>{t("ugc.mine.retry")}</Text>
            </KPress>
            <KPress accessibilityRole="button" accessibilityLabel={t("kt.takeBackA11y", { title: k.title })} onPress={() => withdraw(k.id)} pressedScale={0.94}>
              <Text style={[styles.take, { color: theme.textBody }]}>{t("ugc.mine.dismiss")}</Text>
            </KPress>
          </View>
        </View>
      ) : null}
    </View>
  )
}

/** A recording the team took down: the reason in plain words, the date, and the ways to answer. */
export function RemovedCard({ theme, kirtan: k, onOpenOriginal }: { theme: SongsTheme; kirtan: Kirtan; onOpenOriginal?: (id: string) => void }) {
  const t = useT()
  const router = useRouter()
  const withdraw = useKirtanStore((s) => s.withdraw)
  const corrected = () =>
    router.push(href(`/add-kirtan?kind=${k.kind}&title=${encodeURIComponent(k.title)}&author=${encodeURIComponent(k.author)}&mantra=${encodeURIComponent(k.mantra ?? "")}`))
  const reason = k.removedReason?.trim()
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]} accessibilityLabel={`${t("ugc.removed.title")}. ${k.title}`}>
      <View style={[styles.rule, { backgroundColor: amColors.danger }]} />
      <View style={styles.cardBody}>
        <View style={styles.tagLine}>
          <KirtanTag theme={theme} kind={k.kind} />
          <StatusBadge theme={theme} status="removed" />
        </View>
        <Text style={[styles.cardTitle, { color: theme.textHeading }]} numberOfLines={3}>
          {k.title}
        </Text>
        <Text style={[styles.heading, { color: theme.dangerText }]}>{t("ugc.removed.title")}</Text>
        {k.duplicateOf ? (
          <Text style={[styles.reason, { color: theme.textHeading }]}>
            {k.duplicateOf.title ? t("ugc.removed.duplicateOf", { title: k.duplicateOf.title }) : t("ugc.removed.duplicateOfUnknown")}
          </Text>
        ) : null}
        <View style={[styles.reasonBox, { backgroundColor: theme.inner, borderColor: theme.line }]}>
          <Text style={[styles.reasonLabel, { color: theme.textBody }]}>{t("ugc.removed.reason")}</Text>
          <Text style={[styles.reason, { color: theme.textHeading }]}>{reason || t("ugc.removed.noReason")}</Text>
        </View>
        {k.removedAt ? <Text style={[styles.note, { color: theme.textBody }]}>{t("ugc.removed.on", { date: formatDate(k.removedAt, "medium") })}</Text> : null}
        {k.duplicateOf && onOpenOriginal ? (
          <View style={styles.actions}>
            <KPress accessibilityRole="button" accessibilityLabel={t("ugc.removed.openOriginal")} onPress={() => onOpenOriginal(k.duplicateOf?.id ?? "")} pressedScale={0.96} style={[styles.pill, { backgroundColor: amColors.orange700 }]}>
              <Text style={styles.pillText}>{t("ugc.removed.openOriginal")}</Text>
            </KPress>
          </View>
        ) : null}
        <View style={styles.actions}>
          <KPress accessibilityRole="button" accessibilityLabel={t("ugc.removed.contact")} onPress={() => router.push(href(CONTACT_ROUTE))} pressedScale={0.96} style={[styles.pill, { backgroundColor: amColors.orange700 }]}>
            <Text style={styles.pillText}>{t("ugc.removed.contact")}</Text>
          </KPress>
          <KPress accessibilityRole="button" accessibilityLabel={t("ugc.removed.upload")} onPress={corrected} pressedScale={0.96} style={[styles.pill, { backgroundColor: theme.peach }]}>
            <Text style={[styles.pillText, { color: theme.accent }]}>{t("ugc.removed.upload")}</Text>
          </KPress>
        </View>
        <View style={styles.actions}>
          <KPress accessibilityRole="link" accessibilityLabel={t("ugc.removed.rules")} onPress={() => router.push(href("/content-rules"))} pressedScale={0.96}>
            <Text style={[styles.take, { color: theme.accent }]}>{t("ugc.removed.rules")}</Text>
          </KPress>
          <KPress accessibilityRole="button" accessibilityLabel={t("ugc.removed.dismiss")} onPress={() => withdraw(k.id)} pressedScale={0.94}>
            <Text style={[styles.take, { color: theme.textBody }]}>{t("ugc.removed.dismiss")}</Text>
          </KPress>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  status: { alignItems: "flex-end", gap: 4, paddingRight: 12 },
  byAuthor: { fontFamily: amFonts.regular, fontSize: 12, lineHeight: 16 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  failed: { gap: 8, paddingHorizontal: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  pill: { minHeight: 40, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18, color: "#FFFFFF" },
  take: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, textDecorationLine: "underline", paddingVertical: 6 },
  card: { borderRadius: 24, borderWidth: 1, flexDirection: "row", overflow: "hidden" },
  rule: { width: 5 },
  cardBody: { flex: 1, padding: 16, gap: 10 },
  tagLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardTitle: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 22, letterSpacing: -0.1 },
  heading: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  reasonBox: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 4 },
  reasonLabel: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: "uppercase" },
  reason: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
})
