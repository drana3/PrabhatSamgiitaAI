import type { ReactNode } from "react"
import { StyleSheet, Text, View, type DimensionValue } from "react-native"
import Svg, { Path } from "react-native-svg"

import { KiirtanCover } from "@/components/kirtan/KiirtanCover"
import { KPress } from "@/components/kirtan/KPress"
import { sampleArtists } from "@/lib/fixtures/kirtanGate"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { KiirtanDownloadedBadge } from "@/components/offline/DownloadedBadge"
import { amFonts } from "@/constants/tokens/amTypography"
import { artistForAuthor } from "@/lib/kirtan/artists"
import { kindTag } from "@/lib/kirtan/kind"
import { kirtanRowLabel, kirtanSubline } from "@/lib/kirtan/list"
import { STATUS_LABEL, type Kirtan, type KirtanStatus, type RecordingKind } from "@/lib/kirtan/types"
import { useT } from "@/lib/i18n"

/* ------------------------------------------------------------------ glyphs */

type G = { size?: number; color: string; strokeWidth?: number }
function Stroke({ d, size = 22, color, strokeWidth = 1.75 }: G & { d: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
export const MoreGlyph = ({ size = 22, color }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M5 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm7 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm7 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill={color} />
  </Svg>
)
export const PlusGlyph = (p: G) => <Stroke size={20} {...p} d="M12 5v14M5 12h14" />
export const ChevronGlyph = (p: G) => <Stroke size={20} {...p} d="M9 5l7 7-7 7" />
export const PlayFilled = ({ size = 18, color }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M8 5l11 7-11 7z" fill={color} />
  </Svg>
)

/* ------------------------------------------------------------------ labels */

/** Small outlined neutral label: KIIRTAN or BHAJAN (orange is for actions, not for labels). */
export function KirtanTag({ theme, color, kind }: { theme: SongsTheme; color?: string; kind?: RecordingKind | null }) {
  const tone = color ?? theme.textBody
  return (
    <View style={[styles.tag, { borderColor: tone }]}>
      <Text style={[styles.tagText, { color: tone }]}>{kindTag(kind)}</Text>
    </View>
  )
}

/** Muted label of a Prabhat Samgiita song among kirtans: `PS 3`. */
export function PsTag({ theme, number }: { theme: SongsTheme; number: number }) {
  return (
    <View style={[styles.tag, { borderColor: theme.line, backgroundColor: theme.inner }]}>
      <Text style={[styles.tagText, { color: theme.textBody }]}>PS {number}</Text>
    </View>
  )
}

/** Where one of the person's own recordings stands: Uploading, Published, Not uploaded or Removed. */
export function StatusBadge({ theme, status }: { theme: SongsTheme; status: KirtanStatus }) {
  const tone =
    status === "published"
      ? { bg: theme.oliveBg, fg: theme.oliveText }
      : status === "removed" || status === "failed"
        ? { bg: "transparent", fg: theme.dangerText }
        : { bg: theme.peach, fg: theme.accent }
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: status === "removed" || status === "failed" ? amColors.danger : "transparent" }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  )
}

/* ---------------------------------------------------------------- thumbnail */

/** The author's cover when there is one, the gradient of the recording's type (and kind) otherwise. */
export function KirtanThumb({
  kirtan,
  width,
  height,
  aspectRatio,
  radius,
}: {
  kirtan: Pick<Kirtan, "id" | "type" | "thumbnailUrl" | "title" | "durationSec"> & { kind?: RecordingKind }
  width: DimensionValue
  /** give a height or an aspect ratio */
  height?: number
  aspectRatio?: number
  radius: number
}) {
  return (
    <KiirtanCover
      type={kirtan.type}
      kind={kirtan.kind}
      coverUrl={kirtan.thumbnailUrl}
      width={width}
      height={height}
      aspectRatio={aspectRatio}
      radius={radius}
      photoSeed={kirtan.id}
      title={kirtan.title}
      durationSec={kirtan.durationSec}
    />
  )
}

/* --------------------------------------------------------------------- rows */

/**
 * A Kiirtan or Bhajan: thumbnail, title, the `KIIRTAN` / `BHAJAN` tag with length and who added it, and the more button.
 * `compact` is the 36px thumbnail of the Kiirtan tab list. With `onOpenArtist`, the artist's name sits
 * on its own line under the title and opens the artist page.
 */
export function KirtanRow({
  theme,
  kirtan,
  onOpen,
  onMore,
  onOpenArtist,
  trailing,
  footer,
  compact,
}: {
  theme: SongsTheme
  kirtan: Kirtan
  onOpen: (k: Kirtan) => void
  onMore?: (k: Kirtan) => void
  /** gets the artist id when the artist name is tapped */
  onOpenArtist?: (artistId: string) => void
  trailing?: ReactNode
  /** under the title and the line below it, across the whole text column (for example a resume position) */
  footer?: ReactNode
  compact?: boolean
}) {
  const t = useT()
  const thumb = compact ? 36 : 60
  return (
    <View style={[styles.row, compact && styles.rowCompact, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <KPress
        accessibilityRole="button"
        accessibilityLabel={kirtanRowLabel(kirtan)}
        onPress={() => onOpen(kirtan)}
        onLongPress={onMore ? () => onMore(kirtan) : undefined}
        delayLongPress={350}
        pressedScale={0.985}
        outerStyle={styles.rowMainOuter}
        style={[styles.rowMain, compact && styles.rowMainCompact]}
      >
        <KirtanThumb kirtan={kirtan} width={thumb} height={thumb} radius={compact ? 10 : 14} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={compact ? 1 : 2}>
            {kirtan.title}
          </Text>
          <View style={styles.subRow}>
            <KirtanTag theme={theme} kind={kirtan.kind} />
            <KiirtanDownloadedBadge kirtan={kirtan} />
            {onOpenArtist ? <ArtistLink theme={theme} author={kirtan.author} onOpenArtist={onOpenArtist} /> : null}
            <Text style={[styles.subText, { color: theme.textBody }]} numberOfLines={1}>
              {onOpenArtist && kirtan.author.trim() ? `· ${kirtanSubline(kirtan)}` : kirtanSubline(kirtan)}
            </Text>
          </View>
          {footer}
        </View>
      </KPress>
      {trailing ??
        (onMore ? (
          <KPress accessibilityRole="button" accessibilityLabel={t("kt.moreFor", { title: kirtan.title })} onPress={() => onMore(kirtan)} pressedScale={0.88} style={styles.more}>
            <MoreGlyph color={theme.textBody} />
          </KPress>
        ) : null)}
    </View>
  )
}

/** The artist name of a Kiirtan: tappable (opens the artist page) when it is a known artist, plain text otherwise. */
export function ArtistLink({ theme, author, onOpenArtist }: { theme: SongsTheme; author: string; onOpenArtist?: (artistId: string) => void }) {
  const t = useT()
  const artist = artistForAuthor(sampleArtists(), author)
  if (!author.trim()) return null
  if (!artist || !onOpenArtist) {
    return (
      <Text style={[styles.subText, { color: theme.textBody }]} numberOfLines={1}>
        {author}
      </Text>
    )
  }
  return (
    <KPress accessibilityRole="link" accessibilityLabel={t("kt.artistA11y", { name: artist.name })} onPress={() => onOpenArtist(artist.id)} pressedScale={0.96} hitSlop={8}>
      <Text style={[styles.artistLink, { color: theme.textHeading }]} numberOfLines={1}>
        {artist.name}
      </Text>
    </KPress>
  )
}

const styles = StyleSheet.create({
  tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, height: 18, alignItems: "center", justifyContent: "center" },
  tagText: { fontFamily: amFonts.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.8 },
  badge: { borderWidth: 1, borderRadius: 70, paddingHorizontal: 10, height: 24, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 14 },
  row: { minHeight: 84, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingRight: 4 },
  rowMainOuter: { flex: 1, minWidth: 0 },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 10 },
  rowCompact: { minHeight: 60, borderRadius: 16 },
  rowMainCompact: { paddingVertical: 8 },
  artistLink: { fontFamily: amFonts.semi, fontSize: 12.5, lineHeight: 17, textDecorationLine: "underline" },
  rowText: { flex: 1, minWidth: 0, gap: 6 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20, letterSpacing: -0.1 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  subText: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 12.5, lineHeight: 17 },
  more: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
})
