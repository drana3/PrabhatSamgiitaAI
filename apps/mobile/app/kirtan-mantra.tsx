import { useCallback, useEffect, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { KirtanMenuSheet, KirtanShareSheet } from "@/components/kirtan/KirtanMenus"
import { ChevronGlyph, KirtanRow, PlayFilled } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { versionsLabel, versionWord, type MantraSummary } from "@/lib/kirtan/mantras"
import { loadMantras, loadMantraVersions } from "@/lib/kirtan/mantraSource"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import type { Kirtan } from "@/lib/kirtan/types"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

/**
 * The mantra pages (docs/kiirtan-publishing.md, "Duplicates"). Many performances of one chant are VERSIONS of it,
 * not duplicates, so they live together:
 * - `/kirtan-mantra` lists the mantras of the library, most versions first, each with its number of versions;
 * - `/kirtan-mantra?id=<mantra>` lists the versions of one mantra (Newest or Most played) and plays them in the one player.
 * Nothing is invented: in a real build the lists come from the server and, when it cannot be reached, the page says so
 * and offers to try again. The demo preview groups its sample recordings on the phone.
 */

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T }

/** Runs `run` again whenever `key` changes or the person taps "Try again". A late answer for an old key is dropped. */
function useLoad<T>(run: () => Promise<T>, key: string): { state: Load<T>; retry: () => void } {
  const [state, setState] = useState<Load<T>>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState((current) => (current.status === "ready" ? current : { status: "loading" }))
    run().then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data })
      },
      () => {
        if (!cancelled) setState({ status: "error" })
      },
    )
    return () => {
      cancelled = true
    }
    // `run` is rebuilt every render; `key` says when its meaning changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])
  return { state, retry: () => setAttempt((n) => n + 1) }
}

export default function KirtanMantraScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === "string" ? params.id : ""
  return id ? <MantraVersionsPage id={id} /> : <MantraListPage />
}

/* ------------------------------------------------------------------ shared pieces */

function useBack() {
  const router = useRouter()
  return useCallback(() => (router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan"))), [router])
}

function TopBar({ theme, onBack }: { theme: SongsTheme; onBack: () => void }) {
  const t = useT()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bar, { paddingTop: (insets.top || 54) + 6 }]}>
      <KPress
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        onPress={onBack}
        pressedScale={0.9}
        style={[styles.backDisc, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <View style={styles.flip}>
          <ChevronGlyph color={theme.textHeading} />
        </View>
      </KPress>
    </View>
  )
}

function Message({ theme, text, action, onAction }: { theme: SongsTheme; text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.message} accessibilityLiveRegion="polite">
      <Text style={[styles.body, { color: theme.textBody }]}>{text}</Text>
      {action && onAction ? (
        <KPress accessibilityRole="button" accessibilityLabel={action} onPress={onAction} pressedScale={0.96} style={[styles.pill, { backgroundColor: amColors.orange700 }]}>
          <Text style={styles.pillText}>{action}</Text>
        </KPress>
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------------ all mantras */

function MantraListPage() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const back = useBack()
  const bottomInset = useScrollBottomInset()
  const { state, retry } = useLoad(() => loadMantras(), "all")

  const header = (
    <View>
      <TopBar theme={theme} onBack={back} />
      <Reveal index={0} style={styles.titleBlock}>
        <Text style={[styles.over, { color: theme.accent }]}>{t("mantra.listOver")}</Text>
        <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
          {t("mantra.listFirst")}
          {"\n"}
          <Text style={{ color: theme.ink300 }}>{t("mantra.listSecond")}</Text>
        </Text>
        <Text style={[styles.body, { color: theme.textBody }]}>{t("mantra.listIntro")}</Text>
      </Reveal>
    </View>
  )

  const items: MantraSummary[] = state.status === "ready" ? state.data : []
  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item, index }) => (
          <Reveal index={Math.min(index + 1, 8)} style={styles.rowSlot}>
            <MantraRow theme={theme} mantra={item} onOpen={() => router.push(href(`/kirtan-mantra?id=${encodeURIComponent(item.id)}`))} />
          </Reveal>
        )}
        ListEmptyComponent={
          state.status === "loading" ? (
            <Message theme={theme} text={t("mantra.loading")} />
          ) : state.status === "error" ? (
            <Message theme={theme} text={t("mantra.error")} action={t("mantra.retry")} onAction={retry} />
          ) : (
            <Message theme={theme} text={t("mantra.listEmpty")} />
          )
        }
        contentContainerStyle={{ paddingBottom: bottomInset }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

/** One mantra: its name and, large, how many versions it has. */
function MantraRow({ theme, mantra, onOpen }: { theme: SongsTheme; mantra: MantraSummary; onOpen: () => void }) {
  const t = useT()
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={t("mantra.openA11y", { title: mantra.title, versions: versionsLabel(mantra.versions) })}
      onPress={onOpen}
      pressedScale={0.985}
      style={[styles.mantraRow, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Text style={[styles.mantraName, { color: theme.textHeading }]} numberOfLines={2}>
        {mantra.title}
      </Text>
      <View style={styles.mantraCount}>
        <Text style={[styles.countNumber, { color: theme.textHeading }]}>{mantra.versions}</Text>
        <Text style={[styles.countWord, { color: theme.accent }]}>{versionWord(mantra.versions)}</Text>
      </View>
    </KPress>
  )
}

/* ------------------------------------------------------------------ the versions of one mantra */

type Sort = "newest" | "plays"

function MantraVersionsPage({ id }: { id: string }) {
  const t = useT()
  const theme = useSongsTheme()
  const back = useBack()
  const bottomInset = useScrollBottomInset()
  const actions = useKirtanActions()
  const savedIds = useKirtanStore((s) => s.savedIds)
  const [sort, setSort] = useState<Sort>("newest")
  const [menu, setMenu] = useState<Kirtan | null>(null)
  const [share, setShare] = useState<Kirtan | null>(null)
  const { state, retry } = useLoad(() => loadMantraVersions(id, sort), `${id}:${sort}`)

  const onShare = async (k: Kirtan, target: ShareTargetId) => {
    const message = shareToast(await runShare(target, kirtanSharePayload(k)))
    if (message) actions.flash(message)
  }

  const ready = state.status === "ready" ? state.data : null
  const mantra = ready?.mantra ?? null
  const items = ready?.items ?? []
  const title = mantra?.title ?? ""

  const header = (
    <View>
      <TopBar theme={theme} onBack={back} />
      <Reveal index={0} style={styles.titleBlock}>
        <Text style={[styles.over, { color: theme.accent }]}>{t("mantra.over")}</Text>
        {title ? (
          <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
      </Reveal>
      {mantra ? (
        <Reveal index={1} style={styles.countBlock}>
          <View style={styles.bigCount}>
            <Text style={[styles.bigNumber, { color: theme.textHeading }]}>{items.length}</Text>
            <Text style={[styles.bigWord, { color: theme.textBody }]}>{versionWord(items.length)}</Text>
          </View>
          {items.length ? (
            <KPress
              accessibilityRole="button"
              accessibilityLabel={t("mantra.playA11y", { title })}
              onPress={() => actions.open(items[0], items, title)}
              pressedScale={0.97}
              style={[styles.playAll, { backgroundColor: amColors.orange700 }]}
            >
              <PlayFilled size={20} color="#FFFFFF" />
              <Text style={styles.pillText}>{t("mantra.play")}</Text>
            </KPress>
          ) : null}
        </Reveal>
      ) : null}
      {mantra ? (
        <View style={styles.sorts} accessibilityRole="radiogroup">
          {(["newest", "plays"] as const).map((option) => {
            const on = sort === option
            return (
              <KPress
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`mantra.sort.${option}`)}
                onActivate={() => setSort(option)}
                pressedScale={0.95}
                style={[styles.sortChip, { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : theme.line }]}
              >
                <Text style={[styles.sortText, { color: on ? theme.onInk : theme.textHeading }]}>{t(`mantra.sort.${option}`)}</Text>
              </KPress>
            )
          })}
        </View>
      ) : null}
    </View>
  )

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <FlatList
        data={items}
        keyExtractor={(k) => k.id}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <View style={styles.rowSlot}>
            <KirtanRow theme={theme} kirtan={item} compact onOpen={(k) => actions.open(k, items, title)} onMore={setMenu} onOpenArtist={actions.openArtist} />
          </View>
        )}
        ListEmptyComponent={
          state.status === "loading" ? (
            <Message theme={theme} text={t("mantra.loading")} />
          ) : state.status === "error" ? (
            <Message theme={theme} text={t("mantra.error")} action={t("mantra.retry")} onAction={retry} />
          ) : (
            <Message theme={theme} text={mantra ? t("mantra.empty") : t("mantra.missing")} />
          )
        }
        contentContainerStyle={{ paddingBottom: bottomInset }}
        showsVerticalScrollIndicator={false}
      />
      <KirtanMenuSheet
        open={Boolean(menu)}
        theme={theme}
        kirtan={menu}
        saved={menu ? savedIds.includes(menu.id) : false}
        onPlayNext={actions.playNext}
        onAddToPlaylist={actions.addToPlaylist}
        onToggleSave={actions.toggleSaved}
        onShare={(k) => setShare(k)}
        onClose={() => setMenu(null)}
      />
      <KirtanShareSheet open={Boolean(share)} theme={theme} kirtan={share} onShare={onShare} onClose={() => setShare(null)} />
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: 16, paddingBottom: 8 },
  backDisc: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  flip: { transform: [{ scaleX: -1 }] },
  titleBlock: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  body: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24 },
  message: { paddingHorizontal: 20, paddingTop: 32, gap: 16, alignItems: "flex-start" },
  pill: { height: 48, paddingHorizontal: 28, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22, color: "#FFFFFF" },
  sep: { height: 8 },
  rowSlot: { paddingHorizontal: 20 },
  mantraRow: { minHeight: 76, borderRadius: 24, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  mantraName: { flex: 1, minWidth: 0, fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.4, textTransform: "uppercase" },
  mantraCount: { alignItems: "flex-end" },
  countNumber: { fontFamily: amFonts.display, fontSize: 44, lineHeight: 44, letterSpacing: -0.9 },
  countWord: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: "uppercase" },
  countBlock: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, paddingHorizontal: 20, paddingTop: 20 },
  bigCount: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  bigNumber: { fontFamily: amFonts.display, fontSize: 64, lineHeight: 64, letterSpacing: -1.4 },
  bigWord: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  playAll: { height: 52, paddingHorizontal: 24, borderRadius: 70, flexDirection: "row", alignItems: "center", gap: 8 },
  sorts: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  sortChip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  sortText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
