import { useRef, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon, type PlayerIconName } from "@/components/player-v2/PlayerIcons"
import { BottomSheet } from "@/components/songs-v2/BottomSheet"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { Kirtan } from "@/lib/kirtan/types"
import { SHARE_TARGETS, type ShareTargetId } from "@/lib/playerV2/playerShare"

type MenuProps = {
  open: boolean
  theme: SongsTheme
  kirtan: Kirtan | null
  saved: boolean
  onPlayNext: (k: Kirtan) => void
  onAddToPlaylist: (k: Kirtan) => void
  onToggleSave: (k: Kirtan) => void
  onShare: (k: Kirtan) => void
  onOpenYouTube: (k: Kirtan) => void
  onReport: (k: Kirtan) => void
  onClose: () => void
}

function MenuRow({ theme, label, icon, onPress }: { theme: SongsTheme; label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.985}
      style={[styles.menuRow, { borderColor: theme.line, backgroundColor: theme.card }]}
    >
      {icon}
      <Text style={[styles.menuLabel, { color: theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

/** The row menu of a kirtan: Play next, Add to playlist, Save, Share, Open on YouTube, Report. */
export function KirtanMenuSheet({ open, theme, kirtan, saved, onPlayNext, onAddToPlaylist, onToggleSave, onShare, onOpenYouTube, onReport, onClose }: MenuProps) {
  // keep the last kirtan while the sheet slides out, so its title does not vanish mid-exit
  const last = useRef<Kirtan | null>(null)
  if (kirtan) last.current = kirtan
  const shown = kirtan ?? last.current
  const act = (fn: (k: Kirtan) => void) => () => {
    if (shown) fn(shown)
    onClose()
  }
  const ink = theme.textHeading
  return (
    <BottomSheet open={open && Boolean(kirtan)} onClose={onClose} theme={theme} eyebrow="Kiirtan" accessibilityLabel="Kiirtan actions">
      {shown ? (
        <Text style={[styles.menuTitle, { color: theme.textHeading }]} numberOfLines={3}>
          {shown.title}
        </Text>
      ) : null}
      <View style={styles.stack}>
        <MenuRow theme={theme} label="Play next" icon={<PlayerIcon name="queueAdd" size={22} color={ink} />} onPress={act(onPlayNext)} />
        <MenuRow theme={theme} label="Add to playlist" icon={<PlayerIcon name="playlistAdd" size={22} color={ink} />} onPress={act(onAddToPlaylist)} />
        <MenuRow
          theme={theme}
          label={saved ? "Remove from saved" : "Save"}
          icon={<PlayerIcon name="heart" size={22} color={saved ? theme.accent : ink} filled={saved} />}
          onPress={act(onToggleSave)}
        />
        <MenuRow theme={theme} label="Share" icon={<PlayerIcon name="share" size={22} color={ink} />} onPress={act(onShare)} />
        <MenuRow theme={theme} label="Open on YouTube" icon={<PlayerIcon name="link" size={22} color={ink} />} onPress={act(onOpenYouTube)} />
        <MenuRow theme={theme} label="Report" icon={<PlayerIcon name="flag" size={22} color={ink} />} onPress={act(onReport)} />
      </View>
    </BottomSheet>
  )
}

const TARGET_ICON: Record<ShareTargetId, PlayerIconName> = {
  copy: "link",
  whatsapp: "whatsapp",
  telegram: "telegram",
  instagram: "instagram",
  messages: "messages",
  more: "more",
}

/** Share targets of the player's share sheet, for a link to the video on YouTube. */
export function KirtanShareSheet({ open, theme, kirtan, onShare, onClose }: { open: boolean; theme: SongsTheme; kirtan: Kirtan | null; onShare: (k: Kirtan, target: ShareTargetId) => void; onClose: () => void }) {
  const last = useRef<Kirtan | null>(null)
  if (kirtan) last.current = kirtan
  const shown = kirtan ?? last.current
  return (
    <BottomSheet open={open && Boolean(kirtan)} onClose={onClose} theme={theme} eyebrow="Share" accessibilityLabel="Share kiirtan">
      {shown ? (
        <Text style={[styles.menuTitle, { color: theme.textHeading }]} numberOfLines={3}>
          {shown.title}
        </Text>
      ) : null}
      <Text style={[styles.note, { color: theme.textBody }]}>Your friends get the link to the video on YouTube.</Text>
      <View style={styles.grid}>
        {SHARE_TARGETS.filter((t) => t.id !== "instagram").map((target) => (
          <KPress
            key={target.id}
            accessibilityRole="button"
            accessibilityLabel={target.label}
            onPress={() => {
              if (shown) onShare(shown, target.id)
              onClose()
            }}
            pressedScale={0.94}
            outerStyle={styles.gridCell}
            style={styles.gridItem}
          >
            <View style={[styles.disc, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <PlayerIcon name={TARGET_ICON[target.id]} size={24} color={theme.textHeading} />
            </View>
            <Text style={[styles.gridLabel, { color: theme.textBody }]} numberOfLines={1}>
              {target.label}
            </Text>
          </KPress>
        ))}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  menuTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.48 },
  menuLabel: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  menuRow: { minHeight: 56, borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 14 },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  gridCell: { width: "25%" },
  gridItem: { alignItems: "center", gap: 8 },
  disc: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  gridLabel: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16, textAlign: "center" },
})
