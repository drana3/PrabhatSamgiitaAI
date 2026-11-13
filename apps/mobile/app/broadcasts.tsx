import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { BroadcastCard } from "@/components/broadcasts/BroadcastCard"
import { SheetTopBar } from "@/components/common/SheetTopBar"
import { ActionButton, Chip, Hint } from "@/components/song-chords/parts"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useBroadcasts } from "@/hooks/useBroadcasts"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { shelfOrder } from "@/lib/broadcasts/rules"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { previewGuest } from "@/lib/songChords/backend"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

type Tab = "now" | "recent" | "mine"

/**
 * All broadcasts: on the air and announced ("Live and upcoming"), the ones of the past week ("Recent"), and the member's own
 * ("Mine", kept for the author after the week is over). The shelf of the Kiirtan screen leads here (docs/broadcasts.md).
 */
export default function BroadcastsScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const bottomInset = useScrollBottomInset(24)
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(params.tab === "mine" ? "mine" : "now")
  const signedIn = useAuthStore((st) => st.mode === "signed_in") || (MOCKUP_DATA && !previewGuest())
  const list = useBroadcasts(tab === "mine" ? "mine" : tab === "recent" ? "recent" : "shelf", tab !== "mine" || signedIn)
  const shown = useMemo(() => (tab === "now" ? shelfOrder(list.items) : list.items), [tab, list.items])
  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/")))
  const tabs: { id: Tab; label: string }[] = [
    { id: "now", label: t("bc.l.tab.now") },
    { id: "recent", label: t("bc.l.tab.recent") },
    { id: "mine", label: t("bc.l.tab.mine") },
  ]
  const empty = tab === "mine" ? t("bc.l.empty.mine") : tab === "recent" ? t("bc.l.empty.recent") : t("bc.l.empty")

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("bc.f.close")} onClose={close} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0} style={s.head}>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("bc.l.title")}
          </Text>
          <View style={s.chips} accessibilityRole="radiogroup">
            {tabs.map((entry) => (
              <Chip key={entry.id} theme={theme} label={entry.label} on={tab === entry.id} onPress={() => setTab(entry.id)} />
            ))}
          </View>
        </Reveal>

        <Reveal index={1} style={s.list}>
          {tab === "mine" && !signedIn ? (
            <>
              <Hint theme={theme}>{t("bc.l.signin")}</Hint>
              <ActionButton theme={theme} tone="quiet" label={t("bc.f.signin.action")} onPress={() => router.push(href("/signin"))} />
            </>
          ) : list.failure ? (
            <>
              <Hint theme={theme} tone="danger">
                {(t as (key: string) => string)(`bc.err.${list.failure}`)}
              </Hint>
              <ActionButton theme={theme} tone="quiet" label={t("bc.p.retry")} onPress={list.reload} />
            </>
          ) : shown.length ? (
            shown.map((b) => <BroadcastCard key={b.id} item={b} theme={theme} onPress={() => router.push(href(`/broadcast/${b.id}`))} />)
          ) : list.loading ? null : (
            <Hint theme={theme}>{empty}</Hint>
          )}
        </Reveal>

        <Reveal index={2}>
          <ActionButton theme={theme} label={t("bc.l.add")} onPress={() => router.push(href("/upload-broadcast"))} />
        </Reveal>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  head: { gap: 16 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  list: { gap: 16 },
})
