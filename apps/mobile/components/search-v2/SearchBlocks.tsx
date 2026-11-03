import { StyleSheet, Text, View } from "react-native"
import { ChevronRight, Clock, X } from "lucide-react-native"

import { PressScale } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"
import type {
  AnswerCard as AnswerCardData,
  CollectionHit,
  SearchGroup,
  SearchResultItem,
} from "@/lib/unifiedSearch"
import {
  EMPTY_SENTENCE,
  FEELINGS,
  reasonLabel,
  SEARCH_EXAMPLES,
} from "@/lib/unifiedSearchQuery"

type ThemeProps = { theme: AmTheme }

/** The line under the field. */
export function HintLine({ theme, text }: ThemeProps & { text: string }) {
  return (
    <Text style={[amType.body, styles.hint, { color: theme.textBody }]} accessibilityLiveRegion="polite">
      {text}
    </Text>
  )
}

function Chip({
  theme,
  label,
  onPress,
  accessibilityLabel,
}: ThemeProps & { label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      pressedScale={0.94}
      style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Text style={[styles.chipText, { color: theme.textHeading }]}>{label}</Text>
    </PressScale>
  )
}

/**
 * Empty field (spec SCR-13): one sentence, three examples that fill the field,
 * the feelings as a cloud of chips, then recent searches.
 */
export function EmptyState({
  theme,
  recents,
  onPick,
  onRemoveRecent,
  onClearRecents,
  onBrowseCollections,
}: ThemeProps & {
  recents: string[]
  onPick: (query: string) => void
  onRemoveRecent: (query: string) => void
  onClearRecents: () => void
  onBrowseCollections: () => void
}) {
  return (
    <View style={styles.section}>
      <Text style={[amType.lead, { color: theme.textHeading }]}>{EMPTY_SENTENCE}</Text>

      <View style={styles.block}>
        <Text style={[amType.label, { color: theme.eyebrow }]}>Try</Text>
        <View style={styles.cloud}>
          {SEARCH_EXAMPLES.map((example) => (
            <Chip key={example} theme={theme} label={example} onPress={() => onPick(example)} />
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={[amType.label, { color: theme.eyebrow }]}>How you feel</Text>
        <View style={styles.cloud}>
          {FEELINGS.map((feeling) => (
            <Chip
              key={feeling.label}
              theme={theme}
              label={feeling.label}
              accessibilityLabel={`Feeling: ${feeling.label}`}
              onPress={() => onPick(feeling.label)}
            />
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.rowBetween}>
          <Text style={[amType.label, { color: theme.eyebrow }]}>Recent searches</Text>
          {recents.length ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Clear recent searches"
              onPress={onClearRecents}
              pressedScale={0.94}
              style={styles.textButton}
            >
              <Text style={[amType.label, { color: theme.textBody }]}>Clear</Text>
            </PressScale>
          ) : null}
        </View>
        {recents.length === 0 ? (
          <Text style={[amType.body, { color: theme.textBody }]}>Searches you run will appear here.</Text>
        ) : (
          recents.map((item) => (
            <View key={item} style={[styles.recentRow, { borderBottomColor: theme.line }]}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`Search ${item}`}
                onPress={() => onPick(item)}
                pressedScale={0.985}
                style={styles.recentMain}
              >
                <Clock size={16} color={theme.textMuted} />
                <Text style={[amType.body, { color: theme.textHeading, flex: 1 }]} numberOfLines={1}>
                  {item}
                </Text>
              </PressScale>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item}`}
                onPress={() => onRemoveRecent(item)}
                pressedScale={0.88}
                style={styles.iconButton}
              >
                <X size={16} color={theme.textMuted} />
              </PressScale>
            </View>
          ))
        )}
      </View>

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Browse all collections"
        onPress={onBrowseCollections}
        pressedScale={0.985}
        style={[styles.findRow, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <Text style={[styles.rowTitle, { color: theme.textHeading, flex: 1 }]}>Browse all collections</Text>
        <ChevronRight size={20} color={theme.textMuted} />
      </PressScale>
    </View>
  )
}

/** One result: PS number, title, the line that matched, and the reason it matched. */
export function ResultRow({
  theme,
  item,
  onOpen,
}: ThemeProps & { item: SearchResultItem; onOpen: (item: SearchResultItem) => void }) {
  const tag = reasonLabel(item.reason)
  const showLine = item.line.trim().length > 0 && item.line.trim().toLowerCase() !== item.song.title.trim().toLowerCase()
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`PS ${item.song.number}, ${item.song.title}. ${tag}`}
      onPress={() => onOpen(item)}
      pressedScale={0.985}
      style={[styles.findRow, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.cardCopy}>
        <View style={styles.rowBetween}>
          <Text style={[amType.label, { color: theme.eyebrow }]}>PS {item.song.number}</Text>
          <View style={[styles.tag, { backgroundColor: theme.inner }]}>
            <Text style={[styles.tagText, { color: theme.eyebrow }]}>{tag}</Text>
          </View>
        </View>
        <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
          {item.song.title}
        </Text>
        {showLine ? (
          <Text style={[amType.body, { color: theme.textBody }]} numberOfLines={2}>
            {item.line}
          </Text>
        ) : null}
      </View>
    </PressScale>
  )
}

function CollectionNames({
  theme,
  names,
  onPick,
}: ThemeProps & { names: CollectionHit[]; onPick: (label: string) => void }) {
  return (
    <View style={styles.cloud}>
      {names.map((hit) => (
        <Chip
          key={hit.label}
          theme={theme}
          label={`${hit.label} · ${hit.count}`}
          accessibilityLabel={`Collection ${hit.label}, ${hit.count} songs`}
          onPress={() => onPick(hit.label)}
        />
      ))}
    </View>
  )
}

/** A group of results in the spec's order, with an eyebrow heading and a count. */
export function ResultGroup({
  theme,
  group,
  onOpen,
  onPickCollection,
}: ThemeProps & {
  group: SearchGroup
  onOpen: (item: SearchResultItem) => void
  onPickCollection: (label: string) => void
}) {
  const count = group.items.length
  return (
    <View style={styles.group}>
      <Text style={[amType.label, { color: theme.eyebrow }]} accessibilityRole="header">
        {group.title}
        {count ? ` · ${count}` : ""}
      </Text>
      {group.collections?.length ? (
        <CollectionNames theme={theme} names={group.collections} onPick={onPickCollection} />
      ) : null}
      <View style={styles.stack}>
        {group.items.map((item) => (
          <ResultRow key={`${group.id}-${item.song.number}`} theme={theme} item={item} onOpen={onOpen} />
        ))}
      </View>
    </View>
  )
}

/**
 * Answer card for questions (spec SCR-13). It names the songs that fit and links
 * to the assistant. The forest ground matches the Player and quiz card.
 */
export function AnswerCard({
  theme,
  answer,
  onOpen,
  onAsk,
}: ThemeProps & {
  answer: AnswerCardData
  onOpen: (item: SearchResultItem) => void
  onAsk: () => void
}) {
  return (
    <View style={[styles.answer, { backgroundColor: theme.forest }]}>
      <Text style={[amType.label, { color: amColors.gold300 }]}>Answer</Text>
      <Text style={[amType.lead, { color: amColors.white }]}>
        {answer.sources.length
          ? "These songs speak to what you asked."
          : "Ask the assistant. It answers from the songs."}
      </Text>
      {answer.sources.map((item) => (
        <PressScale
          key={item.song.number}
          accessibilityRole="button"
          accessibilityLabel={`PS ${item.song.number}, ${item.song.title}`}
          onPress={() => onOpen(item)}
          pressedScale={0.985}
          style={styles.sourceRow}
        >
          <Text style={[amType.label, { color: amColors.gold300 }]}>PS {item.song.number}</Text>
          <Text style={[styles.sourceTitle, { color: amColors.white }]} numberOfLines={2}>
            {item.song.title}
          </Text>
        </PressScale>
      ))}
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Ask the assistant"
        onPress={onAsk}
        pressedScale={0.97}
        style={[styles.askButton, { backgroundColor: theme.brand }]}
      >
        <Text style={[styles.askText, { color: theme.onBrand }]}>Ask the assistant</Text>
      </PressScale>
    </View>
  )
}

export function Message({ theme, text }: ThemeProps & { text: string }) {
  return <Text style={[amType.body, { color: theme.textBody }]}>{text}</Text>
}

const styles = StyleSheet.create({
  hint: { paddingHorizontal: amSpace.s4 + amSpace.s1 },
  section: { gap: amGap.block + amSpace.s4 },
  block: { gap: amGap.text },
  cloud: { flexDirection: "row", flexWrap: "wrap", gap: amSpace.s2 },
  chip: {
    minHeight: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: amSpace.s4,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: amFonts.medium, fontSize: amFontSize.body },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: amSpace.s2 },
  textButton: {
    minHeight: amTouchTarget,
    paddingHorizontal: amSpace.s2,
    alignItems: "center",
    justifyContent: "center",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentMain: {
    flex: 1,
    minHeight: amTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
  },
  iconButton: {
    width: amTouchTarget,
    height: amTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  group: { gap: amGap.text },
  stack: { gap: amGap.grid },
  findRow: {
    minHeight: amSpace.s16,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    paddingVertical: amSpace.s3,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
  },
  cardCopy: { flex: 1, gap: amSpace.s2 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: amFontSize.lead, lineHeight: 24 },
  tag: { borderRadius: amRadius.pill, paddingHorizontal: amSpace.s2 + amSpace.s1, paddingVertical: amSpace.s1 },
  tagText: { fontFamily: amFonts.semi, fontSize: amFontSize.label, lineHeight: 16 },
  answer: { borderRadius: amRadius.panel, padding: amGap.padPanel, gap: amGap.text },
  sourceRow: { minHeight: amTouchTarget, justifyContent: "center", gap: amSpace.s1 },
  sourceTitle: { fontFamily: amFonts.semi, fontSize: amFontSize.lead, lineHeight: 24 },
  askButton: {
    height: amTouchTarget + amSpace.s1,
    borderRadius: amRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: amSpace.s6,
  },
  askText: { fontFamily: amFonts.semi, fontSize: amFontSize.body },
})
