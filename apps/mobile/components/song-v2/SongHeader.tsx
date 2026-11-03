import { StyleSheet, Text, View } from "react-native"
import { Check, ChevronDown, ChevronLeft, Download, Heart } from "lucide-react-native"
import Svg, { Circle } from "react-native-svg"

import { CircleButton, Pill } from "@/components/song-v2/common"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amControl, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"
import type { DownloadPhase } from "@/lib/songPage/versions"

const RING = 22
const RING_STROKE = 3

/** Round download button: icon, a ring while saving, a check once saved. */
function DownloadCircle({
  theme,
  phase,
  progress,
  onPress,
  label,
}: {
  theme: AmTheme
  phase: DownloadPhase
  progress: number
  onPress: () => void
  label: string
}) {
  const radius = (RING - RING_STROKE) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <CircleButton theme={theme} label={label} onPress={onPress} filled={phase === "saved"}>
      {phase === "saved" ? (
        <Check size={20} color={theme.onBrand} />
      ) : phase === "downloading" ? (
        <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
          <Circle cx={RING / 2} cy={RING / 2} r={radius} stroke={theme.line} strokeWidth={RING_STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={radius}
            stroke={theme.brand}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={circumference * (1 - Math.max(0.05, Math.min(1, progress)))}
            strokeLinecap="round"
            rotation={-90}
            origin={`${RING / 2}, ${RING / 2}`}
          />
        </Svg>
      ) : (
        <Download size={20} color={theme.textHeading} />
      )}
    </CircleButton>
  )
}

export function SongTopBar({
  theme,
  saved,
  onBack,
  onHeart,
  downloadPhase,
  downloadProgress,
  downloadLabelText,
  onDownload,
  showDownload,
}: {
  theme: AmTheme
  saved: boolean
  onBack: () => void
  onHeart: () => void
  downloadPhase: DownloadPhase
  downloadProgress: number
  downloadLabelText: string
  onDownload: () => void
  showDownload: boolean
}) {
  return (
    <View style={styles.topBar}>
      <CircleButton theme={theme} label="Go back" onPress={onBack}>
        <ChevronLeft size={22} color={theme.textHeading} />
      </CircleButton>
      <View style={styles.topRight}>
        <CircleButton theme={theme} label={saved ? "Remove from favourites" : "Add to favourites"} onPress={onHeart}>
          <Heart size={20} color={saved ? theme.brand : theme.textHeading} fill={saved ? theme.brand : "transparent"} />
        </CircleButton>
        {showDownload ? (
          <DownloadCircle
            theme={theme}
            phase={downloadPhase}
            progress={downloadProgress}
            onPress={onDownload}
            label={downloadLabelText}
          />
        ) : null}
      </View>
    </View>
  )
}

/** Eyebrow, title, the one-line version picker, then Play and Learn. */
export function SongTitleBlock({
  theme,
  eyebrow,
  title,
  versionText,
  onOpenVersions,
  playing,
  hasAudio,
  onPlay,
  learning,
  onLearn,
}: {
  theme: AmTheme
  eyebrow: string
  title: string
  versionText: string
  onOpenVersions: () => void
  playing: boolean
  hasAudio: boolean
  onPlay: () => void
  learning: boolean
  onLearn: () => void
}) {
  return (
    <View style={styles.block}>
      <Text style={[amType.label, { color: theme.eyebrow }]} numberOfLines={1}>
        {eyebrow}
      </Text>
      <Text style={[amType.title, { color: theme.textHeading }]} accessibilityRole="header">
        {title}
      </Text>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`Recording: ${versionText}. Open all versions`}
        onPress={onOpenVersions}
        pressedScale={0.985}
        style={styles.versionLine}
      >
        <Text style={[styles.versionText, { color: theme.textBody }]} numberOfLines={1}>
          {versionText}
        </Text>
        <ChevronDown size={18} color={theme.textBody} />
      </PressScale>
      <View style={styles.actions}>
        <Pill
          theme={theme}
          tone="brand"
          label={playing ? "Pause" : "Play"}
          disabled={!hasAudio}
          onPress={onPlay}
          style={styles.action}
        />
        <Pill
          theme={theme}
          tone="sand"
          label={learning ? "Learning" : "Learn"}
          leading={learning ? <Check size={18} color={theme.textHeading} /> : undefined}
          onPress={onLearn}
          style={styles.action}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topRight: { flexDirection: "row", alignItems: "center", gap: amSpace.s2 },
  block: { gap: amSpace.s3 },
  versionLine: {
    minHeight: amTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s2,
  },
  versionText: { fontFamily: amFonts.medium, fontSize: amFontSize.body, flexShrink: 1 },
  actions: { flexDirection: "row", gap: amSpace.s3 },
  action: { flex: 1, height: amControl.pillHeight },
})
