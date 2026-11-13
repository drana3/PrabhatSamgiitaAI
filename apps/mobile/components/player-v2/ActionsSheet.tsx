import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"

import { PlayerIcon, type PlayerIconName } from "@/components/player-v2/PlayerIcons"
import { SaveMark } from "@/components/save/SaveMark"
import { coverFor } from "@/components/player-v2/playerCovers"
import { Sheet } from "@/components/player-v2/Sheet"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { ActionId, ActionRow } from "@/lib/playerV2/playerActions"
import { useT } from "@/lib/i18n"

type Props = {
  visible: boolean
  theme: AmTheme
  songNumber: number
  title: string
  /** "Collection · performer" */
  subtitle: string
  rows: ActionRow[]
  onAction: (id: ActionId) => void
  onClose: () => void
}

const ICON: Record<Exclude<ActionRow["icon"], "save">, PlayerIconName> = {
  share: "share",
  playlistAdd: "playlistAdd",
  queueAdd: "queueAdd",
  queue: "queue",
  music: "music",
  library: "library",
  timer: "timer",
  drive: "drive",
  layers: "layers",
  flag: "flag",
}

/**
 * The "more" sheet of the Player (the three dots in the top bar): the song on top (small cover,
 * title, collection and performer), a hairline, then one 52px row per action, icon and label. It is
 * the app's own Sheet, so it drags down with momentum and a rubber band and lands with a spring.
 */
export function ActionsSheet({ visible, theme, songNumber, title, subtitle, rows, onAction, onClose }: Props) {
  const t = useT()
  const cover = coverFor(songNumber)
  return (
    <Sheet visible={visible} onClose={onClose} title={t("songs.menu.more")} theme={theme}>
      <View style={styles.head}>
        <Image source={cover.source} contentFit="cover" contentPosition={cover.position} style={[styles.cover, { backgroundColor: theme.inner }]} />
        <View style={styles.headText}>
          <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.sub, { color: theme.textBody }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={[styles.rule, { backgroundColor: theme.line }]} />
      {rows.map((row) => (
        <PressScale
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={row.meta ? `${row.label}, ${row.meta}` : row.label}
          accessibilityState={{ selected: row.active }}
          onPress={() => onAction(row.id)}
          pressedScale={0.98}
          style={styles.row}
        >
          <View style={styles.icon}>
            {row.icon === "save" ? (
              <SaveMark on={Boolean(row.active)} size={24} color={theme.textHeading} />
            ) : (
              <PlayerIcon name={ICON[row.icon]} size={24} color={theme.textHeading} />
            )}
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: theme.textHeading }]} numberOfLines={1}>
              {row.label}
            </Text>
            {row.meta ? (
              <Text style={[styles.meta, { color: theme.textBody }]} numberOfLines={1}>
                {row.meta}
              </Text>
            ) : null}
          </View>
        </PressScale>
      ))}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 16 },
  cover: { width: 56, height: 56, borderRadius: 10, overflow: "hidden" },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 52, paddingVertical: 8, paddingHorizontal: 20 },
  icon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0 },
  label: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  meta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
})
