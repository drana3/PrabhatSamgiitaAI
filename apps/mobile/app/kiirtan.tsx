import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { Plus, Search } from "lucide-react-native"
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated"

import { AvatarFace } from "@/components/profile-v2/AvatarFace"
import { HOME_INSET, HomeEmpty, HomeSectionHead, NotificationBell } from "@/components/home/HomeBlocks"
import { LiveCard } from "@/components/kirtan/LiveCard"
import { AuthorsShelf } from "@/components/authors/AuthorsShelf"
import { BroadcastsShelf } from "@/components/broadcasts/BroadcastsShelf"
import { BroadcastNowStrip } from "@/components/kirtan/hub/BroadcastNowStrip"
import { KindCards } from "@/components/kirtan/hub/KindCards"
import { MineTiles } from "@/components/kirtan/hub/MineTiles"
import { KiirtanCover } from "@/components/kirtan/KiirtanCover"
import { KirtanMenuSheet, KirtanShareSheet } from "@/components/kirtan/KirtanMenus"
import { KirtanRow, KirtanTag, PlayFilled } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { chipColorsOf, StickyChipsRow, StickyTopBlock } from "@/components/nav-v2/StickyChips"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { TodayPress } from "@/components/today/TodayPress"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor } from "@/constants/tokens/amToday"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useDownloadedKirtans } from "@/hooks/useDownloadedKirtans"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useBroadcasts } from "@/hooks/useBroadcasts"
import { useKirtanLive } from "@/hooks/useKirtanLive"
import { useNotificationItems } from "@/hooks/useNotificationItems"
import { useKirtans } from "@/hooks/useKirtans"
import { usePianoRecordingIds } from "@/hooks/usePianoRecordingIds"
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { sampleResume } from "@/lib/fixtures/kirtanGate"
import { kiirtanListHref, kindCards, listAddressOfFilter, savedWithDownloads } from "@/lib/kirtan/hub"
import { filterByKind, kindDayA11y, kindDayLabel, kindHeading, kindLabel, kindLabelPlural } from "@/lib/kirtan/kind"
import { phaseNow, shelfOrder } from "@/lib/broadcasts/rules"
import { LENGTH_BUCKETS, longKirtans, type LengthBucketId } from "@/lib/kirtan/length"
import { formatKirtanLength } from "@/lib/kirtan/list"
import { withPianoFlag } from "@/lib/pianoNotes/flag"
import { isPianoKirtan, menuKind } from "@/lib/searchMenu/live"
import { playEverything } from "@/lib/kirtan/mixPlayback"
import { dayNumberOf, kiirtanOfTheDay, resumeEntries, resumeLabel, resumeProgress } from "@/lib/kirtan/resume"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import { bhajansForEveryHour, emptyCatalogText, emptyListText, filterBySub, hasSubFilters, isEmptyCatalog, isSubFilterOn, kindOfTabChip, KIRTAN_TAB_CHIPS, languagesIn, newKirtansList, NO_SUB_FILTER, parseKirtanTabChip, subEmptyText, type KindSubFilter, type KirtanTabChip } from "@/lib/kirtan/tab"
import { languageLabel } from "@/lib/kirtan/languages"
import { avartaCount, avartaOnly } from "@/lib/kirtan/practice"
import { DANCES, kirtanTypeLabel, type Kirtan } from "@/lib/kirtan/types"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"
import { recordingSeed } from "@/lib/photos/recordingPhoto"

/** Row 1 (avatar, search, bell): height of the icon row inside the pinned block. */
const TOP_ROW = 60
const SECTION_GAP = 36

/**
 * The Kiirtan tab (Dada, 10 Nov 2026). Row 1 (avatar, search, the notifications bell; Add lives in the Upload button of the tab bar)
 * and the chips row (All and the six kinds) are ONE pinned header block; the big heading scrolls away. The chips are the KIND
 * filter and narrow the shelves below. Prabhat Samgiita is no chip, no tag and no card here. Under All the page reads, top to bottom:
 * a slim strip while a broadcast is on the air, the recording of the day, Jump back in, "Browse by category" (one card per kind
 * with its real count; a card opens the FULL list of that kind in app/kiirtan-list.tsx, the types of the kind inside it), the full
 * "Live and upcoming" shelf, By length, Authors who sing here, Bhajans for every hour, New recordings, Long kiirtans, and at the
 * very bottom "My Kiirtan": two tiles, Saved (one list, a download is a save) and My uploads (by kind). Every row plays in the one
 * player (the pill appears by itself).
 * TODO(api): the catalog, the day's pick and the resume positions come from the backend.
 */
export default function KiirtanTabScreen() {
  const bottomInset = useScrollBottomInset()
  const t = useT()
  const router = useRouter()
  const am = useAmTheme()
  const p = protoFor(am)
  const theme = useSongsTheme()
  const top = useScreenTop()
  const initial = useProfileInitial()
  const params = useLocalSearchParams<{ filter?: string }>()
  const actions = useKirtanActions()
  const { playable: allPlayable, byId, submissions } = useKirtans()
  const savedIds = useKirtanStore((s) => s.savedIds)
  const live = useKirtanLive()
  const { unread: unreadNotes } = useNotificationItems()

  const [chip, setChipRaw] = useState<KirtanTabChip>(parseKirtanTabChip(params.filter))
  // The old chips (Saved, Downloaded, My uploads) are still linked from the profile, the library and the upload exit: they open the list screen
  const listAddress = listAddressOfFilter(params.filter)
  // Spiritual song and Dance music can be narrowed by dance and by language; a new chip starts without it
  const [sub, setSub] = useState<KindSubFilter>(NO_SUB_FILTER)
  // Kiirtan chip only: show just the Avarta Kiirtan (the choice exists only while the library holds one)
  const [avartaView, setAvartaView] = useState(false)
  const setChip = (next: KirtanTabChip) => {
    setChipRaw(next)
    setSub(NO_SUB_FILTER)
    setAvartaView(false)
  }
  const [length, setLength] = useState<LengthBucketId | null>(null)
  const [menu, setMenu] = useState<Kirtan | null>(null)
  const [share, setShare] = useState<Kirtan | null>(null)

  /** the kind filter of the first three chips; the list chips (Saved...) show both kinds */
  const kind = kindOfTabChip(chip)
  // on the Other mantras tab the plus opens the mantra page; everywhere else the recording form
  const addHref = kind === "other_mantra" ? "/add-mantra" : "/add-kirtan"
  const showKiirtan = kind === "all" || kind === "kiirtan"
  const subOn = hasSubFilters(kind) && isSubFilterOn(sub)
  const avartaTotal = useMemo(() => avartaCount(allPlayable), [allPlayable])
  const avartaOn = avartaView && kind === "kiirtan" && avartaTotal > 0
  const playable = useMemo(() => {
    const narrowed = hasSubFilters(kind) ? filterBySub(allPlayable, sub) : allPlayable
    return avartaOn ? avartaOnly(narrowed) : narrowed
  }, [allPlayable, kind, sub, avartaOn])
  const languageCodes = useMemo(() => (hasSubFilters(kind) ? languagesIn(allPlayable.filter((k) => k.kind === kind)) : []), [allPlayable, kind])

  const now = useMemo(() => Date.now(), [])
  const dayN = useMemo(() => dayNumberOf(now), [now])
  const kindList = useMemo(() => filterByKind(playable, kind), [playable, kind])
  const day = useMemo(() => kiirtanOfTheDay(filterByKind(playable, kind === "all" ? "kiirtan" : kind), dayN), [playable, kind, dayN])
  const bhajanDay = useMemo(() => (kind === "all" ? kiirtanOfTheDay(filterByKind(playable, "bhajan"), dayN) : null), [playable, kind, dayN])
  const hourly = useMemo(() => bhajansForEveryHour(playable), [playable])
  // "Kiirtan for piano": accepted piano notes, or a piano lead instrument (same filter as the Search shelf, so the counts agree)
  const pianoIds = usePianoRecordingIds()
  const pianoList = useMemo(() => (showKiirtan ? withPianoFlag(allPlayable, pianoIds).filter((k) => menuKind(k) === "kiirtan" && isPianoKirtan(k)).sort((a, b) => b.addedAt - a.addedAt) : []), [allPlayable, pianoIds, showKiirtan])
  const jump = useMemo(() => resumeEntries(sampleResume(), byId, 2).filter((e) => kind === "all" || e.kirtan.kind === kind), [byId, kind])
  // the category cards count every published recording, whatever chip is on
  const cards = useMemo(() => kindCards(allPlayable), [allPlayable])
  const list = useMemo(() => newKirtansList(playable, null, length, kind), [playable, length, kind])
  const longList = useMemo(() => longKirtans(kindList, 6), [kindList])
  // Saved and Downloaded are one list (a download is a save): the tile counts the saved ones and how many of them are on the phone
  const downloadedKirtans = useDownloadedKirtans(allPlayable)
  const saved = useMemo(() => savedWithDownloads(savedIds, byId, downloadedKirtans), [savedIds, byId, downloadedKirtans])
  const downloadedIds = useMemo(() => new Set(downloadedKirtans.map((k) => k.id)), [downloadedKirtans])
  const onPhoneCount = useMemo(() => saved.filter((k) => downloadedIds.has(k.id)).length, [saved, downloadedIds])
  const headFirst = kindLabel(kind === "all" ? "kiirtan" : kind).toUpperCase()
  const headSecond = kind === "all" ? t("kt.head.all") : kindHeading(kind)

  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })
  const chipColors = chipColorsOf(p)

  const onShare = useCallback(
    async (k: Kirtan, target: ShareTargetId) => {
      const message = shareToast(await runShare(target, kirtanSharePayload(k)))
      if (message) actions.flash(message)
    },
    [actions],
  )

  const play = (k: Kirtan, context: readonly Kirtan[], label?: string | null) => actions.open(k, context, label)
  /** "Listen to the original" of a recording the team removed as a copy: the original is a normal recording of the list. */
  const openOriginal = (id: string) => {
    const original = playable.find((k) => k.serverId === id || k.id === id)
    if (original) play(original, [original])
    else actions.flash(t("ugc.dup.cantPlay"))
  }
  // "Live and upcoming": appears only when at least one broadcast is on the air or announced (docs/broadcasts.md)
  const broadcasts = useBroadcasts("shelf")
  const liveBroadcasts = useMemo(() => shelfOrder(broadcasts.items), [broadcasts.items])
  // the slim strip at the top shows only while a broadcast is on the air; the full shelf below stays
  // a minute clock: a broadcast that ends while the page is open drops the strip without a reload
  const [minute, setMinute] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setMinute((m) => m + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  const onAir = useMemo(() => liveBroadcasts.find((b) => phaseNow(b) === "now") ?? null, [liveBroadcasts, minute])
  let reveal = 0
  const next = () => Math.min(reveal++, 8)

  /** The slim strip: only while a broadcast is on the air. It opens that broadcast; the full shelf is further down the page. */
  const nowStrip = () =>
    onAir ? (
      <Reveal index={next()}>
        <BroadcastNowStrip item={onAir} onOpen={(id) => router.push(href(`/broadcast/${id}`))} />
      </Reveal>
    ) : null

  /** "My Kiirtan": Saved and My uploads, two tiles at the very bottom of the page. */
  const mineTiles = () => (
    <Reveal index={next()} style={styles.section}>
      <HomeSectionHead p={p} eyebrow={t("kh.mine.eyebrow")} first={t("kh.mine.first")} second={t("kh.mine.second")} />
      <MineTiles p={p} savedCount={saved.length} onPhoneCount={onPhoneCount} uploadCount={submissions.length} onSaved={() => router.push(href(kiirtanListHref({ mode: "saved" })))} onMine={() => router.push(href(kiirtanListHref({ mode: "mine" })))} />
    </Reveal>
  )

  const titleBlock = () => (
    <Reveal index={next()} style={styles.titleBlock}>
      <Text style={styles.h1} accessibilityRole="header">
        <Text style={{ color: p.ink800 }}>{headFirst}</Text>
        {"\n"}
        <Text style={{ color: p.ink300 }}>{headSecond}</Text>
      </Text>
    </Reveal>
  )

  // Nothing exists yet (a real build before the first upload): say so, offer Add, show no empty shelves.
  const renderEmptyCatalog = () => (
    <>
      {nowStrip()}
      {titleBlock()}
      <Reveal index={next()} style={styles.section}>
        <HomeEmpty p={p} text={emptyCatalogText(kind)} />
        <View style={styles.list}>{addEntry()}</View>
      </Reveal>
      {mineTiles()}
    </>
  )

  /** Dance (Dance music only) and language chips under the heading: only languages that really occur are offered. */
  const subFilters = () =>
    hasSubFilters(kind) ? (
      <Reveal index={next()} style={styles.section}>
        {kind === "dance_song" ? (
          <View style={styles.lengths} accessibilityRole="radiogroup" accessibilityLabel={t("kt.sub.dance")}>
            {[null, ...DANCES].map((dance) => {
              const on = sub.dance === dance
              const label = dance ? (t as (key: string) => string)(`rec.dance.${dance}`) : t("kt.sub.allDances")
              return (
                <KPress key={dance ?? "all"} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onActivate={() => setSub((cur) => ({ ...cur, dance }))} pressedScale={0.95} style={[styles.lengthChip, { backgroundColor: on ? p.action : p.white, borderColor: on ? p.action : p.sand300 }]}>
                  <Text style={[styles.lengthText, { color: on ? p.onAction : p.ink800 }]}>{label}</Text>
                </KPress>
              )
            })}
          </View>
        ) : null}
        {languageCodes.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lengths} accessibilityRole="radiogroup" accessibilityLabel={t("kt.sub.language")}>
            {[null, ...languageCodes].map((code) => {
              const on = sub.language === code
              const label = code ? languageLabel(code) : t("kt.sub.anyLanguage")
              return (
                <KPress key={code ?? "any"} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onActivate={() => setSub((cur) => ({ ...cur, language: code }))} pressedScale={0.95} style={[styles.lengthChip, { backgroundColor: on ? p.action : p.white, borderColor: on ? p.action : p.sand300 }]}>
                  <Text style={[styles.lengthText, { color: on ? p.onAction : p.ink800 }]}>{label}</Text>
                </KPress>
              )
            })}
          </ScrollView>
        ) : null}
      </Reveal>
    ) : null

  // A dance or language filter that leaves nothing says so plainly; it is not "no recordings yet"
  const renderFilteredEmpty = () => (
    <>
      {titleBlock()}
      {subFilters()}
      <Reveal index={next()} style={styles.section}>
        <HomeEmpty p={p} text={subEmptyText(kind, sub)} />
      </Reveal>
    </>
  )

  /** "All Kiirtans / Avarta Kiirtan (N)" under the Kiirtan heading; absent while the library holds no Avarta Kiirtan. */
  const practiceChoice = () =>
    kind === "kiirtan" && avartaTotal > 0 ? (
      <Reveal index={next()} style={styles.section}>
        <View style={styles.lengths} accessibilityRole="radiogroup" accessibilityLabel={t("practice.chip")}>
          {[false, true].map((on) => {
            const label = on ? `${t("practice.chip")} · ${avartaTotal}` : t("practice.all")
            const selected = avartaOn === on
            return (
              <KPress key={String(on)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label} onActivate={() => setAvartaView(on)} pressedScale={0.95} style={[styles.lengthChip, { backgroundColor: selected ? p.action : p.white, borderColor: selected ? p.action : p.sand300 }]}>
                <Text style={[styles.lengthText, { color: selected ? p.onAction : p.ink800 }]}>{label}</Text>
              </KPress>
            )
          })}
        </View>
      </Reveal>
    ) : null

  const renderAll = () =>
    subOn && kindList.length === 0 ? renderFilteredEmpty() : isEmptyCatalog(null, null, kindList.length) ? renderEmptyCatalog() : (
    <>
      {nowStrip()}
      {titleBlock()}
      {subFilters()}
      {practiceChoice()}

      {day ? (
        <Reveal index={next()}>
          <DayCard kirtan={day} onPlay={() => play(day, kindList)} />
        </Reveal>
      ) : null}

      {jump.length ? (
        <Reveal index={next()} style={styles.section}>
          <HomeSectionHead p={p} eyebrow={t("kt.jump.eyebrow")} first={t("kt.jump.first")} second={t("kt.jump.second")} />
          <View style={styles.list}>
            {jump.map(({ kirtan, positionSec }) => (
              <KirtanRow
                key={kirtan.id}
                theme={theme}
                kirtan={kirtan}
                compact
                onOpen={(k) => play(k, kindList)}
                onMore={setMenu}
                footer={
                  <View style={styles.resume}>
                    <Text style={[styles.resumeText, { color: theme.accent }]} numberOfLines={2}>
                      {resumeLabel(positionSec, kirtan.durationSec)}
                    </Text>
                    <View style={[styles.bar, { backgroundColor: theme.line }]}>
                      <View style={[styles.barFill, { width: `${Math.round(resumeProgress(positionSec, kirtan.durationSec) * 100)}%`, backgroundColor: theme.brand }]} />
                    </View>
                  </View>
                }
              />
            ))}
          </View>
        </Reveal>
      ) : null}

      {kind === "all" ? (
        <Reveal index={next()} style={styles.section}>
          <HomeSectionHead p={p} eyebrow={t("kh.cat.eyebrow")} first={t("kh.cat.first")} second={t("kh.cat.second")} />
          <KindCards p={p} cards={cards} onOpen={(k) => router.push(href(kiirtanListHref({ mode: "category", kind: k })))} />
        </Reveal>
      ) : null}

      {liveBroadcasts.length ? (
        <Reveal index={next()} style={styles.section}>
          <BroadcastsShelf p={p} items={liveBroadcasts} />
        </Reveal>
      ) : null}

      {kind === "bhajan" ? hourShelf() : null}

      <Reveal index={next()} style={styles.section}>
        <HomeSectionHead p={p} eyebrow={t("kt.length.eyebrow")} first={t("kt.length.first")} second={t("kt.length.second")} />
        <View style={styles.lengths}>
          {LENGTH_BUCKETS.map((b) => {
            const on = length === b.id
            return (
              <KPress
                key={b.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={b.label}
                onActivate={() => setLength((cur) => (cur === b.id ? null : b.id))}
                pressedScale={0.95}
                style={[styles.lengthChip, { backgroundColor: on ? p.action : p.white, borderColor: on ? p.action : p.sand300 }]}
              >
                <Text style={[styles.lengthText, { color: on ? p.onAction : p.ink800 }]}>{b.label}</Text>
              </KPress>
            )
          })}
        </View>
      </Reveal>

      <Reveal index={next()} style={styles.section}>
        <AuthorsShelf p={p} kind={kind === "all" || kind === "baba_audio" ? undefined : kind} />
      </Reveal>

      {pianoList.length ? (
        <Reveal index={next()} style={styles.section}>
          <HomeSectionHead
            p={p}
            eyebrow={t("kt.piano.eyebrow")}
            first={kindLabelPlural("kiirtan")}
            second={t("kt.piano.second")}
            action={{ label: t("kt.piano.all"), onPress: () => router.push(href(`/browse-shelf?id=${encodeURIComponent("kiirtan:piano")}`)) }}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
            {pianoList.slice(0, 12).map((k) => (
              <LongCard key={k.id} kirtan={k} onPress={() => play(k, pianoList, t("searchMenu.kiirtan.piano"))} />
            ))}
          </ScrollView>
        </Reveal>
      ) : null}

      {kind === "all" && bhajanDay ? (
        <Reveal index={next()}>
          <DayCard kirtan={bhajanDay} onPlay={() => play(bhajanDay, filterByKind(playable, "bhajan"))} />
        </Reveal>
      ) : null}

      {kind === "all" ? hourShelf() : null}

      <Reveal index={next()} style={styles.section}>
        <HomeSectionHead
          p={p}
          eyebrow={(length ? LENGTH_BUCKETS.find((b) => b.id === length)?.label : null) || t("kt.new.eyebrow")}
          first={t("kt.new.first")}
          second={kind === "all" ? t("kt.new.recordings") : kindLabelPlural(kind).toLowerCase()}
          action={{ label: t("kt.shuffleAll"), onPress: () => actions.flash(playEverything() ?? "") }}
        />
        <View style={styles.list}>
          {list.length ? (
            list.map((k) => <KirtanRow key={k.id} theme={theme} kirtan={k} compact onOpen={(row) => play(row, list)} onMore={setMenu} onOpenArtist={actions.openArtist} />)
          ) : (
            <HomeEmpty p={p} text={emptyListText(null, length, kind)} />
          )}
        </View>
      </Reveal>

      {longList.length || (showKiirtan && live.items.length) ? (
        <Reveal index={next()} style={styles.section}>
          <HomeSectionHead p={p} eyebrow={t("kt.long.eyebrow")} first={t("kt.long.first")} second={kindLabelPlural(kind === "all" ? "kiirtan" : kind).toLowerCase()} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
            {(showKiirtan ? live.items : []).map((item) => (
              <LiveCard
                key={item.id}
                item={item}
                now={live.now}
                theme={theme}
                onOpen={(i) => router.push(href(`/kiirtan-live?id=${encodeURIComponent(i.id)}`))}
              />
            ))}
            {longList.map((k) => (
              <LongCard key={k.id} kirtan={k} onPress={() => play(k, longList, t("kt.ctx.long"))} />
            ))}
          </ScrollView>
        </Reveal>
      ) : null}

      {mineTiles()}
    </>
  )

  /** "Bhajans for every hour": one card per Bhajan, ordered Morning, Evening, Devotional, Other. Same card as the long Kiirtans. */
  function hourShelf() {
    if (!hourly.length) return null
    return (
      <Reveal index={next()} style={styles.section}>
        <HomeSectionHead p={p} eyebrow={t("kt.hour.eyebrow")} first={kindLabelPlural("bhajan")} second={t("kt.hour.second")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
          {hourly.map((k) => (
            <LongCard key={k.id} kirtan={k} caption={kirtanTypeLabel(k.type, k.kind)} onPress={() => play(k, hourly)} />
          ))}
        </ScrollView>
      </Reveal>
    )
  }

  const addEntry = () => (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={t("kt.add.a11y")}
      onPress={() => router.push(href(addHref))}
      pressedScale={0.98}
      style={[styles.addCard, { borderColor: theme.accent }]}
    >
      <View style={[styles.addDisc, { backgroundColor: theme.peach }]}>
        <Plus size={22} color={theme.accent} strokeWidth={2.2} />
      </View>
      <View style={styles.addText}>
        <Text style={[styles.addTitle, { color: theme.textHeading }]}>{t("kt.add.title")}</Text>
        <Text style={[styles.addSub, { color: theme.textBody }]}>{t("kt.add.sub")}</Text>
      </View>
    </KPress>
  )

  if (listAddress) return <Redirect href={href(listAddress)} />

  return (
    <View style={[styles.root, { backgroundColor: p.sand200 }]}>
      <Animated.ScrollView
        style={styles.root}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      >
        <StickyTopBlock inset={top} rowHeight={TOP_ROW} page={p.sand200} wash={p.dark ? ["rgba(74, 46, 28, 0.6)", "rgba(74, 46, 28, 0)"] : [p.orange100, "rgba(255, 220, 197, 0)"]} scrollY={scrollY}>
        <View style={styles.topRow}>
          <TodayPress
            accessibilityRole="button"
            accessibilityLabel={t("today.profileA11y")}
            onPress={() => router.push(href("/profile-sheet"))}
            pressedScale={0.97}
            style={[styles.avatar, { backgroundColor: p.dark ? p.orange100 : p.white }]}
          >
            <AvatarFace initial={initial} textStyle={[styles.avatarText, { color: p.orange700 }]} />
          </TodayPress>
          <View style={styles.spacer} />
          <TodayPress accessibilityRole="search" accessibilityLabel={t("home.search")} onPress={() => router.push(href("/search-v2?focus=1&scope=kiirtan"))} pressedScale={0.97} style={[styles.round, { backgroundColor: p.white, borderColor: p.sand300 }]}>
            <Search size={20} color={p.ink800} strokeWidth={1.9} />
          </TodayPress>
          <NotificationBell p={p} unread={unreadNotes > 0} onPress={() => router.push(href("/notifications"))} />
        </View>
        <StickyChipsRow items={KIRTAN_TAB_CHIPS} value={chip} onChange={setChip} colors={chipColors} scrollY={scrollY} stickAt={0} />
        </StickyTopBlock>
        <View style={styles.shelves}>{renderAll()}</View>
      </Animated.ScrollView>

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

  /** "Kiirtan of the day" / "Bhajan of the day" and so on: the cover fills the card; eyebrow and title in capitals; a round orange play button. */
  function DayCard({ kirtan, onPlay }: { kirtan: Kirtan; onPlay: () => void }) {
    return (
      <KPress
        accessibilityRole="button"
        accessibilityLabel={kindDayA11y(kirtan.kind, kirtan.title)}
        onPress={onPlay}
        pressedScale={0.985}
        outerStyle={styles.dayOuter}
        style={styles.day}
      >
        <KiirtanCover type={kirtan.type} kind={kirtan.kind} coverUrl={kirtan.thumbnailUrl} width="100%" height={220} radius={30} glyph={96} photoSeed={recordingSeed(kirtan)} title={kirtan.title} durationSec={kirtan.durationSec} />
        <LinearGradient pointerEvents="none" colors={["rgba(10,14,8,0)", "rgba(10,14,8,0.62)"]} style={[StyleSheet.absoluteFill, styles.dayShade]} />
        <View style={styles.dayText} pointerEvents="none">
          <Text style={styles.dayEyebrow}>{kindDayLabel(kirtan.kind)}</Text>
          <Text style={styles.dayTitle} numberOfLines={3}>
            {kirtan.title}
          </Text>
          <Text style={styles.daySub} numberOfLines={1}>
            {kirtan.author.trim() ? kirtan.author : kirtan.addedBy}
            {kirtan.durationSec ? ` · ${formatKirtanLength(kirtan.durationSec)}` : ""}
          </Text>
        </View>
        <View style={[styles.dayPlay, { backgroundColor: p.action }]} pointerEvents="none">
          <PlayFilled size={26} color={p.onAction} />
        </View>
      </KPress>
    )
  }
}

/** A card of the "Live and long kiirtans" and "Bhajans for every hour" shelves: the cover with its length, then the title. */
function LongCard({ kirtan, onPress, caption }: { kirtan: Kirtan; onPress: () => void; caption?: string }) {
  const t = useT()
  const theme = useSongsTheme()
  return (
    <KPress accessibilityRole="button" accessibilityLabel={t("kt.card.a11y", { title: kirtan.title, length: formatKirtanLength(kirtan.durationSec ?? 0) })} onPress={onPress} pressedScale={0.97} style={styles.longCard}>
      <View>
        <KiirtanCover type={kirtan.type} kind={kirtan.kind} coverUrl={kirtan.thumbnailUrl} width={200} height={120} radius={22} photoSeed={recordingSeed(kirtan)} title={kirtan.title} durationSec={kirtan.durationSec} />
        <View style={styles.longLength}>
          <Text style={styles.longLengthText}>{formatKirtanLength(kirtan.durationSec ?? 0)}</Text>
        </View>
      </View>
      <View style={styles.longMeta}>
        <KirtanTag theme={theme} kind={kirtan.kind} />
        {caption ? <Text style={[styles.longCaption, { color: theme.textBody }]}>{caption}</Text> : null}
      </View>
      <Text style={[styles.longTitle, { color: theme.textHeading }]} numberOfLines={2}>
        {kirtan.title}
      </Text>
    </KPress>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 220 },
  topRow: { height: TOP_ROW, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: HOME_INSET - 4, paddingRight: HOME_INSET - 4, paddingTop: 6, paddingBottom: 10 },
  spacer: { flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: amFonts.display, fontSize: 18, lineHeight: 26 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  shelves: { paddingTop: 12, gap: SECTION_GAP },
  titleBlock: { paddingHorizontal: HOME_INSET },
  h1: { fontFamily: amFonts.display, fontSize: 44, lineHeight: 44, letterSpacing: -0.9, textTransform: "uppercase" },
  section: { gap: 16 },
  list: { paddingHorizontal: HOME_INSET, gap: 8 },
  shelf: { paddingHorizontal: HOME_INSET, gap: 12 },
  lengths: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: HOME_INSET },
  lengthChip: { height: 40, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1, justifyContent: "center" },
  lengthText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  resume: { gap: 6, paddingTop: 4, alignSelf: "stretch" },
  resumeText: { fontFamily: amFonts.semi, fontSize: 11.5, lineHeight: 15 },
  bar: { height: 4, borderRadius: 2, alignSelf: "stretch", overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },
  dayOuter: { marginHorizontal: HOME_INSET - 10 },
  day: { height: 220, borderRadius: 30, overflow: "hidden" },
  dayShade: { borderRadius: 30 },
  dayText: { position: "absolute", left: 18, right: 90, bottom: 16, gap: 4 },
  dayEyebrow: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, color: amColors.gold300 },
  dayTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 25, letterSpacing: -0.4, textTransform: "uppercase", color: "#FFFFFF" },
  daySub: { fontFamily: amFonts.medium, fontSize: 13.5, lineHeight: 18, color: "rgba(255,255,255,0.86)" },
  dayPlay: { position: "absolute", right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  longCard: { width: 200, gap: 6 },
  longLength: { position: "absolute", right: 8, bottom: 8, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: "rgba(10,14,8,0.62)", justifyContent: "center" },
  longLengthText: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 15, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  longMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  longCaption: { fontFamily: amFonts.medium, fontSize: 12.5, lineHeight: 17 },
  longTitle: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  addCard: { minHeight: 68, borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 10 },
  addDisc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  addText: { flex: 1, gap: 2 },
  addTitle: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  addSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
})
