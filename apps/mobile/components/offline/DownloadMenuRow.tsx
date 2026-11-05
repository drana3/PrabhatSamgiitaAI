import type { ReactNode } from "react"

import { DownloadMark } from "@/components/offline/DownloadMark"
import { useDownloadState } from "@/hooks/useDownloadState"
import { downloadMenuLabel, type DownloadItem } from "@/lib/offline/downloadModel"

type Props = {
  item: DownloadItem | null
  /** colours of the mark on the menu's ground */
  color: string
  track?: string
  ring?: string
  fill?: string
  onFill?: string
  size?: number
  /** draws the menu's own row from the label, the mark and the action */
  children: (row: { label: string; icon: ReactNode; onPress: () => void }) => ReactNode
}

/**
 * The Download item of a row menu (songs and Kiirtans): "Download", "Cancel download" while the
 * ring runs, "Remove download" when it is on the phone, with the same mark as the buttons. Draws
 * nothing for a song without playable audio. The menu closes itself around `onPress`.
 */
export function DownloadMenuRow({ item, color, track, ring, fill, onFill, size = 24, children }: Props) {
  const { view, press } = useDownloadState(item)
  if (!view.visible) return null
  return (
    <>
      {children({
        label: downloadMenuLabel(view.status),
        icon: <DownloadMark status={view.status} progress={view.progress} size={size} color={color} track={track} ring={ring} fill={fill} onFill={onFill} />,
        onPress: press,
      })}
    </>
  )
}
