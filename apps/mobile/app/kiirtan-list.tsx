import { useCallback, useMemo, useState, type ReactNode } from "react"
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Plus } from "lucide-react-native"

import { HOME_INSET, HomeEmpty } from "@/components/home/HomeBlocks"
import { KirtanMenuSheet, KirtanShareSheet } from "@/components/kirtan/KirtanMenus"
import { KirtanRow, PlayFilled } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { RemovedCard, UploadRow } from "@/components/kirtan/MyUploads"
import { Switch } from "@/components/offline/ListDownloadRow"
import { SpRound } from "@/components/song-v2/SpUi"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useDownloadedKirtans } from "@/hooks/useDownloadedKirtans"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtans } from "@/hooks/useKirtans"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useLanguage, useT } from "@/lib/i18n"
import { addRecordingHref, groupByKind, HUB_KINDS, kindsPresent, listOfKind, onlyOnPhone, parseHubListParams, savedWithDownloads, typeChips, type KindGroup } from "@/lib/kirtan/hub"
import { playListShuffled } from "@/lib/kirtan/hubPlayback"
import { filterByKind, kindCountLabel, kindLabel, kindLabelPlural, kindWhat } from "@/lib/kirtan/kind"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import { filterBySub, hasSubFilters, isSubFilterOn, languagesIn, NO_SUB_FILTER, type KindSubFilter } from "@/lib/kirtan/tab"
import { languageLabel } from "@/lib/kirtan/languages"
import { DANCES, type Kirtan, type KirtanTypeId, type RecordingKind } from "@/lib/kirtan/types"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

type Row =
  | { key: string; type: "row"; kirtan: Kirtan; context: readonly Kirtan[] }
  | { key: string; type: "group"; group: KindGroup<Kirtan> }

/**
 * The full list behind the Kiirtan tab (Dada, 10 Nov 2026): `/kiirtan-list?mode=category&kind=bhajan` (every recording of one
 * kind, the other kinds one tap away, the types of the kind inside), `?mode=saved` (Saved and Downloaded are ONE list; the
 * little arrow on a row means it is on this phone; "Only on this phone" keeps those) and `?mode=mine` (everything the person
 * uploaded, grouped by the kind it was uploaded as). Same rows, menus and player as the tab.
 */
export default function KiirtanListScreen() {
  const t = useT()
  useLanguage()
  const router = useRouter()
  const am = useAmTheme()
  const p = protoFor(am)
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const inset = useScreenTop()
  const bottomInset = useScrollBottomInset()
  const actions = useKirtanActions()
  const params = useLocalSearchParams<{ mode?: string; kind?: string; phone?: string }>()
  const start = useMemo(() => parseHubListParams(params), [params])
  const { mode } = start

  const { playable, byId, submissions } = useKirtans()
  const savedIds = useKirtanStore((s) => s.savedIds)
  const downloaded = useDownloadedKirtans(playable)

  const [kind, setKindRaw] = useState<RecordingKind>(start.kind)
  const [type, setType] = useState<KirtanTypeId | null>(null)
  const [sub, setSub] = useState<KindSubFilter>(NO_SUB_FILTER)
  const [phoneOnly, setPhoneOnly] = useState(start.phone)
  const [savedKind, setSavedKind] = useState<RecordingKind | "all">("all")
  const [menu, setMenu] = useState<Kirtan | null>(null)
  const [share, setShare] = useState<Kirtan | null>(null)
  const setKind = (next: RecordingKind) => {
    setKindRaw(next)
    setType(null)
    setSub(NO_SUB_FILTER)
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan")))
  const play = (k: Kirtan, context: readonly Kirtan[], label?: string | null) => actions.open(k, context, label)
  const openOriginal = (id: string) => {
    const original = playable.find((k) => k.serverId === id || k.id === id)
    if (original) play(original, [original])
    else actions.flash(t("ugc.dup.cantPlay"))
  }
  const onShare = useCallback(
    async (k: Kirtan, target: ShareTargetId) => {
      const message = shareToast(await runShare(target, kirtanSharePayload(k)))
      if (message) actions.flash(message)
    },
    [actions],
  )
  const addHref = addRecordingHref(kind)

  /* ---------------------------------------------------------------- the lists of the three modes */
  const ofKind = useMemo(() => filterByKind(playable, kind), [playable, kind])
  const languageCodes = useMemo(() => (hasSubFilters(kind) ? languagesIn(ofKind) : []), [ofKind, kind])
  const categoryList = useMemo(() => {
    const byType = listOfKind(playable, kind, type)
    return hasSubFilters(kind) ? filterBySub(byType, sub) : byType
  }, [playable, kind, type, sub])
  const types = useMemo(() => typeChips(playable, kind), [playable, kind])

  const savedAll = useMemo(() => savedWithDownloads(savedIds, byId, downloaded), [savedIds, byId, downloaded])
  const savedKinds = useMemo(() => kindsPresent(savedAll), [savedAll])
  const savedShown = useMemo(() => {
    const byKind = savedKind === "all" ? savedAll : filterByKind(savedAll, savedKind)
    return phoneOnly ? onlyOnPhone(byKind, downloaded) : byKind
  }, [savedAll, savedKind, phoneOnly, downloaded])
  const phoneCount = useMemo(() => onlyOnPhone(savedAll, downloaded).length, [savedAll, downloaded])

  const mineGroups = useMemo(() => groupByKind(submissions), [submissions])

  const rows: Row[] = useMemo(() => {
    if (mode === "category") return categoryList.map((k) => ({ key: k.id, type: "row", kirtan: k, context: categoryList }))
    if (mode === "saved") return savedShown.map((k) => ({ key: k.id, type: "row", kirtan: k, context: savedShown }))
    return mineGroups.flatMap((group) => {
      const live = group.items.filter((k) => k.status === "published")
      return [{ key: `g-${group.kind}`, type: "group" as const, group }, ...group.items.map((k) => ({ key: k.id, type: "row" as const, kirtan: k, context: live }))]
    })
  }, [mode, categoryList, savedShown, mineGroups])

  /* ---------------------------------------------------------------- the page's own words */
  const title = mode === "category" ? kindLabelPlural(kind) : mode === "saved" ? t("kh.list.savedTitle") : t("kh.list.mineTitle")
  const eyebrow = mode === "category" ? t("kh.list.category") : t("kh.mine.eyebrow")
  const total = mode === "category" ? categoryList.length : mode === "saved" ? savedShown.length : submissions.length
  const countText = mode === "category" ? kindCountLabel(kind, total) : t("kh.list.count", { count: total })
  const queueLabel = mode === "category" ? kindLabelPlural(kind) : mode === "saved" ? t("kh.list.queue.saved") : t("kh.list.queue.mine")

  const header = (
    <View style={styles.head}>
      {mode === "category" ? (
        <>
          <PillRow p={p} label={t("kh.list.category")} items={HUB_KINDS.map((k) => ({ id: k, label: kindLabel(k) }))} value={kind} onChange={(id) => setKind(id as RecordingKind)} />
          {types.length ? (
            <PillRow p={p} label={t("kh.list.types")} items={[{ id: "all", label: `${t("kh.list.allTypes")} ${ofKind.length}` }, ...types.map((c) => ({ id: c.id, label: `${c.label} ${c.count}` }))]} value={type ?? "all"} onChange={(id) => setType(id === "all" ? null : (id as KirtanTypeId))} />
          ) : null}
          {kind === "dance_song" ? (
            <PillRow p={p} label={t("kt.sub.dance")} items={[{ id: "all", label: t("kt.sub.allDances") }, ...DANCES.map((d) => ({ id: d, label: (t as (key: string) => string)(`rec.dance.${d}`) }))]} value={sub.dance ?? "all"} onChange={(id) => setSub((cur) => ({ ...cur, dance: id === "all" ? null : (id as KindSubFilter["dance"]) }))} />
          ) : null}
          {languageCodes.length ? (
            <PillRow p={p} label={t("kt.sub.language")} items={[{ id: "all", label: t("kt.sub.anyLanguage") }, ...languageCodes.map((c) => ({ id: c, label: languageLabel(c) }))]} value={sub.language ?? "all"} onChange={(id) => setSub((cur) => ({ ...cur, language: id === "all" ? null : id }))} />
          ) : null}
          {categoryList.length > 0 ? (
            <View style={styles.actions}>
              <ActionPill p={p} primary label={t("kh.list.playAll")} icon={<PlayFilled size={16} color={p.onAction} />} onPress={() => play(categoryList[0]!, categoryList, queueLabel)} />
              <ActionPill p={p} label={t("kh.list.shuffle")} onPress={() => actions.flash(playListShuffled(categoryList, queueLabel) ?? "")} />
            </View>
          ) : null}
        </>
      ) : null}

      {mode === "saved" ? (
        <>
          <KPress
            accessibilityRole="switch"
            accessibilityLabel={t("kh.list.onPhoneA11y")}
            accessibilityState={{ checked: phoneOnly }}
            onActivate={() => setPhoneOnly((on) => !on)}
            pressedScale={0.98}
            outerStyle={styles.switchOuter}
            style={[styles.switchRow, { backgroundColor: p.white, borderColor: p.sand300 }]}
          >
            <Text style={[styles.switchText, { color: p.ink800 }]}>{t("kh.list.onPhone")}</Text>
            <Switch on={phoneOnly} theme={theme} />
          </KPress>
          {savedKinds.length > 1 ? (
            <PillRow p={p} label={t("kh.list.allKinds")} items={[{ id: "all", label: t("kh.list.allKinds") }, ...savedKinds.map((k) => ({ id: k, label: kindLabel(k) }))]} value={savedKind} onChange={(id) => setSavedKind(id as RecordingKind | "all")} />
          ) : null}
          {phoneCount > 0 ? <Text style={[styles.note, { color: p.ink500 }]}>{phoneOnly ? t("kh.list.arrowNoteShort") : t("kh.list.arrowNote", { count: savedAll.length })}</Text> : null}
          {savedShown.length > 0 ? (
            <View style={styles.actions}>
              <ActionPill p={p} primary label={t("kh.list.playAll")} icon={<PlayFilled size={16} color={p.onAction} />} onPress={() => play(savedShown[0]!, savedShown, queueLabel)} />
              <ActionPill p={p} label={t("kh.list.shuffle")} onPress={() => actions.flash(playListShuffled(savedShown, queueLabel) ?? "")} />
            </View>
          ) : null}
        </>
      ) : null}

      {mode === "mine" ? (
        <KPress accessibilityRole="button" accessibilityLabel={t("kt.add.a11y")} onPress={() => router.push(href("/add-kirtan"))} pressedScale={0.98} outerStyle={styles.addOuter} style={[styles.addCard, { borderColor: theme.accent }]}>
          <View style={[styles.addDisc, { backgroundColor: theme.peach }]}>
            <Plus size={22} color={theme.accent} strokeWidth={2.2} />
          </View>
          <View style={styles.addText}>
            <Text style={[styles.addTitle, { color: theme.textHeading }]}>{t("kt.add.title")}</Text>
            <Text style={[styles.addSub, { color: theme.textBody }]}>{t("kt.add.sub")}</Text>
          </View>
        </KPress>
      ) : null}
    </View>
  )

  const empty = () => {
    if (mode === "saved") return <HomeEmpty p={p} text={phoneOnly && savedAll.length > 0 ? t("kh.list.emptyOnPhone") : savedAll.length > 0 ? t("kh.list.emptyFiltered") : t("kt.empty.saved")} />
    if (mode === "mine") return <HomeEmpty p={p} text={t("kt.empty.mine")} />
    const filtered = type !== null || isSubFilterOn(sub)
    return (
      <View style={styles.emptyBox}>
        <HomeEmpty p={p} text={filtered ? t("kh.list.emptyFiltered") : t("kh.list.empty", { what: kindWhat(kind) })} />
        {!filtered ? (
          <KPress accessibilityRole="button" accessibilityLabel={t("kt.add.a11y")} onPress={() => router.push(href(addHref))} pressedScale={0.98} style={[styles.addCard, { borderColor: theme.accent }]}>
            <View style={[styles.addDisc, { backgroundColor: theme.peach }]}>
              <Plus size={22} color={theme.accent} strokeWidth={2.2} />
            </View>
            <View style={styles.addText}>
              <Text style={[styles.addTitle, { color: theme.textHeading }]}>{t("kt.add.title")}</Text>
              <Text style={[styles.addSub, { color: theme.textBody }]}>{t("kt.add.sub")}</Text>
            </View>
          </KPress>
        ) : null}
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: p.sand200 }]}>
      <View style={[styles.bar, { paddingTop: inset, backgroundColor: p.sand200 }]}>
        <View style={styles.titleRow}>
          <SpRound t={sp} icon="back" label={t("kh.list.back")} onPress={back} />
          <View style={styles.titleText}>
            <Text style={[styles.eyebrow, { color: p.orange700 }]} numberOfLines={1}>
              {eyebrow}
            </Text>
            <Text style={[styles.title, { color: p.ink800 }]} numberOfLines={2} accessibilityRole="header">
              {title}
            </Text>
            <Text style={[styles.count, { color: p.ink500 }]}>{countText}</Text>
          </View>
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => {
          if (item.type === "group") {
            return (
              <Text style={[styles.group, { color: p.ink800 }]} accessibilityRole="header">
                {kindLabel(item.group.kind)}
                <Text style={{ color: p.ink300 }}>{`  ${item.group.items.length}`}</Text>
              </Text>
            )
          }
          const k = item.kirtan
          return (
            <View style={styles.rowWrap}>
              {mode === "mine" ? (
                k.status === "removed" ? (
                  <RemovedCard theme={theme} kirtan={k} onOpenOriginal={openOriginal} />
                ) : (
                  <UploadRow theme={theme} kirtan={k} onOpen={(row) => play(row, item.context, queueLabel)} onMore={setMenu} onOpenArtist={actions.openArtist} />
                )
              ) : (
                <KirtanRow theme={theme} kirtan={k} compact onOpen={(row) => play(row, item.context, queueLabel)} onMore={setMenu} onOpenArtist={actions.openArtist} />
              )}
            </View>
          )
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset, paddingTop: 8 }}
        initialNumToRender={14}
        windowSize={7}
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

/** A row of pills that scrolls sideways: one is chosen. Used for the kinds, the types, the dance and the language. */
function PillRow({ p, label, items, value, onChange }: { p: AmProto; label: string; items: readonly { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {items.map((item) => {
        const on = item.id === value
        return (
          <KPress key={item.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={item.label} onActivate={() => onChange(item.id)} pressedScale={0.95} style={[styles.pill, { backgroundColor: on ? p.action : p.white, borderColor: on ? p.action : p.sand300 }]}>
            <Text style={[styles.pillText, { color: on ? p.onAction : p.ink800 }]}>{item.label}</Text>
          </KPress>
        )
      })}
    </ScrollView>
  )
}

function ActionPill({ p, label, icon, primary, onPress }: { p: AmProto; label: string; icon?: ReactNode; primary?: boolean; onPress: () => void }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.96} style={[styles.action, { backgroundColor: primary ? p.action : p.white, borderColor: primary ? p.action : p.sand300 }]}>
      {icon}
      <Text style={[styles.actionText, { color: primary ? p.onAction : p.ink800 }]}>{label}</Text>
    </KPress>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { zIndex: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: 16, minHeight: 72 },
  titleText: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, textTransform: "uppercase" },
  title: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, textTransform: "uppercase" },
  count: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  head: { gap: 12, paddingBottom: 12 },
  pills: { paddingHorizontal: HOME_INSET, gap: 8 },
  pill: { height: 40, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1, justifyContent: "center" },
  pillText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: HOME_INSET },
  action: { height: 40, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  actionText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  switchOuter: { marginHorizontal: HOME_INSET },
  switchRow: { minHeight: 56, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  switchText: { flex: 1, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  note: { paddingHorizontal: HOME_INSET, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  group: { paddingHorizontal: HOME_INSET, paddingTop: 24, paddingBottom: 8, fontFamily: amFonts.display, fontSize: 20, lineHeight: 22, letterSpacing: -0.3, textTransform: "uppercase" },
  rowWrap: { paddingHorizontal: HOME_INSET, paddingVertical: 4 },
  emptyBox: { gap: 16, paddingHorizontal: HOME_INSET },
  addOuter: { marginHorizontal: HOME_INSET },
  addCard: { minHeight: 68, borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 10 },
  addDisc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  addText: { flex: 1, gap: 2 },
  addTitle: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  addSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
})
