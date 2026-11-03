import { TabPlaceholder } from "@/components/nav-v2/TabPlaceholder"

/** Placeholder until the player branch adds the redesigned Player (SCR-12). The pill turns dark here. */
export default function PlayerTab() {
  return (
    <TabPlaceholder
      title="Player"
      note="The full player with karaoke lyrics is built on its own branch. The tab pill is dark on this tab and the mini-player is hidden."
      legacyHref="/player"
    />
  )
}
