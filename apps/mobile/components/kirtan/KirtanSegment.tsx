import { useCallback, useMemo, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { AddKirtanRow, AvatarButton, BlockHead, KirtanRow, KirtanScreenHead, StatusBadge, TypeChips } from "@/components/kirtan/KirtanParts"
import { KirtanMenuSheet, KirtanShareSheet } from "@/components/kirtan/KirtanMenus"
import { KPress } from "@/components/kirtan/KPress"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtans } from "@/hooks/useKirtans"
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { filterKirtans } from "@/lib/kirtan/list"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import type { Kirtan, KirtanTypeFilter } from "@/lib/kirtan/types"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

/**
 * Songs > Kirtan: `+ Add kirtan`, the person's own submissions (only when there are any), type chips
 * and the approved kirtans. A tap plays in the kirtan player, which uses YouTube's embedded player.
 * `inset` is the space above the content: status area plus the source switch.
 */
export function KirtanSegment({ inset, avatarTop }: { inset: number; avatarTop: number }) {
  const router = useRouter()
  const theme = useSongsTheme()
  const initial = useProfileInitial()
  const openedAt = useRevealClock()
  const actions = useKirtanActions()
  const { playable, submissions } = useKirtans()
  const savedIds = useKirtanStore((s) => s.savedIds)
  const withdraw = useKirtanStore((s) => s.withdraw)

  const [type, setType] = useState<KirtanTypeFilter>("all")
  const [menu, setMenu] = useState<Kirtan | null>(null)
  const [share, setShare] = useState<Kirtan | null>(null)

  const rows = useMemo(() => filterKirtans(playable, type), [playable, type])
  const context = useMemo(() => rows.map((k) => k.id), [rows])

  const onShare = useCallback(
    async (k: Kirtan, target: ShareTargetId) => {
      const outcome = await runShare(target, kirtanSharePayload(k))
      const message = shareToast(outcome)
      if (message) actions.flash(message)
    },
    [actions],
  )

  const header = (
    <View>
      <View style={{ height: inset }} />
      <SongsReveal index={0}>
        <KirtanScreenHead theme={theme} title="Kiirtan" count={playable.length} />
      </SongsReveal>
      <SongsReveal index={1} style={styles.block}>
        <AddKirtanRow theme={theme} onPress={() => router.push(href("/add-kirtan"))} />
      </SongsReveal>
      {submissions.length ? (
        <SongsReveal index={2} style={styles.block}>
          <BlockHead theme={theme} label="Your submissions" note={`${submissions.filter((s) => s.status === "pending").length} waiting for review`} />
          <View style={styles.gap}>
            {submissions.map((k) => (
              <KirtanRow
                key={k.id}
                theme={theme}
                kirtan={k}
                onOpen={(row) => actions.open(row, context)}
                trailing={
                  <View style={styles.status}>
                    <StatusBadge theme={theme} status={k.status} />
                    {k.status !== "approved" ? (
                      <KPress accessibilityRole="button" accessibilityLabel={`Take back ${k.title}`} onPress={() => withdraw(k.id)} pressedScale={0.94}>
                        <Text style={[styles.take, { color: theme.textBody }]}>Take back</Text>
                      </KPress>
                    ) : null}
                  </View>
                }
              />
            ))}
          </View>
        </SongsReveal>
      ) : null}
      <SongsReveal index={3} style={styles.chipsBlock}>
        <TypeChips theme={theme} value={type} onChange={setType} />
      </SongsReveal>
    </View>
  )

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.fill, { backgroundColor: theme.page }]}>
        <FlatList
          data={rows}
          keyExtractor={(k) => k.id}
          ListHeaderComponent={header}
          ItemSeparatorComponent={Gap}
          renderItem={({ item }) => (
            <View style={styles.rowSlot}>
              <KirtanRow theme={theme} kirtan={item} onOpen={(k) => actions.open(k, context)} onMore={setMenu} />
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textBody }]}>No kiirtans of this type yet. Add one with the button above.</Text>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        />
        <AvatarButton theme={theme} top={avatarTop} initial={initial} onPress={() => router.push(href("/profile-sheet"))} />
        <KirtanMenuSheet
          open={Boolean(menu)}
          theme={theme}
          kirtan={menu}
          saved={menu ? savedIds.includes(menu.id) : false}
          onPlayNext={actions.playNext}
          onAddToPlaylist={actions.addToPlaylist}
          onToggleSave={actions.toggleSaved}
          onShare={(k) => setShare(k)}
          onOpenYouTube={actions.openOnYouTube}
          onReport={actions.report}
          onClose={() => setMenu(null)}
        />
        <KirtanShareSheet open={Boolean(share)} theme={theme} kirtan={share} onShare={onShare} onClose={() => setShare(null)} />
        <Toast message={actions.toast} theme={theme} />
      </View>
    </RevealClock.Provider>
  )
}

function Gap() {
  return <View style={styles.sep} />
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: 190 },
  block: { paddingHorizontal: 10, paddingBottom: 12, gap: 10 },
  gap: { gap: 10 },
  chipsBlock: { paddingTop: 8, paddingBottom: 14 },
  rowSlot: { paddingHorizontal: 10 },
  sep: { height: 10 },
  status: { alignItems: "flex-end", gap: 4, paddingRight: 12 },
  take: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, textDecorationLine: "underline" },
  empty: { paddingHorizontal: 20, paddingTop: 12, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
})
