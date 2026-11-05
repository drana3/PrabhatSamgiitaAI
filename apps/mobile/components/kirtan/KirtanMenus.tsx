import { useMemo, useRef, useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import { DownloadMenuRow } from "@/components/offline/DownloadMenuRow"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { ShareTargetIcon } from "@/components/player-v2/ShareTargetIcon"
import { SaveMark } from "@/components/save/SaveMark"
import { ShareCardSheet } from "@/components/share/ShareCardSheet"
import { BottomSheet } from "@/components/songs-v2/BottomSheet"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { kindLabel } from "@/lib/kirtan/kind"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import { kiirtanDownloadItem } from "@/lib/offline/downloadItems"
import type { Kirtan } from "@/lib/kirtan/types"
import { SHARE_TARGETS, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useShareCardT } from "@/lib/share/cardCopy"
import { useT } from "@/lib/i18n"

type MenuProps = {
  open: boolean
  theme: SongsTheme
  kirtan: Kirtan | null
  saved: boolean
  onPlayNext: (k: Kirtan) => void
  onAddToPlaylist: (k: Kirtan) => void
  onToggleSave: (k: Kirtan) => void
  onShare: (k: Kirtan) => void
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

/** The row menu of a kirtan: Play next, Add to playlist, Save, Download, Share, Report. */
export function KirtanMenuSheet({ open, theme, kirtan, saved, onPlayNext, onAddToPlaylist, onToggleSave, onShare, onReport, onClose }: MenuProps) {
  const t = useT()
  // keep the last kirtan while the sheet slides out, so its title does not vanish mid-exit
  const last = useRef<Kirtan | null>(null)
  if (kirtan) last.current = kirtan
  const shown = kirtan ?? last.current
  const act = (fn: (k: Kirtan) => void) => () => {
    if (shown) fn(shown)
    onClose()
  }
  const ink = theme.textHeading
  const downloadItem = useMemo(() => (shown ? kiirtanDownloadItem(shown) : null), [shown])
  return (
    <BottomSheet open={open && Boolean(kirtan)} onClose={onClose} theme={theme} eyebrow={kindLabel(shown?.kind)} accessibilityLabel={t("kt.menu.actions", { kind: kindLabel(shown?.kind) })}>
      {shown ? (
        <Text style={[styles.menuTitle, { color: theme.textHeading }]} numberOfLines={3}>
          {shown.title}
        </Text>
      ) : null}
      <View style={styles.stack}>
        <MenuRow theme={theme} label={t("songs.menu.playNext")} icon={<PlayerIcon name="queueAdd" size={22} color={ink} />} onPress={act(onPlayNext)} />
        <MenuRow theme={theme} label={t("songs.menu.addTo")} icon={<PlayerIcon name="playlistAdd" size={22} color={ink} />} onPress={act(onAddToPlaylist)} />
        <MenuRow
          theme={theme}
          label={saved ? t("songs.menu.savedChange") : t("songs.menu.saveTo")}
          icon={<SaveMark on={saved} size={22} color={ink} />}
          onPress={act(onToggleSave)}
        />
        <DownloadMenuRow item={downloadItem} size={22} color={ink} track={theme.line} ring={theme.accentBright}>
          {(row) => <MenuRow theme={theme} label={row.label} icon={row.icon} onPress={() => { row.onPress(); onClose() }} />}
        </DownloadMenuRow>
        <MenuRow theme={theme} label={t("songs.menu.share")} icon={<PlayerIcon name="share" size={22} color={ink} />} onPress={act(onShare)} />
        <MenuRow theme={theme} label={t("kt.menu.report")} icon={<PlayerIcon name="flag" size={22} color={ink} />} onPress={act(onReport)} />
      </View>
    </BottomSheet>
  )
}

/** Share targets of the player's share sheet, for a link to the Kiirtan. */
export function KirtanShareSheet({ open, theme, kirtan, onShare, onClose }: { open: boolean; theme: SongsTheme; kirtan: Kirtan | null; onShare: (k: Kirtan, target: ShareTargetId) => void; onClose: () => void }) {
  const t = useT()
  const tCard = useShareCardT()
  const last = useRef<Kirtan | null>(null)
  if (kirtan) last.current = kirtan
  const shown = kirtan ?? last.current
  // the picture card is its own full-screen step; it keeps its Kiirtan after this sheet has closed
  const [cardFor, setCardFor] = useState<Kirtan | null>(null)
  const cardPayload = useMemo(() => (cardFor ? kirtanSharePayload(cardFor) : null), [cardFor])
  return (
    <>
    <BottomSheet open={open && Boolean(kirtan)} onClose={onClose} theme={theme} eyebrow={t("songs.menu.share")} accessibilityLabel={t("kt.menu.shareA11y", { kind: kindLabel(shown?.kind) })}>
      {shown ? (
        <Text style={[styles.menuTitle, { color: theme.textHeading }]} numberOfLines={3}>
          {shown.title}
        </Text>
      ) : null}
      <Text style={[styles.note, { color: theme.textBody }]}>{t("kt.menu.shareNote", { kind: kindLabel(shown?.kind) })}</Text>
      <View style={styles.grid}>
        {SHARE_TARGETS.filter((t) => !t.needsImage).map((target) => (
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
            <ShareTargetIcon id={target.id} size={52} theme={theme} />
            <Text style={[styles.gridLabel, { color: theme.textBody }]} numberOfLines={1}>
              {target.label}
            </Text>
          </KPress>
        ))}
        <KPress
          accessibilityRole="button"
          accessibilityLabel={tCard("shareCard.entry")}
          onPress={() => {
            if (shown) setCardFor(shown)
            onClose()
          }}
          pressedScale={0.94}
          outerStyle={styles.gridCell}
          style={styles.gridItem}
        >
          <View style={[styles.cardDisc, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <PlayerIcon name="layers" size={24} color={theme.textHeading} />
          </View>
          <Text style={[styles.gridLabel, { color: theme.textBody }]} numberOfLines={1}>
            {tCard("shareCard.entry")}
          </Text>
        </KPress>
      </View>
    </BottomSheet>
    {cardFor && cardPayload ? (
      <ShareCardSheet
        subject={{
          kind: "kiirtan",
          id: cardFor.id,
          title: cardFor.title,
          author: cardFor.author,
          recordingKind: cardFor.kind,
          durationSec: cardFor.durationSec,
          coverUrl: cardFor.thumbnailUrl,
          type: cardFor.type,
        }}
        link={cardPayload.url}
        message={cardPayload.message}
        onClose={() => setCardFor(null)}
      />
    ) : null}
    </>
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
  cardDisc: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  gridLabel: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16, textAlign: "center" },
})
