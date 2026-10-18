import { useEffect } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake"
import * as ScreenOrientation from "expo-screen-orientation"
import { StatusBar } from "expo-status-bar"
import { X } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { ReactNode } from "react"

import {
  CaptureStudioToolbar,
  RecordingPulse,
  type CaptureToolbarAction,
} from "@/components/admin/CaptureStudioToolbar"
import { captureStudioLineHeading, captureStudioSongLabel } from "@/lib/adminSargamStudio"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  visible: boolean
  onRequestClose: () => void
  songNumber: number
  songTitle?: string
  lineNumber: number
  lineCount: number
  lineLyric: string
  lineStatus: string
  recording: boolean
  notesCaptured: number
  toolbarActions: CaptureToolbarAction[]
  sessionActions?: CaptureToolbarAction[]
  listenSlot?: ReactNode
  children: ReactNode
}

export function AdminSargamFullscreenStudio({
  visible,
  onRequestClose,
  songNumber,
  songTitle,
  lineNumber,
  lineCount,
  lineLyric,
  lineStatus,
  recording,
  notesCaptured,
  toolbarActions,
  sessionActions = [],
  listenSlot,
  children,
}: Props) {
  useEffect(() => {
    if (!visible) return
    void activateKeepAwakeAsync("admin-sargam-studio").catch(() => undefined)
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined)
    return () => {
      deactivateKeepAwake("admin-sargam-studio")
      void ScreenOrientation.unlockAsync().catch(() => undefined)
    }
  }, [visible])

  async function exitStudio() {
    deactivateKeepAwake("admin-sargam-studio")
    try {
      await ScreenOrientation.unlockAsync()
    } catch {
      /* ignore */
    }
    onRequestClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      supportedOrientations={["landscape-left", "landscape-right", "portrait"]}
      onRequestClose={() => exitStudio()}
    >
      <StatusBar hidden />
      <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.header}>
          <Pressable
            style={styles.exitBtn}
            onPress={() => exitStudio()}
            accessibilityRole="button"
            accessibilityLabel="Exit fullscreen studio"
          >
            <X size={20} color={colors.textPrimary} />
            <Text style={styles.exitText}>Exit</Text>
          </Pressable>
          <Text style={styles.songNumber} accessibilityRole="header">
            {captureStudioSongLabel(songNumber, songTitle)}
          </Text>
          <Text style={styles.lineMeta}>
            Line {lineNumber}
            {lineCount ? ` / ${lineCount}` : ""} · {lineStatus}
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.playerColumn}>
            {children}
          </View>

          <View style={[styles.footer, recording && styles.footerRecording]}>
            <View style={styles.footerLyricRow}>
              <Text style={styles.footerLineMeta} numberOfLines={1}>
                {captureStudioLineHeading(lineNumber)}
                {lineCount ? ` · ${lineNumber}/${lineCount}` : ""} · {lineStatus}
              </Text>
              <Text
                style={styles.footerLyric}
                numberOfLines={2}
                accessibilityLabel={`Lyrics for line ${lineNumber}`}
              >
                {lineLyric}
              </Text>
              <RecordingPulse active={recording} noteCount={notesCaptured} inline />
            </View>
            <CaptureStudioToolbar actions={toolbarActions} dense />
            {sessionActions.length ? <CaptureStudioToolbar actions={sessionActions} dense /> : null}
            {listenSlot}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 36,
  },
  exitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  exitText: { ...typography.caption, color: colors.textPrimary, fontFamily: "Inter_600SemiBold" },
  songNumber: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
  },
  lineMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    maxWidth: "34%",
  },
  body: { flex: 1, gap: spacing.xs },
  playerColumn: { flex: 1, minHeight: 180 },
  footer: {
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  footerRecording: {
    borderColor: colors.error,
    backgroundColor: "#fff9f9",
  },
  footerLyricRow: { gap: 2 },
  footerLineMeta: {
    ...typography.caption,
    color: colors.spiritualGold,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  footerLyric: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: "SourceSerif4_600SemiBold",
    lineHeight: 18,
  },
})
