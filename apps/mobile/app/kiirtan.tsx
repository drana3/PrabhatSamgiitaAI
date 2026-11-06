import { useCallback, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Plus, Search } from "lucide-react-native"
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated"

import { AvatarFace } from "@/components/profile-v2/AvatarFace"
import { HOME_INSET, HomeEmpty, HomeSectionHead } from "@/components/home/HomeBlocks"
import { LiveCard } from "@/components/kirtan/LiveCard"
import { ArtistChip } from "@/components/kirtan/ArtistParts"
import { KiirtanCover, WaveGlyph, kiirtanTone } from "@/components/kirtan/KiirtanCover"
import { KirtanMenuSheet, KirtanShareSheet } from "@/components/kirtan/KirtanMenus"
import { KirtanRow, KirtanTag, PlayFilled } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { RemovedCard, UploadRow } from "@/components/kirtan/MyUploads"
import { chipColorsOf, StickyChipsRow, StickyTopBlock } from "@/components/nav-v2/StickyChips"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { TodayPress } from "@/components/today/TodayPress"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, protoFor } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useDownloadedKirtans } from "@/hooks/useDownloadedKirtans"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtanLive } from "@/hooks/useKirtanLive"
import { useKirtans } from "@/hooks/useKirtans"
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { sampleArtists, sampleResume } from "@/lib/fixtures/kirtanGate"
import { artistsWithKirtans, kirtansOfArtist } from "@/lib/kirtan/artists"
import { filterByKind, kindLabel, kindLabelPlural } from "@/lib/kirtan/kind"
import { LENGTH_BUCKETS, longKirtans, type LengthBucketId } from "@/lib/kirtan/length"
import { formatKirtanLength } from "@/lib/kirtan/list"
import { playEverything } from "@/lib/kirtan/mixPlayback"
import { dayNumberOf, kiirtanOfTheDay, resumeEntries, resumeLabel, resumeProgress } from "@/lib/kirtan/resume"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import { bhajansForEveryHour, emptyCatalogText, emptyListText, isEmptyCatalog, isShelfChip, kindOfTabChip, KIRTAN_TAB_CHIPS, newKirtansList, parseKirtanTabChip, savedKirtans, typeCardCount, typeCards, type KirtanTabChip, type TypeCard as TypeCardData } from "@/lib/kirtan/tab"
import { kirtanTypeLabel, type Kirtan, type RecordingKind } from "@/lib/kirtan/types"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"
import { useLanguage, useT } from "@/lib/i18n"

/** Row 1 (avatar, search, add): height of the icon row inside the pinned block. */
const TOP_ROW = 60
const SECTION_GAP = 36
const TYPE_CARD = { w: 152, h: 112 }

/**
 * The Kiirtan tab (Kiirtans and Bhajans: two kinds of one recordings list). Row 1 (avatar, search, "+"
 * for Add) and the chips row (All, Kiirtan, Bhajan, Saved, Downloaded, My uploads) are ONE pinned header
 * block; the big heading scrolls away. The first three chips are the KIND filter and narrow every shelf
 * below: the heading, Kiirtan / Bhajan of the day, Jump back in, By type, Bhajans for every hour, By length,
 * Artists, New recordings and Long kiirtans. Every row plays in the one player (the pill appears by itself).
 * TODO(api): the catalog, the artists, the day's pick and the resume positions come from the backend.
 */
export default function KiirtanTabScreen() {
  const bottomInset = useScrollBottomInset()
  const t = useT()
  const router = useRouter()
  const am = useAmTheme()
  const p = protoFor(am)
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = insets.top || amProto.statusArea
  const initial = useProfileInitial()
  const params = useLocalSearchParams<{ filter?: string }>()
  const actions = useKirtanActions()
  const { playable, byId, submissions } = useKirtans()
  const savedIds = useKirtanStore((s) => s.savedIds)
  const live = useKirtanLive()

  const [chip, setChip] = useState<KirtanTabChip>(parseKirtanTabChip(params.filter))
  const [typePick, setTypePick] = useState<{ kind: RecordingKind; id: TypeCardData["id"] } | null>(null)
  const [length, setLength] = useState<LengthBucketId | null>(null)
  const [menu, setMenu] = useState<Kirtan | null>(null)
  const [share, setShare] = useState<Kirtan | null>(null)

  /** the kind filter of the first three chips; the list chips (Saved...) show both kinds */
  const kind = kindOfTabChip(chip)
  const shelves = isShelfChip(chip)
  const showKiirtan = kind !== "bhajan"
  const showBhajan = kind !== "kiirtan"
  // a chosen type card belongs to one kind; it only counts while that kind is shown
  const pick = typePick && (kind === "all" || typePick.kind === kind) ? typePick : null
  const type = pick?.id ?? null

  const now = useMemo(() => Date.now(), [])
  const dayN = useMemo(() => dayNumberOf(now), [now])
  const kindList = useMemo(() => filterByKind(playable, kind), [playable, kind])
  const day = useMemo(() => kiirtanOfTheDay(filterByKind(playable, showKiirtan ? "kiirtan" : "bhajan"), dayN), [playable, showKiirtan, dayN])
  const bhajanDay = useMemo(() => (kind === "all" ? kiirtanOfTheDay(filterByKind(playable, "bhajan"), dayN) : null), [playable, kind, dayN])
  const hourly = useMemo(() => bhajansForEveryHour(playable), [playable])
  const jump = useMemo(() => resumeEntries(sampleResume(), byId, 2).filter((e) => kind === "all" || e.kirtan.kind === kind), [byId, kind])
  const cards = useMemo(() => typeCards(playable, kind), [playable, kind, t])
  const artists = useMemo(() => artistsWithKirtans(sampleArtists(), kindList), [kindList])
  const list = useMemo(() => newKirtansList(playable, type, length, pick?.kind ?? kind), [playable, type, length, pick, kind])
  const longList = useMemo(() => longKirtans(kindList, 6), [kindList])
  const saved = useMemo(() => savedKirtans(savedIds, byId), [savedIds, byId])
  const downloadedKirtans = useDownloadedKirtans(playable)
  const typeLabel = pick ? (cards.find((c) => c.id === pick.id && c.kind === pick.kind)?.label ?? null) : null
  const headFirst = kindLabel(kind === "bhajan" ? "bhajan" : "kiirtan").toUpperCase()
  const headSecond = kind === "all" ? t("kt.head.all") : kind === "bhajan" ? t("kt.head.bhajan") : t("kt.head.kiirtan")

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
  let reveal = 0
  const next = () => Math.min(reveal++, 8)

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
      {titleBlock()}
      <Reveal index={next()} style={styles.section}>
        <HomeEmpty p={p} text={emptyCatalogText(kind)} />
        <View style={styles.list}>{addEntry()}</View>
      </Reveal>
    </>
  )

  const renderAll = () =>
    isEmptyCatalog(null, null, kindList.length) ? renderEmptyCatalog() : (
    <>
      {titleBlock()}

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

      <Reveal index={next()} style={styles.section}>
        <HomeSectionHead p={p} eyebrow={t(kind === "all" ? "kt.type.eyebrow.all" : kind === "bhajan" ? "kt.type.eyebrow.bhajan" : "kt.type.eyebrow.kiirtan")} first={t("kt.type.first")} second={t("kt.type.second")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
          {cards.map((card) => (
            <TypeCard
              key={`${card.kind}-${card.id}`}
              card={card}
              on={pick?.id === card.id && pick.kind === card.kind}
              onPress={() => setTypePick((cur) => (cur?.id === card.id && cur.kind === card.kind ? null : { kind: card.kind, id: card.id }))}
            />
          ))}
        </ScrollView>
      </Reveal>

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

      {artists.length ? (
        <Reveal index={next()} style={styles.section}>
          <HomeSectionHead p={p} eyebrow={t("kt.artists.eyebrow")} first={t("kt.artists.first")} second={t("kt.artists.second")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.artists}>
            {artists.map((a) => (
              <ArtistChip key={a.id} artist={a} color={p.ink800} onPress={actions.openArtist} />
            ))}
          </ScrollView>
        </Reveal>
      ) : null}

      <Reveal index={next()} style={styles.section}>
        <KPress
          accessibilityRole="button"
          accessibilityLabel={t("mantra.entry.a11y")}
          onPress={() => router.push(href("/kirtan-mantra"))}
          pressedScale={0.98}
          style={[styles.addCard, { borderColor: theme.line }]}
        >
          <View style={styles.addText}>
            <Text style={[styles.addTitle, { color: theme.textHeading }]}>{t("mantra.entry.title")}</Text>
            <Text style={[styles.addSub, { color: theme.textBody }]}>{t("mantra.entry.sub")}</Text>
          </View>
        </KPress>
      </Reveal>

      {kind === "all" && bhajanDay ? (
        <Reveal index={next()}>
          <DayCard kirtan={bhajanDay} onPlay={() => play(bhajanDay, filterByKind(playable, "bhajan"))} />
        </Reveal>
      ) : null}

      {kind === "all" ? hourShelf() : null}

      <Reveal index={next()} style={styles.section}>
        <HomeSectionHead
          p={p}
          eyebrow={[typeLabel, length ? LENGTH_BUCKETS.find((b) => b.id === length)?.label : null].filter(Boolean).join(" · ") || t("kt.new.eyebrow")}
          first={t("kt.new.first")}
          second={kind === "all" ? t("kt.new.recordings") : kindLabelPlural(kind).toLowerCase()}
          action={{ label: t("kt.shuffleAll"), onPress: () => actions.flash(playEverything() ?? "") }}
        />
        <View style={styles.list}>
          {list.length ? (
            list.map((k) => <KirtanRow key={k.id} theme={theme} kirtan={k} compact onOpen={(row) => play(row, list, typeLabel)} onMore={setMenu} onOpenArtist={actions.openArtist} />)
          ) : (
            <HomeEmpty p={p} text={emptyListText(type, length, pick?.kind ?? kind)} />
          )}
        </View>
      </Reveal>

      {longList.length || (showKiirtan && live.items.length) ? (
        <Reveal index={next()} style={styles.section}>
          <HomeSectionHead p={p} eyebrow={t("kt.long.eyebrow")} first={t("kt.long.first")} second={kindLabelPlural(kind === "bhajan" ? "bhajan" : "kiirtan").toLowerCase()} />
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

  const renderSaved = () => (
    <View style={styles.list}>
      {saved.length ? (
        saved.map((k) => <KirtanRow key={k.id} theme={theme} kirtan={k} compact onOpen={(row) => play(row, saved, t("kt.chip.saved"))} onMore={setMenu} onOpenArtist={actions.openArtist} />)
      ) : (
        <HomeEmpty p={p} text={t("kt.empty.saved")} />
      )}
    </View>
  )

  const renderDownloaded = () => (
    <View style={styles.list}>
      {downloadedKirtans.length ? (
        downloadedKirtans.map((k) => (
          <KirtanRow key={k.id} theme={theme} kirtan={k} compact onOpen={(row) => play(row, downloadedKirtans, t("kt.chip.downloaded"))} onMore={setMenu} onOpenArtist={actions.openArtist} />
        ))
      ) : (
        <HomeEmpty p={p} text={t("kt.empty.downloaded")} />
      )}
    </View>
  )

  const addEntry = () => (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={t("kt.add.a11y")}
      onPress={() => router.push(href("/add-kirtan"))}
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

  const renderMine = () => (
    <View style={styles.list}>
      {addEntry()}
      {submissions.length ? (
        submissions.map((k) =>
          k.status === "removed" ? (
            <RemovedCard key={k.id} theme={theme} kirtan={k} onOpenOriginal={openOriginal} />
          ) : (
            <UploadRow key={k.id} theme={theme} kirtan={k} onOpen={(row) => play(row, playable)} onMore={setMenu} onOpenArtist={actions.openArtist} />
          ),
        )
      ) : (
        <HomeEmpty p={p} text={t("kt.empty.mine")} />
      )}
    </View>
  )

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
          <TodayPress accessibilityRole="button" accessibilityLabel={t("kt.add.title")} onPress={() => router.push(href("/add-kirtan"))} pressedScale={0.97} style={[styles.round, { backgroundColor: p.action, borderColor: p.action }]}>
            <Plus size={22} color={p.onAction} strokeWidth={2.2} />
          </TodayPress>
        </View>
        <StickyChipsRow items={KIRTAN_TAB_CHIPS} value={chip} onChange={setChip} colors={chipColors} scrollY={scrollY} stickAt={0} />
        </StickyTopBlock>
        <View style={styles.shelves}>{shelves ? renderAll() : chip === "saved" ? renderSaved() : chip === "downloaded" ? renderDownloaded() : renderMine()}</View>
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

  /** "Kiirtan of the day" / "Bhajan of the day": the cover fills the card; eyebrow and title in capitals; a round orange play button. */
  function DayCard({ kirtan, onPlay }: { kirtan: Kirtan; onPlay: () => void }) {
    return (
      <KPress
        accessibilityRole="button"
        accessibilityLabel={t(kirtan.kind === "bhajan" ? "kt.day.a11y.bhajan" : "kt.day.a11y.kiirtan", { title: kirtan.title })}
        onPress={onPlay}
        pressedScale={0.985}
        outerStyle={styles.dayOuter}
        style={styles.day}
      >
        <KiirtanCover type={kirtan.type} kind={kirtan.kind} coverUrl={kirtan.thumbnailUrl} width="100%" height={220} radius={30} glyph={96} photoSeed={kirtan.id} title={kirtan.title} durationSec={kirtan.durationSec} />
        <LinearGradient pointerEvents="none" colors={["rgba(10,14,8,0)", "rgba(10,14,8,0.62)"]} style={[StyleSheet.absoluteFill, styles.dayShade]} />
        <View style={styles.dayText} pointerEvents="none">
          <Text style={styles.dayEyebrow}>{t(kirtan.kind === "bhajan" ? "kt.day.bhajan" : "kt.day.kiirtan")}</Text>
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

/** A coloured card of the "By type" shelf. The chosen one carries a ring and narrows the list. */
function TypeCard({ card, on, onPress }: { card: TypeCardData; on: boolean; onPress: () => void }) {
  useLanguage() // re-render when the language changes: the labels come from lib/kirtan
  const [from, to] = kiirtanTone(card.id, card.kind)
  return (
    <KPress
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${card.label}, ${typeCardCount(card)}`}
      onPress={onPress}
      pressedScale={0.96}
      style={[styles.typeCard, { borderColor: on ? "#1E1E1E" : "transparent" }]}
    >
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.typeGlyph}>
        <WaveGlyph size={28} color="rgba(255,255,255,0.9)" />
      </View>
      <View>
        <Text style={styles.typeLabel} numberOfLines={2}>
          {card.label}
        </Text>
        <Text style={styles.typeCount}>{typeCardCount(card)}</Text>
      </View>
    </KPress>
  )
}

/** A card of the "Live and long kiirtans" and "Bhajans for every hour" shelves: the cover with its length, then the title. */
function LongCard({ kirtan, onPress, caption }: { kirtan: Kirtan; onPress: () => void; caption?: string }) {
  const t = useT()
  const theme = useSongsTheme()
  return (
    <KPress accessibilityRole="button" accessibilityLabel={t("kt.card.a11y", { title: kirtan.title, length: formatKirtanLength(kirtan.durationSec ?? 0) })} onPress={onPress} pressedScale={0.97} style={styles.longCard}>
      <View>
        <KiirtanCover type={kirtan.type} kind={kirtan.kind} coverUrl={kirtan.thumbnailUrl} width={200} height={120} radius={22} photoSeed={kirtan.id} title={kirtan.title} durationSec={kirtan.durationSec} />
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
  artists: { paddingHorizontal: HOME_INSET, gap: 8 },
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
  typeCard: { width: TYPE_CARD.w, height: TYPE_CARD.h, borderRadius: 24, borderWidth: 2, overflow: "hidden", padding: 14, justifyContent: "space-between" },
  typeGlyph: { alignItems: "flex-start" },
  typeLabel: { fontFamily: amFonts.display, fontSize: 16, lineHeight: 17, textTransform: "uppercase", letterSpacing: -0.2, color: "#FFFFFF" },
  typeCount: { fontFamily: amFonts.medium, fontSize: 12.5, lineHeight: 16, color: "rgba(255,255,255,0.82)", marginTop: 2 },
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
