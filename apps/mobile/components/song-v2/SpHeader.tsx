import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { DownloadPhase } from "@/lib/songPage/versions"

import { SpIcon } from "./SpIcon"
import { over } from "./spType"
import { SpPill, SpPress, SpRound } from "./SpUi"

/** `.sp-top`: back on the left; add to playlist, heart, download on the right. */
export function SpTopBar({
  t,
  saved,
  onBack,
  onPlaylist,
  onHeart,
  phase,
  progress,
  downloadLabel,
  showDownload,
  onDownload,
}: {
  t: SpTheme
  saved: boolean
  onBack: () => void
  onPlaylist: () => void
  onHeart: () => void
  phase: DownloadPhase
  progress: number
  downloadLabel: string
  showDownload: boolean
  onDownload: () => void
}) {
  const percent = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`
  return (
    <View style={styles.top}>
      <SpRound t={t} icon="back" label="Back" onPress={onBack} />
      <View style={styles.gap} />
      <SpRound t={t} icon="listPlus" label="Add to playlist" onPress={onPlaylist} />
      <SpRound
        t={t}
        icon="heart"
        filled={saved}
        color={saved ? t.orange500 : t.ink800}
        label={saved ? "Remove from Mine" : "Save to Mine"}
        onPress={onHeart}
      />
      {showDownload ? (
        <SpRound
          t={t}
          label={downloadLabel}
          onPress={onDownload}
          tone={phase === "idle" ? "glass" : "peach"}
        >
          {phase === "saved" ? (
            <SpIcon name="check" color={t.orange700} />
          ) : phase === "downloading" ? (
            <Text style={{ fontFamily: amFonts.bold, fontSize: 12, color: t.orange700, fontVariant: ["tabular-nums"] }}>
              {percent}
            </Text>
          ) : (
            <SpIcon name="download" color={t.ink800} />
          )}
        </SpRound>
      ) : null}
    </View>
  )
}

/** `.sp-title`: `PS 1 · Guidance`, the title, and the version picker line. */
export function SpTitleBlock({
  t,
  eyebrow,
  title,
  versionText,
  onVersions,
}: {
  t: SpTheme
  eyebrow: string
  title: string
  versionText: string
  onVersions: () => void
}) {
  return (
    <View style={styles.title}>
      <Text style={[over(t), { fontVariant: ["tabular-nums"] }]}>{eyebrow}</Text>
      <Text style={[styles.h1, { color: t.ink900 }]} accessibilityRole="header">
        {title}
      </Text>
      <SpPress onPress={onVersions} accessibilityLabel="Choose a version" style={styles.ver}>
        <Text style={[styles.verText, { color: t.ink500 }]} numberOfLines={1}>
          {versionText}
        </Text>
        <SpIcon name="chevDown" size={18} color={t.ink500} />
      </SpPress>
    </View>
  )
}

/** `.sa`: Play (brand) and Learn (white; peach once learning). */
export function SpActions({
  t,
  playing,
  onPlay,
  learning,
  onLearn,
}: {
  t: SpTheme
  playing: boolean
  onPlay: () => void
  learning: boolean
  onLearn: () => void
}) {
  return (
    <View style={styles.actions}>
      <SpPill
        t={t}
        label={playing ? "Pause" : "Play"}
        icon={playing ? "pause" : "play"}
        onPress={onPlay}
        style={{ flex: 1.3 }}
      />
      <SpPill
        t={t}
        label={learning ? "Learning" : "Learn"}
        variant={learning ? "peach" : "sand"}
        icon={learning ? "check" : "plusThin"}
        onPress={onLearn}
        style={{ flex: 1 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
  gap: { flex: 1 },
  title: { paddingTop: 16, paddingHorizontal: 20, gap: 6 },
  h1: {
    fontFamily: amFonts.display,
    fontSize: 30,
    lineHeight: 29.4,
    letterSpacing: -0.6,
    textTransform: "uppercase",
  },
  ver: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    marginBottom: -6,
    marginLeft: -2,
    paddingHorizontal: 2,
  },
  verText: { fontFamily: amFonts.semi, fontSize: 15 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
})
