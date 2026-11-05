import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SetRow } from "@/components/profile-v2/SheetBlocks"
import type { AmProto } from "@/constants/tokens/amToday"

/**
 * The "Your library" row at the top of the profile sheet: everything that is the person's own
 * (saved songs and Kiirtans, playlists, downloads, uploads) on one page. `last` comes from the Group.
 */
export function LibraryEntryRow({ p, onPress, last }: { p: AmProto; onPress: () => void; last?: boolean }) {
  return (
    <SetRow
      p={p}
      label="Your library"
      chevron
      onPress={onPress}
      last={last}
      icon={<PlayerIcon name="library" size={22} color={p.ink800} />}
    />
  )
}
