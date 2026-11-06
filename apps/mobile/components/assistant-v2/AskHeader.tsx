import { StyleSheet, Text, View } from "react-native"
import { BookOpen, Clock, Languages, Plus, X } from "lucide-react-native"

import { PressScale } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

type ThemeProps = { theme: AmTheme }

function RoundButton({
  theme,
  label,
  onPress,
  children,
}: ThemeProps & { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.92}
      style={[styles.round, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      {children}
    </PressScale>
  )
}

/** Close on the left, new chat and past chats on the right. */
export function AskTopBar({
  theme,
  onClose,
  onNewChat,
  onChats,
  canStartNew,
}: ThemeProps & { onClose: () => void; onNewChat: () => void; onChats: () => void; canStartNew: boolean }) {
  const t = useT()
  return (
    <View style={styles.topBar}>
      <RoundButton theme={theme} label={t("common.close")} onPress={onClose}>
        <X size={20} color={theme.textHeading} />
      </RoundButton>
      <View style={styles.topRight}>
        {canStartNew ? (
          <RoundButton theme={theme} label={t("assistant.newChat")} onPress={onNewChat}>
            <Plus size={20} color={theme.textHeading} />
          </RoundButton>
        ) : null}
        <RoundButton theme={theme} label={t("assistant.pastChats")} onPress={onChats}>
          <Clock size={20} color={theme.textHeading} />
        </RoundButton>
      </View>
    </View>
  )
}

/** Two-tone display heading, as on the other screens. */
export function AskHeading({ theme, grounded }: ThemeProps & { grounded: boolean }) {
  const t = useT()
  return (
    <Text style={[amType.title, styles.heading]} accessibilityRole="header">
      <Text style={{ color: theme.textHeading }}>{t("assistant.heading.ask")}</Text>
      {"\n"}
      <Text style={{ color: theme.headingSecond }}>{grounded ? t("assistant.heading.song") : t("assistant.heading.songs")}</Text>
    </Text>
  )
}

/**
 * The grounding strip: what the answers are based on. With a song it names it
 * and opens it; the cross lets the reader widen the question to all songs.
 */
export function GroundingStrip({
  theme,
  songNumber,
  title,
  language,
  onOpenSong,
  onDetach,
  onLanguage,
  quotaLabel,
}: ThemeProps & {
  songNumber: number | null
  title: string | null
  language: string
  onOpenSong: () => void
  onDetach: () => void
  onLanguage: () => void
  /** null when the server has not said how many questions are left: nothing is shown then */
  quotaLabel: string | null
}) {
  const t = useT()
  return (
    <View style={styles.strip}>
      <View style={styles.stripRow}>
        {songNumber ? (
          <View style={[styles.ground, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <View style={styles.groundPress}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={
                  title
                    ? t("assistant.openSongTitled", { number: String(songNumber), title })
                    : t("assistant.openSong", { number: String(songNumber) })
                }
                onPress={onOpenSong}
                pressedScale={0.97}
                style={styles.groundBody}
              >
                <BookOpen size={18} color={theme.eyebrow} />
                <Text numberOfLines={1} style={[styles.groundText, { color: theme.textHeading }]}>
                  <Text style={{ fontFamily: amFonts.bold, color: theme.eyebrow }}>PS {songNumber}</Text>
                  {title ? `  ${title}` : ""}
                </Text>
              </PressScale>
            </View>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={t("assistant.detach")}
              onPress={onDetach}
              pressedScale={0.92}
              style={styles.detach}
            >
              <X size={16} color={theme.textBody} />
            </PressScale>
          </View>
        ) : (
          <View style={[styles.ground, styles.groundBody, { backgroundColor: theme.card, borderColor: theme.line, paddingRight: 16 }]}>
            <BookOpen size={18} color={theme.eyebrow} />
            <Text numberOfLines={1} style={[styles.groundText, { color: theme.textHeading }]}>
              {t("songs.allSongs")}
            </Text>
          </View>
        )}
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t("assistant.languagePill", { language })}
          onPress={onLanguage}
          pressedScale={0.96}
          style={[styles.langPill, { backgroundColor: theme.card, borderColor: theme.line }]}
        >
          <Languages size={18} color={theme.textHeading} />
          <Text style={[styles.langText, { color: theme.textHeading }]}>{language}</Text>
        </PressScale>
      </View>
      {quotaLabel ? <Text style={[amType.label, { color: theme.eyebrow }]}>{quotaLabel}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRight: { flexDirection: "row", gap: amGap.grid },
  round: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { marginTop: 8, marginBottom: amGap.block },
  strip: { gap: 12, marginBottom: amGap.block },
  stripRow: { flexDirection: "row", gap: amGap.grid, alignItems: "center" },
  ground: {
    flex: 1,
    minHeight: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 4,
    minWidth: 0,
  },
  groundPress: { flex: 1, minWidth: 0 },
  groundBody: { minHeight: amTouchTarget, flexDirection: "row", alignItems: "center", gap: 8 },
  groundText: { flex: 1, fontFamily: amFonts.medium, fontSize: 16 },
  detach: { width: amTouchTarget, height: amTouchTarget, alignItems: "center", justifyContent: "center" },
  langPill: {
    minHeight: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  langText: { fontFamily: amFonts.medium, fontSize: 16 },
})
