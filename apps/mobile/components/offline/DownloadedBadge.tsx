import { useMemo } from "react"
import { StyleSheet, View } from "react-native"

import { DownloadMark } from "@/components/offline/DownloadMark"
import { useDownloadState } from "@/hooks/useDownloadState"
import { kiirtanDownloadItem } from "@/lib/offline/downloadItems"
import type { DownloadItem } from "@/lib/offline/downloadModel"
import type { KiirtanSource } from "@/lib/kirtan/track"
import { useT } from "@/lib/i18n"

/**
 * The small green downloaded square of a row that is already on the phone ("Downloaded"). Draws nothing in
 * any other state, so a row does not get crowded. Same mark as the buttons.
 */
export function DownloadedBadge({ item, size = 14 }: { item: DownloadItem | null; size?: number }) {
  const t = useT()
  const { view } = useDownloadState(item)
  if (view.status !== "done") return null
  return (
    <View accessible accessibilityLabel={t("dl.badge")} style={styles.badge}>
      <DownloadMark status="done" size={size} />
    </View>
  )
}

/** The badge of a Kiirtan or Bhajan row. */
export function KiirtanDownloadedBadge({ kirtan, size }: { kirtan: KiirtanSource; size?: number }) {
  const item = useMemo(() => kiirtanDownloadItem(kirtan), [kirtan])
  return <DownloadedBadge item={item} size={size} />
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center" },
})
