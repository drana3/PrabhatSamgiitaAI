import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { KPress } from "@/components/kirtan/KPress"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { formatDate, useT } from "@/lib/i18n"
import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { fetchMySets } from "@/lib/kirtan/remoteSets"
import { mergeSummaries, summaryOfDraft, summaryOfRemote, whenLabel, type SetSummary } from "@/lib/kirtan/setView"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"
import { useUploadSetStore } from "@/stores/uploadSetStore"
import { href } from "@/utils/href"

/**
 * "My event playlists": every playlist the person made, the unfinished ones first (they need the person), then the
 * newest event. The server's list is the truth; the phone adds the sets that are still going up (with how many files
 * wait) and the last published ones, so the page is useful offline too (docs/kiirtan-sets.md).
 */
export default function MySetsScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const bottomInset = useScrollBottomInset(24)
  const signedIn = useAuthStore((s) => s.mode === "signed_in") || MOCKUP_DATA
  const drafts = useUploadSetStore((s) => s.drafts)
  const archive = useUploadSetStore((s) => s.archive)

  const [server, setServer] = useState<SetSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!signedIn || MOCKUP_DATA || !canUseServer()) return
    setLoading(true)
    try {
      const list = await fetchMySets(remoteConfig())
      setServer(list.items.map(summaryOfRemote))
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [signedIn])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const items = useMemo(() => {
    const phone = [...drafts.filter((draft) => draft.tracks.length > 0 || draft.title.trim()).map(summaryOfDraft), ...archive.map(summaryOfDraft)]
    return mergeSummaries(server ?? [], phone)
  }, [drafts, archive, server])

  const open = (item: SetSummary) => {
    const unfinished = item.source === "phone" && drafts.some((draft) => draft.id === item.id)
    router.push(href(unfinished && item.state !== "published" ? `/upload-set?set=${item.id}` : `/recording-set/${item.id}`))
  }
  const close = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/add-kirtan"))
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("set.close")} onClose={close} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0} style={styles.stack}>
          <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("set.mine.title")}
          </Text>
          {!signedIn ? <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.mine.signin")}</Text> : null}
          {failed ? (
            <Text style={[styles.hint, { color: theme.textBody }]} accessibilityLiveRegion="polite">
              {t("set.mine.offline")}
            </Text>
          ) : null}
          {signedIn ? (
            <KPress accessibilityRole="button" accessibilityLabel={t("set.mine.new")} onPress={() => router.push(href("/upload-set"))} pressedScale={0.98} style={[styles.send, { backgroundColor: amColors.orange700 }]}>
              <Text style={styles.sendText}>{t("set.mine.new")}</Text>
            </KPress>
          ) : null}
        </Reveal>

        {signedIn ? (
          <Reveal index={1} style={styles.rows}>
            {items.length ? (
              items.map((item) => (
                <KPress
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={t("set.mine.row", { title: item.title || t("set.draft.untitled"), status: t(`set.status.${item.state}`) })}
                  onPress={() => open(item)}
                  pressedScale={0.98}
                  style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.badge, { backgroundColor: item.state === "published" ? theme.peach : "transparent", borderColor: item.state === "published" ? theme.peach : theme.line }]}>
                      <Text style={[styles.badgeText, { color: item.state === "removed" ? theme.dangerText : theme.accent }]}>{t(`set.status.${item.state}`)}</Text>
                    </View>
                    <Text style={[styles.hint, { color: theme.textBody }]}>{whenLabel(item, (day) => formatDate(day, "medium"), (from, to) => t("set.page.untilDay", { from, to }))}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.textHeading }]} numberOfLines={2}>
                    {item.title || t("set.draft.untitled")}
                  </Text>
                  <Text style={[styles.hint, { color: theme.textBody }]}>{[item.place, t("set.page.tracks", { count: item.count })].filter(Boolean).join(" · ")}</Text>
                  {item.waiting > 0 ? <Text style={[styles.hint, { color: theme.accent }]}>{t("set.mine.waiting", { count: item.waiting })}</Text> : null}
                </KPress>
              ))
            ) : loading ? (
              <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.page.loading")}</Text>
            ) : (
              <Text style={[styles.body, { color: theme.textBody }]}>{t("set.mine.empty")}</Text>
            )}
          </Reveal>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  stack: { gap: 14 },
  h1: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8, textTransform: "uppercase" },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  send: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  sendText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  rows: { gap: 12 },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  badge: { height: 28, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  cardTitle: { fontFamily: amFonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.2, textTransform: "uppercase" },
})
