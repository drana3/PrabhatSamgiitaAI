import { StyleSheet, Text, View } from "react-native"

import { CheckRing, SheetGroup, SheetPill, SheetRow } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

export type PlaylistSheetRow = { id: string; name: string; meta: string; has: boolean }

type Props = {
  visible: boolean
  theme: AmTheme
  songTitle: string
  rows: PlaylistSheetRow[]
  onToggle: (id: string, has: boolean) => void
  onNew: () => void
  onClose: () => void
}

/** "Add to playlist" (prototype PLAYLIST): tick or untick the song in place, or start a new list. */
export function PlaylistSheet({ visible, theme, songTitle, rows, onToggle, onNew, onClose }: Props) {
  const t = useT()
  return (
    <Sheet visible={visible} onClose={onClose} title={t("songs.menu.addTo")} theme={theme}>
      <Text style={[styles.song, { color: theme.textBody }]} numberOfLines={2}>
        {songTitle}
      </Text>
      {rows.length ? (
        <SheetGroup theme={theme}>
          {rows.map((row, index) => (
            <SheetRow
              key={row.id}
              theme={theme}
              title={row.name}
              meta={row.meta}
              accessibilityRole="checkbox"
              selected={row.has}
              last={index === rows.length - 1}
              trailing={<CheckRing theme={theme} on={row.has} />}
              onPress={() => onToggle(row.id, row.has)}
            />
          ))}
        </SheetGroup>
      ) : null}
      <View style={styles.pad}>
        <SheetPill theme={theme} tone="sand" icon label={t("songs.mine.newPlaylist")} onPress={onNew} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  song: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 21, paddingHorizontal: 20, paddingBottom: 12 },
  pad: { paddingTop: 16, paddingHorizontal: 20 },
})
