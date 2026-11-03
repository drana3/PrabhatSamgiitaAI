import { TabPlaceholder } from "@/components/nav-v2/TabPlaceholder"

/** Placeholder until the songs-catalog branch adds the redesigned Songs screen (SCR-11). */
export default function SongsTab() {
  return (
    <TabPlaceholder
      title="Songs"
      note="The redesigned catalog (search, Catalog, Collections, Mine) is built on its own branch."
      legacyHref="/(tabs)/songs"
    />
  )
}
