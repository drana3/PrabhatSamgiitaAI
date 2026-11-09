import { useMemo } from "react"
import { View } from "react-native"

import { SectionTabs } from "@/components/song-page/ui"
import type { SpTheme } from "@/constants/tokens/amSong"
import { useT } from "@/lib/i18n"
import { KIIRTAN_TABS, type KiirtanTab } from "@/lib/recordingExtras/kiirtanTabs"

/**
 * The four tabs of a Kiirtan's page: Chords, Video, Notes, Story (lib/recordingExtras/kiirtanTabs.ts holds the order).
 *
 * They are the Prabhat Samgiita song page's menu (Lyrics, Video, Chords ...), not a look of their own: the same
 * `SectionTabs` component, so the type, the spacing, the 3 px underline on the chosen tab, the answer on touch-down and
 * the hairline under the row are one thing in both places. A change to that menu reaches this page by itself.
 */
export function KiirtanTabs({ t, value, onChange }: { t: SpTheme; value: KiirtanTab; onChange: (next: KiirtanTab) => void }) {
  const tr = useT()
  const items = useMemo(() => KIIRTAN_TABS.map((id) => ({ id, label: tr(`kPage.tab.${id}`) })), [tr])
  return (
    <View testID="kiirtan-tabs">
      <SectionTabs t={t} items={items} active={value} onSelect={onChange} />
    </View>
  )
}
